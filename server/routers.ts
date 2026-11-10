import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearCemagSession, createCemagSession, validateCemagCredentials } from "./cemagAuth";
import { getCurrentAnalyticBase, getSharedFile, listAnalyticRows, replaceAnalyticBase, upsertExternalSnapshot, upsertSharedFile } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { storageGetSignedUrl } from "./storage";
import { obterFatoresExternos } from "./externalFactors";
import { invokeLLM } from "./_core/llm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CLIENTE_INFO_OVERRIDE, prepararDados } from "../client/src/lib/faturamento";

let periodoBaseCache: { anoInicio: number; anoFim: number; atualizadoEm: number } | null = null;
let contextoAnaliticoCache: { version: string; atualizadoEm: number; contexto: string } | null = null;
let reconstruindoAnalitica: Promise<void> | null = null;

function lerLinhasArquivo(bytes: Buffer, fileName: string): Record<string, unknown>[] {
  if (/\.csv$/i.test(fileName)) {
    const parsed = Papa.parse<Record<string, unknown>>(bytes.toString("utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false, delimiter: "" });
    if (parsed.errors.length) console.warn("[CSV] Avisos de leitura:", parsed.errors.slice(0, 3));
    return parsed.data.filter((linha) => Object.values(linha).some((valor) => String(valor ?? "").trim() !== ""));
  }
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, cellNF: false });
  const primeiraAba = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[primeiraAba] || {}, { defval: "" });
}

function extrairAno(valor: unknown): number | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.getFullYear();
  if (typeof valor === "number" && valor > 20000 && valor < 100000) {
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return Number.isNaN(data.getTime()) ? null : data.getUTCFullYear();
  }
  const texto = String(valor ?? "").trim();
  const br = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (br) return Number(br[3]);
  const iso = texto.match(/^(\d{4})[\/-]\d{1,2}[\/-]\d{1,2}/);
  if (iso) return Number(iso[1]);
  const ano = texto.match(/\b(19\d{2}|20\d{2})\b/);
  return ano ? Number(ano[1]) : null;
}

async function obterPeriodoBaseCentral() {
  if (periodoBaseCache && Date.now() - periodoBaseCache.atualizadoEm < 10 * 60 * 1000) return periodoBaseCache;
  const arquivo = await getSharedFile("base");
  let bytes: Buffer;
  if (arquivo) {
    const signedUrl = await storageGetSignedUrl(arquivo.storageKey);
    const resposta = await fetch(signedUrl);
    if (!resposta.ok) throw new Error(`Não foi possível ler a base central (${resposta.status}).`);
    bytes = Buffer.from(await resposta.arrayBuffer());
  } else {
    const candidatos = [
      path.resolve(process.cwd(), "client/public/data/tabelaFaturamento.csv"),
      path.resolve(process.cwd(), "dist/public/data/tabelaFaturamento.csv"),
      path.resolve(process.cwd(), "client/src/data/tabelaFaturamento.csv"),
    ];
    const caminho = candidatos.find((item) => existsSync(item));
    if (!caminho) return null;
    bytes = await readFile(caminho);
  }
  const linhas = lerLinhasArquivo(bytes, arquivo?.fileName || "tabelaFaturamento.csv");
  const nomesData = ["data_movimentacao", "data movimentação", "movimentacao", "data_emissao", "data emissão", "data", "date", "bai_movimentac", "bai_emissao"];
  const anos: number[] = [];
  for (const linha of linhas) {
    const chave = Object.keys(linha).find((nome) => nomesData.includes(nome.trim().toLowerCase()));
    const ano = chave ? extrairAno(linha[chave]) : null;
    if (ano && ano >= 1900 && ano <= 2200) anos.push(ano);
  }
  if (!anos.length) return null;
  periodoBaseCache = { anoInicio: Math.min(...anos), anoFim: Math.max(...anos), atualizadoEm: Date.now() };
  return periodoBaseCache;
}

const sharedFileInput = z.object({
  kind: z.enum(["base", "metas"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(160),
  contentBase64: z.string().min(1),
});

const chatMessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-180) || "arquivo.csv";
}

function extrairDataTexto(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number" && valor > 20000 && valor < 100000) {
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
  }
  const texto = String(valor ?? "").trim();
  const br = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = texto.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return iso ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : null;
}

