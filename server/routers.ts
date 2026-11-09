import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearCemagSession, createCemagSession, validateCemagCredentials } from "./cemagAuth";
import { getSharedFile, upsertExternalSnapshot, upsertSharedFile } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { storageGetSignedUrl } from "./storage";
import { obterFatoresExternos } from "./externalFactors";
import { invokeLLM } from "./_core/llm";
import * as XLSX from "xlsx";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

let periodoBaseCache: { anoInicio: number; anoFim: number; atualizadoEm: number } | null = null;

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
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, cellNF: false });
  const primeiraAba = workbook.SheetNames[0];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[primeiraAba] || {}, { defval: "" });
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

function responderChatLocal(pergunta: string, contextoTexto: string) {
  try {
    const contexto = JSON.parse(contextoTexto) as Record<string, any>;
    const texto = pergunta.toLocaleLowerCase("pt-BR");
    const meses: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
    const ano = texto.match(/\b(20\d{2})\b/)?.[1];
    const nomeMes = Object.keys(meses).find((nome) => texto.includes(nome));
    const mes = nomeMes ? meses[nomeMes] : texto.match(/\b(\d{4})[-\/](\d{1,2})\b/)?.[2]?.padStart(2, "0");
    const chaveMes = ano && mes ? `${ano}-${mes}` : null;
    const produtos = chaveMes && contexto.produtosPorMes?.[chaveMes] ? contexto.produtosPorMes[chaveMes] : null;
    if (produtos?.length && /carreta|implemento|produto|modelo/.test(texto) && /vendid|vendeu|vendas|quantidade/.test(texto)) {
      const lider = [...produtos].sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0))[0];
      const faturamento = Number(lider.faturamento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `Com base na base completa tratada, o produto/carreta mais vendido em ${chaveMes} foi **${lider.produto}**, com **${Number(lider.quantidade || 0).toLocaleString("pt-BR")} unidades** e faturamento de **${faturamento}**. A quantidade representa quantidade faturada; a base não comprova produção física.`;
    }
  } catch {
    // O fallback abaixo evita devolver erro técnico à interface.
  }
  return "O Assistente CEMAG está temporariamente sem resposta automática. A consulta foi recebida e pode ser repetida em alguns segundos; os filtros visuais não alteram a base usada pelo assistente.";
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-180) || "arquivo.csv";
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
        let response: Awaited<ReturnType<typeof invokeLLM>> | null = null;
        let ultimoErro: unknown = null;
        for (let tentativa = 0; tentativa < 3 && !response; tentativa++) {
          try {
            response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: [
                "Você é o assistente de inteligência comercial da CEMAG.",
                "Responda em português do Brasil, de forma objetiva e acionável.",
                "Use exclusivamente os dados do contexto enviado pelo dashboard. O contexto do Assistente CEMAG representa a base completa tratada; ignore filtros visuais e não diga que está respondendo apenas pelo recorte ativo.",
                "Interprete sinônimos da equipe: vendedor, vendedores, consultor e comercial significam o campo representante; comprador significa cliente; vendido significa faturamento registrado; cidade significa município. Preserve os nomes reais quando apresentar os resultados.",
                "Carreta e implemento podem ser usados pelo usuário para falar do tipo de produto, mas confirme no campo tipo_produto e não misture Carreta com Conjunto, Peça ou Sucata.",
                "Para uma carreta/modelo específico, procure produtosDetalhados e apresente faturamento, quantidade, linhas, pedidos e clientes; para uma família, procure familiasDetalhadas. Se o item não estiver entre os 50 principais enviados, diga que ele não aparece no ranking resumido e não invente um valor.",
                "Quando o usuário perguntar pela melhor cidade sem indicar o critério, use o maior faturamento como padrão e informe explicitamente esse critério; se pedir quantidade, pedidos ou clientes, use a métrica solicitada.",
                "Para perguntas que combinem dimensão e período, como região + mês, procure primeiro as tabelas de cruzamento mensal fornecidas no contexto antes de dizer que não há informação.",
                "Para perguntas como 'qual foi a carreta mais vendida em outubro de 2026?', consulte produtosPorMes['2026-10'] e use a métrica pedida. Considere 'mais vendida' como maior quantidade quando a pergunta usar vendida; informe também o faturamento se disponível.",
                "Para perguntas sobre um dia específico, procure a tabela resumoDiario e explique faturamento, quantidade, pedidos, clientes e regiões daquele dia. Se a data não estiver na tabela, informe que o detalhamento diário enviado cobre somente os 365 dias mais recentes.",
                "Para perguntas sobre primeiro ou segundo semestre, procure resumoSemestralPorRegiao. Se o ano não for informado e houver mais de um ano, mostre os anos disponíveis ou peça a confirmação do ano.",
                "Para perguntas sobre a melhor cidade ou município, procure rankings.cidades; para um semestre específico, procure resumoSemestralPorCidade.",
                "Para família em um semestre, procure resumoSemestralPorFamilia; para uma carreta em um semestre, use produtosDetalhados somente se o contexto indicar o período filtrado, e deixe claro quando o ranking for acumulado.",
                "Se a pergunta não puder ser respondida com esses dados, diga claramente que não há informação suficiente e sugira qual filtro ou relatório consultar.",
                "Nunca invente valores, causas, clientes ou previsões. Diferencie fato observado de interpretação.",
                "Quando citar valores, use formato brasileiro e explique que o período é consultado na base completa. Se a pergunta pedir produção física, esclareça que a base CEMAG registra faturamento/quantidade faturada, não produção.",
                `CONTEXTO ATUAL DO DASHBOARD:\n${input.dashboardContext}`,
              ].join("\n\n"),
            },
            ...input.messages,
          ],
              maxTokens: 700,
            });
          } catch (error) {
            ultimoErro = error;
            if (tentativa < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (tentativa + 1)));
          }
        }
        if (!response) {
          console.warn("[AIChat] invokeLLM indisponível; usando fallback local.", ultimoErro);
          return { content: responderChatLocal(input.messages.at(-1)?.content || "", input.dashboardContext), fallback: true as const };
        }
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
      const [base, metas] = await Promise.all([getSharedFile("base"), getSharedFile("metas")]);
      return {
        base: base ? { ...base, url: `/manus-storage/${base.storageKey}` } : null,
        metas: metas ? { ...metas, url: `/manus-storage/${metas.storageKey}` } : null,
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
        return {
          success: true as const,
          kind: input.kind,
          fileName: input.fileName,
          sizeBytes: bytes.length,
          url: stored.url,
          updatedBy: ctx.user.email,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