async function reconstruirBaseAnalitica(bytes: Buffer, storageKey: string, fileName: string) {
  const linhas = lerLinhasArquivo(bytes, fileName);
  if (!linhas.length) throw new Error("A base enviada não possui linhas para a base analítica.");
  let linhasAnaliticas: Record<string, unknown>[] = linhas;
  try {
    const tratados = prepararDados(linhas, CLIENTE_INFO_OVERRIDE).dados;
    if (tratados.length) linhasAnaliticas = tratados as unknown as Record<string, unknown>[];
  } catch (error) {
    console.warn("[AnalyticBase] Não foi possível aplicar toda a normalização CEMAG; mantendo linhas originais:", error);
  }
  const nomesData = ["data_movimentacao", "data movimentação", "movimentacao", "data_emissao", "data emissão", "data", "date", "bai_movimentac", "bai_emissao"];
  const datas = linhasAnaliticas.map((linha) => {
    const chave = Object.keys(linha).find((nome) => nomesData.includes(nome.trim().toLowerCase()));
    return chave ? extrairDataTexto(linha[chave]) : null;
  }).filter((valor): valor is string => Boolean(valor)).sort();
  const dimensoes = Object.keys(linhasAnaliticas[0]).filter((nome) => /data|ano|m[eê]s|cidade|uf|estado|regi[aã]o|representante|vendedor|cliente|produto|modelo|fam[ií]lia|tipo|pedido|lista|quantidade|faturamento|valor|cor/i.test(nome));
  const version = `${Date.now()}-a3-${safeFileName(fileName)}`;
  const rows = linhasAnaliticas.map((linha, index) => ({ baseVersion: version, rowNumber: index + 1, payload: JSON.stringify(linha) }));
  await replaceAnalyticBase({
    id: 1,
    version,
    sourceStorageKey: storageKey,
    sourceFileName: fileName,
    status: "ready",
    rowCount: linhasAnaliticas.length,
    dimensions: JSON.stringify(dimensoes),
    dataInicio: datas[0] || null,
    dataFim: datas[datas.length - 1] || null,
    errorMessage: null,
  }, rows);
  return { version, rowCount: linhas.length, dimensions: dimensoes, dataInicio: datas[0] || null, dataFim: datas[datas.length - 1] || null };
}

function chaveNormalizada(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function campoAnalitico(linha: Record<string, unknown>, nomes: string[]) {
  const mapa = new Map(Object.keys(linha).map((chave) => [chaveNormalizada(chave), linha[chave]]));
  for (const nome of nomes) {
    const valor = mapa.get(chaveNormalizada(nome));
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") return valor;
  }
  return "";
}

function numeroAnalitico(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function dataAnalitica(valor: unknown): string | null {
  const data = extrairDataTexto(valor);
  return data;
}

async function obterContextoAnaliticoPersistido() {
  const arquivoAtual = await getSharedFile("base");
  let base = await getCurrentAnalyticBase();
  if (arquivoAtual && (!base || base.sourceStorageKey !== arquivoAtual.storageKey || !base.version.includes("-a3-"))) {
    if (!reconstruindoAnalitica) {
      reconstruindoAnalitica = (async () => {
        const signedUrl = await storageGetSignedUrl(arquivoAtual.storageKey);
        const resposta = await fetch(signedUrl);
        if (!resposta.ok) throw new Error(`Não foi possível ler a base central para o chat (${resposta.status}).`);
        await reconstruirBaseAnalitica(Buffer.from(await resposta.arrayBuffer()), arquivoAtual.storageKey, arquivoAtual.fileName);
      })().finally(() => { reconstruindoAnalitica = null; });
    }
    await reconstruindoAnalitica;
    base = await getCurrentAnalyticBase();
  }
  if (!arquivoAtual && (!base || !base.sourceStorageKey.startsWith("local:v2:"))) {
    const candidatos = [
      path.resolve(process.cwd(), "client/public/data/tabelaFaturamento.csv"),
      path.resolve(process.cwd(), "dist/public/data/tabelaFaturamento.csv"),
      path.resolve(process.cwd(), "client/src/data/tabelaFaturamento.csv"),
    ];
    const caminho = candidatos.find((item) => existsSync(item));
    if (caminho) {
      if (!reconstruindoAnalitica) {
        reconstruindoAnalitica = (async () => { await reconstruirBaseAnalitica(await readFile(caminho), `local:v2:${caminho}`, path.basename(caminho)); })().finally(() => { reconstruindoAnalitica = null; });
      }
      await reconstruindoAnalitica;
      base = await getCurrentAnalyticBase();
    }
  }
  if (!base || base.status !== "ready") return null;
  if (contextoAnaliticoCache?.version === base.version && Date.now() - contextoAnaliticoCache.atualizadoEm < 30 * 60 * 1000) return contextoAnaliticoCache.contexto;
  const linhas = await listAnalyticRows(base.version);
  const mensal = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porProduto = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porFamilia = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porRegiao = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porCidade = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porRepresentante = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porUf = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porCliente = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porTipoVenda = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porCor = new Map<string, { faturamento: number; quantidade: number; linhas: number }>();
  const porAnoCidade = new Map<string, { ano: number; cidade: string; uf: string; regiao: string; faturamento: number; quantidade: number; linhas: number }>();
  const porSemestreRegiao = new Map<string, { ano: number; semestre: string; regiao: string; faturamento: number; quantidade: number; linhas: number }>();
  const porAnoRepresentante = new Map<string, { ano: number; representante: string; faturamento: number; quantidade: number; linhas: number }>();
  const porDia = new Map<string, { dia: string; faturamento: number; quantidade: number; linhas: number }>();
  const porMesProduto = new Map<string, { produto: string; tipo_produto: string; familia: string; cor: string; faturamento: number; quantidade: number; linhas: number }>();
  const porAnoProduto = new Map<string, { ano: number; produto: string; tipo_produto: string; faturamento: number; quantidade: number; linhas: number }>();
  const porMesTipoProduto = new Map<string, { mes: string; tipo_produto: string; faturamento: number; quantidade: number; linhas: number }>();
  const porMesTipoVenda = new Map<string, { mes: string; tipo_venda: string; faturamento: number; quantidade: number; linhas: number }>();
  let totalFaturamento = 0;
  let totalQuantidade = 0;
  let minData = "";
  let maxData = "";
  const acumular = (mapa: Map<string, { faturamento: number; quantidade: number; linhas: number }>, nome: string, faturamento: number, quantidade: number) => {
    const atual = mapa.get(nome) || { faturamento: 0, quantidade: 0, linhas: 0 };
    atual.faturamento += faturamento; atual.quantidade += quantidade; atual.linhas += 1; mapa.set(nome, atual);
  };
  for (const item of linhas) {
    let linha: Record<string, unknown>;
    try { linha = JSON.parse(item.payload); } catch { continue; }
    const data = dataAnalitica(campoAnalitico(linha, ["BAI_MOVIMENTAC", "BAI_EMISSAO", "data_movimentacao", "data_emissao", "data"]));
    const produto = String(campoAnalitico(linha, ["1o. Agrupamento", "agrupamento", "produto", "item", "carreta"]) || "Não informado").trim();
    const familia = String(campoAnalitico(linha, ["familia", "família", "grupo_modelo", "grupo", "1o. Agrupamento"]) || produto.split(/\s+/)[0] || "Não informado").trim();
    const tipo = String(campoAnalitico(linha, ["tipo_produto", "tipo produto", "classificacao", "categoria_produto"]) || (produto.toUpperCase().includes("CARRETA") ? "Carreta" : "Outros")).trim();
    const faturamento = numeroAnalitico(campoAnalitico(linha, ["faturamento", "valor", "valor_total", "total"]));
    const quantidade = numeroAnalitico(campoAnalitico(linha, ["quantidade", "qtd", "qtde"]));
    const regiao = String(campoAnalitico(linha, ["regiao", "região"]) || "Não identificado").trim();
    const cidade = String(campoAnalitico(linha, ["cidade", "municipio", "município"]) || "Não informado").trim();
    const representante = String(campoAnalitico(linha, ["representante", "vendedor", "consultor"]) || "Não informado").trim();
    const uf = String(campoAnalitico(linha, ["uf", "estado", "sigla_uf"]) || "Não identificado").trim();
    const cliente = String(campoAnalitico(linha, ["cliente", "cliente_base", "comprador", "BAI_PESSOA.CODIGO"]) || "Não informado").trim();
    const tipoVenda = String(campoAnalitico(linha, ["tipo_venda", "tipo venda", "BAI_CLASSE.NOME"]) || "Não informado").trim();
    const cor = String(campoAnalitico(linha, ["cor", "color"]) || ((tipo === "Carreta" || tipo === "Conjunto") ? "Laranja" : "Não aplicável")).trim();
    totalFaturamento += faturamento; totalQuantidade += quantidade;
    if (data) { if (!minData || data < minData) minData = data; if (!maxData || data > maxData) maxData = data; const ano = Number(data.slice(0, 4)); const mesNumero = Number(data.slice(5, 7)); const semestre = mesNumero <= 6 ? "1º semestre" : "2º semestre"; const mes = data.slice(0, 7); acumular(mensal, mes, faturamento, quantidade); const chaveTipoProduto = `${mes}|${tipo}`; const tipoProdutoAtual = porMesTipoProduto.get(chaveTipoProduto) || { mes, tipo_produto: tipo, faturamento: 0, quantidade: 0, linhas: 0 }; tipoProdutoAtual.faturamento += faturamento; tipoProdutoAtual.quantidade += quantidade; tipoProdutoAtual.linhas += 1; porMesTipoProduto.set(chaveTipoProduto, tipoProdutoAtual); const chaveTipoVenda = `${mes}|${tipoVenda}`; const tipoVendaAtual = porMesTipoVenda.get(chaveTipoVenda) || { mes, tipo_venda: tipoVenda, faturamento: 0, quantidade: 0, linhas: 0 }; tipoVendaAtual.faturamento += faturamento; tipoVendaAtual.quantidade += quantidade; tipoVendaAtual.linhas += 1; porMesTipoVenda.set(chaveTipoVenda, tipoVendaAtual); const chaveAnoProduto = `${ano}|${produto}|${tipo}`; const anoProdutoAtual = porAnoProduto.get(chaveAnoProduto) || { ano, produto, tipo_produto: tipo, faturamento: 0, quantidade: 0, linhas: 0 }; anoProdutoAtual.faturamento += faturamento; anoProdutoAtual.quantidade += quantidade; anoProdutoAtual.linhas += 1; porAnoProduto.set(chaveAnoProduto, anoProdutoAtual); const chave = `${mes}|${produto}|${tipo}|${cor}`; const atual = porMesProduto.get(chave) || { produto, tipo_produto: tipo, familia, cor, faturamento: 0, quantidade: 0, linhas: 0 }; atual.faturamento += faturamento; atual.quantidade += quantidade; atual.linhas += 1; porMesProduto.set(chave, atual); const chaveCidade = `${ano}|${cidade}`; const cidadeAtual = porAnoCidade.get(chaveCidade) || { ano, cidade, uf, regiao, faturamento: 0, quantidade: 0, linhas: 0 }; cidadeAtual.faturamento += faturamento; cidadeAtual.quantidade += quantidade; cidadeAtual.linhas += 1; porAnoCidade.set(chaveCidade, cidadeAtual); const chaveSemestre = `${ano}|${semestre}|${regiao}`; const semestreAtual = porSemestreRegiao.get(chaveSemestre) || { ano, semestre, regiao, faturamento: 0, quantidade: 0, linhas: 0 }; semestreAtual.faturamento += faturamento; semestreAtual.quantidade += quantidade; semestreAtual.linhas += 1; porSemestreRegiao.set(chaveSemestre, semestreAtual); const chaveRepresentante = `${ano}|${representante}`; const representanteAtual = porAnoRepresentante.get(chaveRepresentante) || { ano, representante, faturamento: 0, quantidade: 0, linhas: 0 }; representanteAtual.faturamento += faturamento; representanteAtual.quantidade += quantidade; representanteAtual.linhas += 1; porAnoRepresentante.set(chaveRepresentante, representanteAtual); const diaAtual = porDia.get(data) || { dia: data, faturamento: 0, quantidade: 0, linhas: 0 }; diaAtual.faturamento += faturamento; diaAtual.quantidade += quantidade; diaAtual.linhas += 1; porDia.set(data, diaAtual); }
    acumular(porProduto, produto, faturamento, quantidade); acumular(porFamilia, familia, faturamento, quantidade); acumular(porRegiao, regiao, faturamento, quantidade); acumular(porCidade, cidade, faturamento, quantidade); acumular(porRepresentante, representante, faturamento, quantidade); acumular(porUf, uf, faturamento, quantidade); acumular(porCliente, cliente, faturamento, quantidade); acumular(porTipoVenda, tipoVenda, faturamento, quantidade); acumular(porCor, cor, faturamento, quantidade);
  }
  const ranking = (mapa: Map<string, { faturamento: number; quantidade: number; linhas: number }>) => Array.from(mapa, ([nome, item]) => ({ nome, ...item })).sort((a, b) => b.faturamento - a.faturamento).slice(0, 20);
  const rankingQuantidade = (mapa: Map<string, { faturamento: number; quantidade: number; linhas: number }>) => Array.from(mapa, ([nome, item]) => ({ nome, ...item })).sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento).slice(0, 20);
  const produtosPorMes = Object.fromEntries(Array.from(porMesProduto.entries()).reduce((mapa, [chave, item]) => { const mes = chave.split("|")[0]; const lista = mapa.get(mes) || []; lista.push(item); mapa.set(mes, lista); return mapa; }, new Map<string, any[]>()).entries().map(([mes, lista]) => [mes, lista.sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento).slice(0, 30)]));
  const cidadesPorAno = Array.from(porAnoCidade.values()).sort((a, b) => a.ano - b.ano || b.faturamento - a.faturamento);
  const resumoSemestralPorRegiao = Array.from(porSemestreRegiao.values()).sort((a, b) => a.ano - b.ano || a.semestre.localeCompare(b.semestre) || b.faturamento - a.faturamento);
  const representantesPorAno = Array.from(porAnoRepresentante.values()).sort((a, b) => a.ano - b.ano || b.faturamento - a.faturamento);
  const diasDetalhados = Array.from(porDia.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  const limitarPorAno = <T extends { ano: number }>(itens: T[], limite = 10) => Array.from(new Map<number, T[]>(Array.from(new Set(itens.map((item) => item.ano))).map((ano) => [ano, itens.filter((item) => item.ano === ano).slice(0, limite)])).values()).flat();
  const produtosPorMesCompacto = Object.fromEntries(Object.entries(produtosPorMes).slice(-12).map(([mes, lista]) => [mes, (lista as any[]).slice(0, 10)]));
  const contexto = JSON.stringify({ fonte: "base analítica persistida no servidor", arquivo: base.sourceFileName, versao: base.version, periodoBase: `${minData || base.dataInicio || "—"} a ${maxData || base.dataFim || "—"}`, linhas: base.rowCount, totalFaturamento, totalQuantidade, resumoMensal: Array.from(mensal, ([mes, item]) => ({ mes, ...item })).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-36), resumoMensalPorTipoProduto: Array.from(porMesTipoProduto.values()).sort((a, b) => a.mes.localeCompare(b.mes) || b.faturamento - a.faturamento), resumoMensalPorTipoVenda: Array.from(porMesTipoVenda.values()).sort((a, b) => a.mes.localeCompare(b.mes) || b.faturamento - a.faturamento), produtosPorAno: Array.from(porAnoProduto.values()), rankings: { produtos: ranking(porProduto), produtosPorQuantidade: rankingQuantidade(porProduto), familias: ranking(porFamilia), familiasPorQuantidade: rankingQuantidade(porFamilia), regioes: ranking(porRegiao), ufs: ranking(porUf), cidades: ranking(porCidade), representantes: ranking(porRepresentante), clientes: ranking(porCliente), tiposVenda: ranking(porTipoVenda), cores: ranking(porCor) }, cidadesPorAno: limitarPorAno(cidadesPorAno), representantesPorAno: limitarPorAno(representantesPorAno), resumoSemestralPorRegiao, diasDetalhados: diasDetalhados.slice(-90), produtosPorMes: produtosPorMesCompacto });
  contextoAnaliticoCache = { version: base.version, atualizadoEm: Date.now(), contexto };
  return contexto;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    basePeriod: publicProcedure.query(async () => {
      try {
        const periodo = await obterPeriodoBaseCentral();
        return periodo ? { anoInicio: periodo.anoInicio, anoFim: periodo.anoFim } : null;
      } catch (error) {
        console.warn("[Auth] Não foi possível consultar o período da base central:", error);
        return null;
      }
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        if (!validateCemagCredentials(email, input.password)) {
          return { success: false as const, message: "E-mail corporativo ou senha inválidos. Use @cemag.com.br ou @itaueira.com.br." };
        }
        await createCemagSession(ctx.res, ctx.req, email);
        return { success: true as const, email };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearCemagSession(ctx.res, ctx.req);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(chatMessageInput).min(1).max(16),
        dashboardContext: z.string().trim().min(1).max(60000),
      }))
      .mutation(async ({ input }) => {
        let contextoFonte = input.dashboardContext;
        try {
          const contextoAnalitico = await obterContextoAnaliticoPersistido();
          if (contextoAnalitico) contextoFonte = contextoAnalitico;
        } catch (error) {
          console.warn("[AI] Base analítica persistida indisponível; usando contexto do dashboard:", error);
        }
        try {
          const pergunta = String(input.messages.at(-1)?.content || "").toLocaleLowerCase("pt-BR");
          const analitico = JSON.parse(contextoFonte) as Record<string, any>;
          const ano = pergunta.match(/\b(20\d{2})\b/)?.[1];
          const data = pergunta.match(/(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/);
          if (data && Array.isArray(analitico.diasDetalhados)) {
            const chave = `${data[3]}-${data[2].padStart(2, "0")}-${data[1].padStart(2, "0")}`;
            const dia = analitico.diasDetalhados.find((item: any) => item.dia === chave);
            if (dia) return { content: `No dia **${data[1].padStart(2, "0")}/${data[2].padStart(2, "0")}/${data[3]}**, o faturamento registrado foi de **${Number(dia.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**, com **${Number(dia.quantidade || 0).toLocaleString("pt-BR")} unidades faturadas** e **${Number(dia.linhas || 0).toLocaleString("pt-BR")} linhas**. A base registra faturamento, não produção física.` };
            return { content: `Não encontrei movimentações registradas em **${data[1].padStart(2, "0")}/${data[2].padStart(2, "0")}/${data[3]}** na base analítica. Portanto, o faturamento e a quantidade faturada registrados para essa data são **R$ 0,00** e **0 unidades**.` };
          }
          const mesesPorNome: Record<string, string> = { janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
          const mesTexto = Object.keys(mesesPorNome).find((nome) => pergunta.includes(nome));
          const mesSolicitado = mesTexto ? `${ano || new Date().getUTCFullYear()}-${mesesPorNome[mesTexto]}` : pergunta.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/) ? `${pergunta.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/)![1]}-${pergunta.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/)![2].padStart(2, "0")}` : null;
          if (mesSolicitado && /faturamento|faturado|vendas?|movimenta|quanto|valor/.test(pergunta) && Array.isArray(analitico.resumoMensal) && Array.isArray(analitico.resumoMensalPorTipoProduto)) {
            const totalMes = analitico.resumoMensal.find((item: any) => item.mes === mesSolicitado);
            const detalhamento = analitico.resumoMensalPorTipoProduto.filter((item: any) => item.mes === mesSolicitado).sort((a: any, b: any) => b.faturamento - a.faturamento);
            if (totalMes) {
              const anoSolicitado = mesSolicitado.slice(0, 4);
              const mesesAno = analitico.resumoMensal.filter((item: any) => String(item.mes).startsWith(`${anoSolicitado}-`));
              const totalAno = mesesAno.reduce((soma: number, item: any) => soma + Number(item.faturamento || 0), 0);
              const mesesFuturos = mesesAno.filter((item: any) => item.mes > new Date().toISOString().slice(0, 7)).map((item: any) => item.mes);
              const percentualAno = totalAno ? (Number(totalMes.faturamento || 0) / totalAno) * 100 : 0;
              const linhas = detalhamento.slice(0, 8).map((item: any) => `- **${item.tipo_produto}**: ${Number(item.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, ${Number(item.quantidade || 0).toLocaleString("pt-BR")} unidades, ${Number(item.linhas || 0).toLocaleString("pt-BR")} linhas`).join("\n");
              const nomeMes = mesTexto ? mesTexto.charAt(0).toUpperCase() + mesTexto.slice(1) : mesSolicitado;
              const alertaCoerencia = totalAno > 0 && Number(totalMes.faturamento || 0) > totalAno ? `\n\n**Alerta de consistência:** o mês aparece maior que o próprio acumulado anual disponível (${Number(totalAno).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}). A resposta não deve ser usada antes de revisar o período e possíveis duplicidades.` : `\n\nNo acumulado anual disponível na mesma base, ${anoSolicitado} soma **${Number(totalAno).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**; ${nomeMes} representa **${percentualAno.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%** desse total.${mesesFuturos.length ? ` A base também contém mês(es) posterior(es) ao mês atual (${mesesFuturos.join(", ")}), que devem ser excluídos quando a análise for “até hoje”.` : ""}`;
              return { content: `Encontrei **${nomeMes} de ${mesSolicitado.slice(0, 4)}** na base analítica completa. O faturamento bruto de todas as linhas foi **${Number(totalMes.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**, com **${Number(totalMes.quantidade || 0).toLocaleString("pt-BR")} unidades registradas** em **${Number(totalMes.linhas || 0).toLocaleString("pt-BR")} linhas**.\n\n**Detalhamento por tipo de produto:**\n${linhas || "Não há detalhamento por tipo disponível."}${alertaCoerencia}\n\nAtenção: esse total inclui peças, conjuntos, carretas, sucata, transferências e demais tipos presentes na base. A quantidade de unidades não deve ser interpretada automaticamente como quantidade de carretas produzidas.` };
            }
          }
          if (ano && /carreta|carretas|modelo/.test(pergunta) && /vendid|venda|faturamento|faturado|mais/.test(pergunta) && Array.isArray(analitico.produtosPorAno)) {
            const somenteCarretas = analitico.produtosPorAno.filter((item: any) => String(item.ano) === ano && item.tipo_produto === "Carreta");
            const porQuantidade = [...somenteCarretas].sort((a: any, b: any) => b.quantidade - a.quantidade || b.faturamento - a.faturamento).slice(0, 5);
            const porFaturamento = [...somenteCarretas].sort((a: any, b: any) => b.faturamento - a.faturamento).slice(0, 5);
            const ranking = /faturamento|faturado|valor/.test(pergunta) ? porFaturamento : porQuantidade;
            if (ranking.length) {
              const criterio = /faturamento|faturado|valor/.test(pergunta) ? "faturamento bruto" : "quantidade registrada";
              const lista = ranking.map((item: any, indice: number) => `${indice + 1}. **${item.produto}** — ${Number(item.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; ${Number(item.quantidade || 0).toLocaleString("pt-BR")} unidades registradas; ${Number(item.linhas || 0).toLocaleString("pt-BR")} linhas`).join("\n");
              return { content: `No ano de **${ano}**, considerando somente registros classificados como **Carreta** na base analítica persistida, o ranking por **${criterio}** é:\n\n${lista}\n\nEsse é um ranking anual real, não o ranking histórico acumulado. Os números são os valores registrados na base e não representam necessariamente produção física.` };
            }
          }
          if (ano && /faturamento|faturado|acumulado|vendas?|valor/.test(pergunta) && /ano|acumulad|até agora|ate agora|atual/.test(pergunta) && Array.isArray(analitico.resumoMensal)) {
            const limiteMes = new Date().toISOString().slice(0, 7);
            const mesesDoAno = analitico.resumoMensal.filter((item: any) => String(item.mes).startsWith(`${ano}-`) && String(item.mes) <= limiteMes);
            if (mesesDoAno.length) {
              const acumulado = mesesDoAno.reduce((soma: any, item: any) => ({ faturamento: soma.faturamento + Number(item.faturamento || 0), quantidade: soma.quantidade + Number(item.quantidade || 0), linhas: soma.linhas + Number(item.linhas || 0) }), { faturamento: 0, quantidade: 0, linhas: 0 });
              const mesesFuturos = analitico.resumoMensal.filter((item: any) => String(item.mes).startsWith(`${ano}-`) && String(item.mes) > limiteMes).map((item: any) => item.mes);
              return { content: `Até o mês atual disponível (**${limiteMes.slice(5, 7)}/${ano}**), o faturamento bruto acumulado de **${ano}** na base analítica completa é **${acumulado.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**, com **${acumulado.quantidade.toLocaleString("pt-BR")} unidades registradas** em **${acumulado.linhas.toLocaleString("pt-BR")} linhas**.\n\nA soma foi feita diretamente pelos meses: ${mesesDoAno.map((item: any) => item.mes).join(", ")}.${mesesFuturos.length ? ` Os registros de ${mesesFuturos.join(", ")} foram excluídos por serem posteriores ao mês atual; a base contém dados futuros.` : ""}\n\nEsse é o total bruto de todas as categorias e formas de venda, não apenas Carreta ou V ProdPrópria p Consumo.` };
            }
          }
          if (ano && /vendedor|representante|consultor/.test(pergunta) && Array.isArray(analitico.representantesPorAno)) {
            const lider = analitico.representantesPorAno.filter((item: any) => String(item.ano) === ano).sort((a: any, b: any) => b.faturamento - a.faturamento)[0];
            if (lider) return { content: `Em **${ano}**, o representante com maior faturamento foi **${lider.representante}**, com **${Number(lider.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}** e **${Number(lider.quantidade || 0).toLocaleString("pt-BR")} unidades faturadas**.` };
          }
          if (ano && /nordeste|sudeste|sul|norte|centro-oeste|centrooeste/.test(pergunta) && /semestre/.test(pergunta) && Array.isArray(analitico.resumoSemestralPorRegiao)) {
            const regiao = /nordeste/.test(pergunta) ? "Nordeste" : /sudeste/.test(pergunta) ? "Sudeste" : /sul/.test(pergunta) ? "Sul" : /norte/.test(pergunta) ? "Norte" : "Centro-Oeste";
            const semestre = /segundo|2º|2o/.test(pergunta) ? "2º semestre" : "1º semestre";
            const item = analitico.resumoSemestralPorRegiao.find((linha: any) => String(linha.ano) === ano && linha.regiao === regiao && linha.semestre === semestre);
            if (item) return { content: `No **${semestre} de ${ano}**, a região **${regiao}** registrou **${Number(item.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}**, com **${Number(item.quantidade || 0).toLocaleString("pt-BR")} unidades faturadas** e **${Number(item.linhas || 0).toLocaleString("pt-BR")} linhas**.` };
          }
        } catch (error) {
          console.warn("[AI] Resposta determinística indisponível; seguindo para o modelo:", error);
        }
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: [
                "Você é o assistente de inteligência comercial da CEMAG.",
                "Responda em português do Brasil, de forma objetiva e acionável.",
                "Use exclusivamente os dados da base analítica persistida no servidor quando ela estiver disponível. O contexto do dashboard é apenas fallback técnico.",
                "Interprete sinônimos da equipe: vendedor, vendedores, consultor e comercial significam o campo representante; comprador significa cliente; vendido significa faturamento registrado; cidade significa município. Preserve os nomes reais quando apresentar os resultados.",
                "Carreta e implemento podem ser usados pelo usuário para falar do tipo de produto, mas confirme no campo tipo_produto e não misture Carreta com Conjunto, Peça ou Sucata.",
                "Para uma carreta/modelo específico, procure produtosDetalhados e apresente faturamento, quantidade, linhas, pedidos e clientes; para uma família, procure familiasDetalhadas. Se o item não estiver entre os 50 principais enviados, diga que ele não aparece no ranking resumido e não invente um valor.",
                "Quando o usuário perguntar pela melhor cidade sem indicar o critério, use o maior faturamento como padrão e informe explicitamente esse critério; se pedir quantidade, pedidos ou clientes, use a métrica solicitada.",
                "Para perguntas que combinem dimensão e período, como região + mês, procure primeiro as tabelas de cruzamento mensal fornecidas no contexto antes de dizer que não há informação.",
                "Para perguntas sobre um dia específico, procure a tabela resumoDiario e explique faturamento, quantidade, pedidos, clientes e regiões daquele dia. Se a data não estiver na tabela, informe que o detalhamento diário enviado cobre somente os 365 dias mais recentes.",
                "Para perguntas sobre primeiro ou segundo semestre, procure resumoSemestralPorRegiao. Se o ano não for informado e houver mais de um ano, mostre os anos disponíveis ou peça a confirmação do ano.",
                "Para perguntas sobre a melhor cidade ou município, procure rankings.cidades; para um semestre específico, procure resumoSemestralPorCidade.",
                "Para perguntas como melhor cidade em um ano específico, procure cidadesPorAno, filtre pelo ano pedido e ordene por faturamento decrescente. Nunca diga que falta detalhamento se esse índice estiver presente.",
                "Para região em semestre, use resumoSemestralPorRegiao filtrando ano, 1º/2º semestre e região. Para vendedor/representante em um ano, use representantesPorAno. Para uma data específica, use diasDetalhados e procure a data exata; não limite a consulta aos últimos 365 dias.",
                "Para família em um semestre, procure resumoSemestralPorFamilia; para uma carreta em um semestre, use produtosDetalhados somente se o contexto indicar o período filtrado, e deixe claro quando o ranking for acumulado.",
                "Quando o usuário disser mais vendido, venda maior ou maior quantidade, use quantidade como métrica principal, especialmente rankings.produtosPorQuantidade e produtosPorMes. Em uma pergunta mensal, filtre primeiro o mês pedido e, se disser carreta, considere somente tipo_produto Carreta; responda primeiro o líder e informe que a quantidade é faturada.",
                "Se a pergunta não puder ser respondida com esses dados, diga claramente que não há informação suficiente e sugira qual filtro ou relatório consultar.",
                "Nunca invente valores, causas, clientes ou previsões. Diferencie fato observado de interpretação.",
                "Quando citar valores, use formato brasileiro e explique o filtro/período considerado.",
                `CONTEXTO DA BASE ANALÍTICA:\n${contextoFonte}`,
              ].join("\n\n"),
            },
            ...input.messages,
          ],
          maxTokens: 700,
        });
        const content = response.choices[0]?.message?.content;
        if (typeof content !== "string") throw new Error("A resposta do assistente não veio em formato de texto.");
        return { content };
      }),
  }),
  cemag: router({
    fatoresExternos: protectedProcedure
      .input(z.object({
        dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        cidade: z.string().min(1).max(120),
        uf: z.string().max(2).optional(),
        localidades: z.array(z.object({ cidade: z.string().min(1).max(120), uf: z.string().max(2).optional() })).max(40).optional(),
        descricaoAbrangencia: z.string().max(180).optional(),
      }))
      .query(async ({ input }) => {
        const result = await obterFatoresExternos(input);
        try {
          await upsertExternalSnapshot({ cidade: input.cidade, uf: input.uf || null, payload: JSON.stringify({ input, result }) });
        } catch (error) {
          console.warn("[ExternalFactors] Não foi possível persistir o snapshot:", error);
        }
        return result;
      }),
    currentFiles: protectedProcedure.query(async () => {
      const [base, metas, analyticBase] = await Promise.all([getSharedFile("base"), getSharedFile("metas"), getCurrentAnalyticBase()]);
      return {
        base: base ? { ...base, url: `/manus-storage/${base.storageKey}` } : null,
        metas: metas ? { ...metas, url: `/manus-storage/${metas.storageKey}` } : null,
        analyticBase: analyticBase ? { ...analyticBase, dimensions: JSON.parse(analyticBase.dimensions) } : null,
      };
    }),
    uploadFile: adminProcedure
      .input(sharedFileInput)
      .mutation(async ({ input, ctx }) => {
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (!bytes.length) throw new Error("Arquivo vazio.");
        if (bytes.length > 50 * 1024 * 1024) throw new Error("Arquivo excede o limite de 50 MB.");
        const stored = await storagePut(
          `cemag/${input.kind}/${Date.now()}-${safeFileName(input.fileName)}`,
          bytes,
          input.contentType,
        );
        await upsertSharedFile({
          kind: input.kind,
          fileName: input.fileName,
          storageKey: stored.key,
          contentType: input.contentType,
          sizeBytes: bytes.length,
        });
        let analyticBase: Awaited<ReturnType<typeof reconstruirBaseAnalitica>> | null = null;
        let analyticError: string | null = null;
        if (input.kind === "base") {
          try {
            analyticBase = await reconstruirBaseAnalitica(bytes, stored.key, input.fileName);
          } catch (error) {
            analyticError = error instanceof Error ? error.message : "Não foi possível gerar a base analítica.";
            console.error("[AnalyticBase] Falha ao reconstruir base analítica:", error);
          }
        }
        return {
          success: true as const,
          kind: input.kind,
          fileName: input.fileName,
          sizeBytes: bytes.length,
          url: stored.url,
          updatedBy: ctx.user.email,
          analyticBase,
          analyticError,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
