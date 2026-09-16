import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface TransacaoRaw {
  [key: string]: any;
}

export interface TransacaoTratada {
  id: string;
  produto: string;
  cliente: string;
  cliente_base: string;
  cidade: string;
  cidade_planilha: string;
  cidade_estado: string;
  uf: string;
  regiao: string;
  representante: string;
  lista_preco_uf: string;
  descricao_generica: string;
  categoria_produto: string;
  tipo_venda: string;
  pedido: string;
  data_emissao: Date;
  data_movimento?: Date;
  data_str: string;
  ano: number;
  mes_num: number;
  mes: string;
  mes_completo: string;
  ano_mes: string;
  ano_mes_data: string;
  trimestre: string;
  semestre: string;
  dia_semana: string;
  dia_mes: number;
  quantidade: number;
  faturamento: number;
  quantidade_ticket: number;
  faturamento_ticket: number;
  ticket_unitario: number;
  linhas_qtd_nao_positiva: number;
  custo: number;
  frete: number;
  ipi: number;
  pis: number;
  cofins: number;
  icms: number;
  iss: number;
  ir: number;
  inss: number;
  ii: number;
  acessorio0: number;
  acessorio1: number;
  impostos_principais: number;
  tributos_dre: number;
  acessorios_dre: number;
  faturamento_liquido_aprox: number;
  familia: string;
  grupo_modelo: string;
}

export interface ResumoAgregado {
  faturamento: number;
  quantidade: number;
  quantidade_ticket: number;
  faturamento_ticket: number;
  pedidos: number;
  linhas: number;
  clientes: number;
  ticket_unitario_calc: number;
  valor_medio_pedido: number;
  linhas_qtd_nao_positiva: number;
  [key: string]: any;
}

export const UF_REGIAO: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste",
  PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
  UY: "Exportação",
};

export const UF_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

export const MESES: Record<number, string> = {
  1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez",
};

export const MESES_COMPLETOS: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

export const CIDADE_UF_HINTS: Record<string, string> = {
  "MONTESCLAROS": "MG", "MONTES CLAROS": "MG", "IMPERATRIZ": "MA",
  "TEOFILOOTONI": "MG", "TEÓFILOOTONI": "MG", "GOIANIA": "GO", "GOIÂNIA": "GO",
  "CAMPINAGRANDE": "PB", "CAMPINA GRANDE": "PB", "CACHOEIRODEITAPEMIRIM": "ES",
  "CACHOEIRO DE ITAPEMIRIM": "ES", "NSGLORIA": "SE", "NOSSA SENHORA DA GLORIA": "SE",
  "NOSSA SENHORA DA GLÓRIA": "SE", "PARAISODOTOCANTIN": "TO", "PARAISO DO TOCANTINS": "TO",
  "MOSSORO": "RN", "MOSSORÓ": "RN", "F.SANTANA": "BA", "FEIRADESANTANA": "BA",
  "FEIRA DE SANTANA": "BA", "IRECE": "BA", "IRECÊ": "BA", "BALSAS": "MA",
  "GUARAI": "TO", "GUARAÍ": "TO", "PONTENOVA": "MG", "PONTE NOVA": "MG",
  "SAOFELIXDOXINGU": "PA", "SÃOFELIXDOXINGU": "PA", "SAO FELIX DO XINGU": "PA",
  "SÃO FELIX DO XINGU": "PA", "TEIXEIRADEFREITAS": "BA", "TEIXEIRA DE FREITAS": "BA",
  "SAPEZAL": "MT",
};

export const CLIENTE_INFO_OVERRIDE: Record<string, any> = {
  "DF-MATA FRESCA-CE": {
    cliente_base: "Mata Fresca Ltda",
    cidade: "Aracati",
    cidade_estado: "Aracati-CE",
    uf: "CE",
    representante: "Sônia",
    lista_preco_uf: "Lista Preço N e NE",
  },
  "DF - PLANES": {
    cliente_base: "Planes Agropecuária Ltda",
    cidade: "Parazinho",
    cidade_estado: "Parazinho-RN",
    uf: "RN",
    representante: "Sônia",
    lista_preco_uf: "Lista Preço N e NE",
  },
  "TRANSPORTADORA PEREGRINA": {
    cliente_base: "Transportadora Peregrina Ltda",
    cidade: "Fortaleza",
    cidade_estado: "Fortaleza-CE",
    uf: "CE",
    representante: "Sônia",
    lista_preco_uf: "Lista Preço N e NE",
  },
  "FORNECEDORACMR-JANDAIRA": {
    cliente_base: "CMR Brasil Produção e Comercialização Hortofrutícola Ltda",
    cidade: "Jandaíra",
    cidade_estado: "Jandaíra-RN",
    uf: "RN",
    representante: "Sônia",
    lista_preco_uf: "Lista Preço N e NE",
  },
  "SUREÑA": {
    cliente_base: "Sureña Maquinaria Agricola",
    cidade: "Montevideo",
    cidade_estado: "Montevideo-UY",
    uf: "UY",
    representante: "Exportação",
    lista_preco_uf: "Exportação",
  },
};

export function semAcento(txt: any): string {
  if (txt === null || txt === undefined) return "";
  return String(txt)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizarNomeColuna(col: string): string {
  return semAcento(col)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizarTextoComparacao(txt: any): string {
  return semAcento(txt)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function moedaBrParaFloat(valor: any): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return isNaN(valor) ? 0 : valor;
  let texto = String(valor).trim();
  if (!texto) return 0;

  const negativoContabil = texto.includes("(") && texto.includes(")");
  texto = texto.replace(/R\$/g, "").replace(/\s+/g, "").replace(/\u00a0/g, "");
  texto = texto.replace(/\(/g, "").replace(/\)/g, "");

  if (/^[+-]?\d+([,.]\d+)?[Ee][+-]?\d+$/.test(texto)) {
    const num = parseFloat(texto.replace(",", "."));
    return isNaN(num) ? 0 : negativoContabil ? -Math.abs(num) : num;
  }

  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  }
  texto = texto.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(texto);
  if (isNaN(num)) return 0;
  return negativoContabil ? -Math.abs(num) : num;
}

export function numeroBrParaFloat(valor: any): number {
  return moedaBrParaFloat(valor);
}

export function detectarUf(texto: any): string {
  const original = texto === null || texto === undefined ? "" : String(texto).trim();
  const textoSem = semAcento(original).toUpperCase();

  const matchFinal = textoSem.match(/([A-Z]{2})(?:\d+)?$/);
  if (matchFinal && UF_REGIAO[matchFinal[1]]) {
    return matchFinal[1];
  }

  const partes = textoSem.split(/[-\s/_]+/);
  for (let i = partes.length - 1; i >= 0; i--) {
    const p = partes[i].replace(/[^A-Z]/g, "");
    if (UF_REGIAO[p]) return p;
  }

  const compacto = textoSem.replace(/[^A-Z0-9]/g, "");
  for (const [cidade, uf] of Object.entries(CIDADE_UF_HINTS)) {
    const cNorm = semAcento(cidade).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cNorm && compacto.includes(cNorm)) {
      return uf;
    }
  }

  return "Não identificado";
}

export function limparUfFinal(texto: string, uf: string): string {
  if (uf === "Não identificado") return texto.trim();
  const regex = new RegExp(`[-\\s/_]*${uf}(?:\\d+)?\\s*$`, "i");
  return texto.replace(regex, "").replace(/^[-\s/_.]+|[-\s/_.]+$/g, "").trim();
}

export function separarCidadeEstado(texto: any): [string, string] {
  const original = texto === null || texto === undefined ? "" : String(texto).trim();
  if (!original) return ["Não identificado", "Não identificado"];

  const m = original.match(/(.+?)[-\s/]+([A-Za-z]{2})(?:\d+)?$/);
  if (m) {
    const cid = m[1].replace(/^[-\s/_.]+|[-\s/_.]+$/g, "").trim();
    const uf = semAcento(m[2]).toUpperCase();
    if (UF_REGIAO[uf]) {
      return [cid || "Não identificado", uf];
    }
  }

  const uf = detectarUf(original);
  const cid = limparUfFinal(original, uf);
  return [cid || "Não identificado", uf];
}

export function separarClienteCidade(texto: any): [string, string, string] {
  const original = texto === null || texto === undefined ? "" : String(texto).trim();
  const uf = detectarUf(original);
  const semUf = limparUfFinal(original, uf);

  const partes = semUf.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  let clienteBase = semUf || original;
  let cidade = "Não identificado";

  if (partes.length >= 2) {
    clienteBase = partes[0];
    cidade = partes[partes.length - 1];
  }

  if (cidade === "Não identificado") {
    const textoSem = semAcento(original).toUpperCase();
    for (const [cidadeHint] of Object.entries(CIDADE_UF_HINTS)) {
      const cNorm = semAcento(cidadeHint).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (textoSem.replace(/[^A-Z0-9]/g, "").includes(cNorm)) {
        cidade = cidadeHint.charAt(0) + cidadeHint.slice(1).toLowerCase();
        break;
      }
    }
  }

  return [clienteBase, cidade, uf];
}

export function familiaProduto(produto: any): string {
  if (!produto) return "Não identificado";
  const str = String(produto).trim();
  if (!str) return "Não identificado";
  return str.split(/\s+/)[0];
}

export function grupoModelo(produto: any): string {
  const fam = familiaProduto(produto).toUpperCase();
  if (fam.startsWith("CBHM")) return "CBHM";
  if (fam.startsWith("CBH")) return "CBH";
  if (fam.startsWith("CTH")) return "CTH";
  if (fam.startsWith("F")) return "F";
  if (fam.startsWith("FA")) return "FA";
  if (fam.startsWith("MCF")) return "MCF";
  if (fam.startsWith("SEF")) return "SEF";
  if (fam.startsWith("RO")) return "Roçadeiras";
  if (/^\d/.test(fam)) return "Código avulso";
  return fam.slice(0, 12);
}

export function encontrarColuna(dfCols: string[], candidatos: string[]): string | null {
  const mapa = new Map<string, string>();
  for (const c of dfCols) {
    mapa.set(normalizarNomeColuna(c), c);
  }
  for (const cand of candidatos) {
    const chave = normalizarNomeColuna(cand);
    if (mapa.has(chave)) return mapa.get(chave)!;
  }
  for (const cand of candidatos) {
    const chave = normalizarNomeColuna(cand);
    if (!chave) continue;
    for (const [norm, orig] of mapa.entries()) {
      if (norm.includes(chave) || chave.includes(norm)) {
        return orig;
      }
    }
  }
  return null;
}

export function parseDataBr(dataVal: any): Date | null {
  if (!dataVal) return null;
  if (dataVal instanceof Date && !isNaN(dataVal.getTime())) return dataVal;
  const str = String(dataVal).trim();
  if (!str) return null;

  const m1 = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const m = parseInt(m1[2], 10) - 1;
    const y = parseInt(m1[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const m2 = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m2) {
    const y = parseInt(m2[1], 10);
    const m = parseInt(m2[2], 10) - 1;
    const d = parseInt(m2[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function prepararDados(
  linhasRaw: TransacaoRaw[],
  correcoesClientes: Record<string, any> = CLIENTE_INFO_OVERRIDE
): { dados: TransacaoTratada[]; meta: any } {
  if (!linhasRaw || !linhasRaw.length) {
    return { dados: [], meta: { linhas_validas: 0 } };
  }

  const colunasExistentes = Object.keys(linhasRaw[0] || {});
  const colunas = {
    produto: encontrarColuna(colunasExistentes, ["1o. Agrupamento", "agrupamento", "produto", "item", "carreta"]),
    cliente: encontrarColuna(colunasExistentes, ["BAI_PESSOA.CODIGO", "cliente", "pessoa", "cod_cliente"]),
    cidade_planilha: encontrarColuna(colunasExistentes, ["CIDADE", "cidade"]),
    cidade_estado: encontrarColuna(colunasExistentes, ["CIDADE+ ESTADO", "cidade estado", "cidade_estado", "cidade uf", "cidade+estado"]),
    representante: encontrarColuna(colunasExistentes, ["REPRESENTANTE", "representante", "vendedor"]),
    lista_preco_uf: encontrarColuna(colunasExistentes, ["LISTA DE PREÇO UF", "LISTA DE PRECO UF", "lista preco uf", "lista de preco", "lista preço"]),
    descricao_generica: encontrarColuna(colunasExistentes, ["BAI_RECURSO.DESCRICAOGENERICA", "descricao generica", "descricaogenerica"]),
    categoria_produto: encontrarColuna(colunasExistentes, ["BAI_RECURSO.CLASSE.NOME", "classe recurso", "categoria produto", "classe produto"]),
    quantidade: encontrarColuna(colunasExistentes, ["BAI_QUANTIDADE", "quantidade", "qtd"]),
    data_emissao: encontrarColuna(colunasExistentes, ["BAI_EMISSAO", "emissao", "data emissao", "data"]),
    data_movimento: encontrarColuna(colunasExistentes, ["BAI_MOVIMENTAC", "movimentac", "movimentacao"]),
    tipo_venda: encontrarColuna(colunasExistentes, ["BAI_CLASSE.NOME", "classe nome", "tipo venda", "tipo"]),
    pedido: encontrarColuna(colunasExistentes, ["BAI_NUMERO", "numero", "pedido", "nota"]),
    custo: encontrarColuna(colunasExistentes, ["BAI_CUSTOCONT", "custo", "custo cont"]),
    total: encontrarColuna(colunasExistentes, ["BAI_TOTAL", "total", "valor", "faturamento"]),
    frete: encontrarColuna(colunasExistentes, ["BAI_FRETE", "frete"]),
    ipi: encontrarColuna(colunasExistentes, ["BAI_IPI", "ipi"]),
    pis: encontrarColuna(colunasExistentes, ["BAI_PIS", "pis"]),
    cofins: encontrarColuna(colunasExistentes, ["BAI_COFINS", "cofins"]),
    icms: encontrarColuna(colunasExistentes, ["BAI_ICMS", "icms"]),
    iss: encontrarColuna(colunasExistentes, ["BAI_ISS", "iss"]),
    ir: encontrarColuna(colunasExistentes, ["BAI_IR", "ir"]),
    inss: encontrarColuna(colunasExistentes, ["BAI_INSS", "inss"]),
    ii: encontrarColuna(colunasExistentes, ["BAI_II", "ii", "imposto importacao"]),
    acessorio0: encontrarColuna(colunasExistentes, ["BAI_ACESSORI0", "acessori0", "acessorio0", "acessório0"]),
    acessorio1: encontrarColuna(colunasExistentes, ["BAI_ACESSORI1", "acessori1", "acessorio1", "acessório1"]),
  };

  const diasSemanaMap: Record<number, string> = {
    0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado",
  };

  const dadosTratados: TransacaoTratada[] = [];
  let cabecalhoIgnorado = 0;
  let semDataIgnorado = 0;

  for (let idx = 0; idx < linhasRaw.length; idx++) {
    const row = linhasRaw[idx];
    const prodVal = colunas.produto ? String(row[colunas.produto] ?? "").trim() : "";
    const cliVal = colunas.cliente ? String(row[colunas.cliente] ?? "").trim() : "";
    const dataVal = colunas.data_emissao ? row[colunas.data_emissao] : null;

    if (prodVal === colunas.produto || cliVal === colunas.cliente) {
      cabecalhoIgnorado++;
      continue;
    }

    const dtEmissao = parseDataBr(dataVal);
    if (!dtEmissao) {
      semDataIgnorado++;
      continue;
    }

    let produto = prodVal;
    let cliente = cliVal;
    let descGenerica = colunas.descricao_generica ? String(row[colunas.descricao_generica] ?? "").trim() : "Não informado";
    let catProduto = colunas.categoria_produto ? String(row[colunas.categoria_produto] ?? "").trim() : "Não informado";
    let tipoVenda = colunas.tipo_venda ? String(row[colunas.tipo_venda] ?? "").trim() : "Não informado";
    let cidPlanilha = colunas.cidade_planilha ? String(row[colunas.cidade_planilha] ?? "").trim() : "";
    let cidEstado = colunas.cidade_estado ? String(row[colunas.cidade_estado] ?? "").trim() : "";
    let representante = colunas.representante ? String(row[colunas.representante] ?? "").trim() : "Não informado";
    let listaPreco = colunas.lista_preco_uf ? String(row[colunas.lista_preco_uf] ?? "").trim() : "Não informado";
    let pedido = colunas.pedido && row[colunas.pedido] ? String(row[colunas.pedido]).trim() : String(idx + 1);

    if (!representante) representante = "Não informado";
    if (!listaPreco) listaPreco = "Não informado";

    const normCliente = normalizarTextoComparacao(cliente);
    for (const [k, override] of Object.entries(correcoesClientes)) {
      if (normalizarTextoComparacao(k) === normCliente) {
        if (override.cidade) cidPlanilha = override.cidade;
        if (override.cidade_estado) cidEstado = override.cidade_estado;
        if (override.representante) representante = override.representante;
        if (override.lista_preco_uf) listaPreco = override.lista_preco_uf;
        break;
      }
    }

    const [cliBaseAuto, cidCli, ufCli] = separarClienteCidade(cliente);
    const [cidCad, ufCad] = separarCidadeEstado(cidEstado);

    let cidade = cidPlanilha || (cidCad !== "Não identificado" ? cidCad : cidCli);
    if (!cidade || cidade === "") cidade = "Não identificado";

    let uf = ufCad !== "Não identificado" ? ufCad : ufCli;
    if (!uf || uf === "") uf = "Não identificado";

    let clienteBase = cliBaseAuto;

    for (const [k, override] of Object.entries(correcoesClientes)) {
      if (normalizarTextoComparacao(k) === normCliente) {
        if (override.cliente_base) clienteBase = override.cliente_base;
        if (override.cidade) cidade = override.cidade;
        if (override.uf) uf = override.uf;
        break;
      }
    }

    const regiao = UF_REGIAO[uf] || "Não identificado";

    const quantidade = colunas.quantidade ? numeroBrParaFloat(row[colunas.quantidade]) : 0;
    const faturamento = colunas.total ? moedaBrParaFloat(row[colunas.total]) : 0;
    const custo = colunas.custo ? moedaBrParaFloat(row[colunas.custo]) : 0;
    const frete = colunas.frete ? moedaBrParaFloat(row[colunas.frete]) : 0;
    const ipi = colunas.ipi ? moedaBrParaFloat(row[colunas.ipi]) : 0;
    const pis = colunas.pis ? moedaBrParaFloat(row[colunas.pis]) : 0;
    const cofins = colunas.cofins ? moedaBrParaFloat(row[colunas.cofins]) : 0;
    const icms = colunas.icms ? moedaBrParaFloat(row[colunas.icms]) : 0;
    const iss = colunas.iss ? moedaBrParaFloat(row[colunas.iss]) : 0;
    const ir = colunas.ir ? moedaBrParaFloat(row[colunas.ir]) : 0;
    const inss = colunas.inss ? moedaBrParaFloat(row[colunas.inss]) : 0;
    const ii = colunas.ii ? moedaBrParaFloat(row[colunas.ii]) : 0;
    const acessorio0 = colunas.acessorio0 ? moedaBrParaFloat(row[colunas.acessorio0]) : 0;
    const acessorio1 = colunas.acessorio1 ? moedaBrParaFloat(row[colunas.acessorio1]) : 0;

    const tributosDre = ipi + pis + cofins + icms + iss + ir + inss + ii;
    const acessoriosDre = acessorio0 + acessorio1;
    const impostosPrincipais = ipi + pis + cofins + icms;
    const fatLiquidoAprox = faturamento - tributosDre - frete;

    const ano = dtEmissao.getFullYear();
    const mesNum = dtEmissao.getMonth() + 1;
    const mes = MESES[mesNum] || `M${mesNum}`;
    const mesCompleto = MESES_COMPLETOS[mesNum] || "";
    const anoMes = `${ano}-${String(mesNum).padStart(2, "0")}`;
    const anoMesData = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
    const trimestre = `T${Math.floor((mesNum - 1) / 3) + 1}`;
    const semestre = mesNum <= 6 ? "1º semestre" : "2º semestre";
    const diaSemana = diasSemanaMap[dtEmissao.getDay()] || "";
    const diaMes = dtEmissao.getDate();

    const qtdTicket = quantidade > 0 ? quantidade : 0;
    const fatTicket = quantidade > 0 ? faturamento : 0;
    const ticketUnitario = quantidade > 0 ? faturamento / quantidade : 0;
    const linhasQtdNaoPositiva = quantidade <= 0 ? 1 : 0;

    const familia = familiaProduto(produto);
    const grupo = grupoModelo(produto);

    dadosTratados.push({
      id: `${pedido}_${idx}`,
      produto,
      cliente,
      cliente_base: clienteBase,
      cidade,
      cidade_planilha: cidPlanilha,
      cidade_estado: cidEstado,
      uf,
      regiao,
      representante,
      lista_preco_uf: listaPreco,
      descricao_generica: descGenerica,
      categoria_produto: catProduto,
      tipo_venda: tipoVenda,
      pedido,
      data_emissao: dtEmissao,
      data_str: dtEmissao.toLocaleDateString("pt-BR"),
      ano,
      mes_num: mesNum,
      mes,
      mes_completo: mesCompleto,
      ano_mes: anoMes,
      ano_mes_data: anoMesData,
      trimestre,
      semestre,
      dia_semana: diaSemana,
      dia_mes: diaMes,
      quantidade,
      faturamento,
      quantidade_ticket: qtdTicket,
      faturamento_ticket: fatTicket,
      ticket_unitario: ticketUnitario,
      linhas_qtd_nao_positiva: linhasQtdNaoPositiva,
      custo,
      frete,
      ipi,
      pis,
      cofins,
      icms,
      iss,
      ir,
      inss,
      ii,
      acessorio0,
      acessorio1,
      impostos_principais: impostosPrincipais,
      tributos_dre: tributosDre,
      acessorios_dre: acessoriosDre,
      faturamento_liquido_aprox: fatLiquidoAprox,
      familia,
      grupo_modelo: grupo,
    });
  }

  const datas = dadosTratados.map((d) => d.data_emissao.getTime()).sort((a, b) => a - b);
  const dataMin = datas.length ? new Date(datas[0]) : new Date();
  const dataMax = datas.length ? new Date(datas[datas.length - 1]) : new Date();

  return {
    dados: dadosTratados,
    meta: {
      linhas_originais: linhasRaw.length,
      linhas_cabecalho_removidas: cabecalhoIgnorado,
      linhas_sem_data_removidas: semDataIgnorado,
      linhas_validas: dadosTratados.length,
      data_min: dataMin,
      data_max: dataMax,
      formas_venda_disponiveis: Array.from(new Set(dadosTratados.map((d) => d.tipo_venda))).sort(),
      familias_disponiveis: Array.from(new Set(dadosTratados.map((d) => d.familia))).sort(),
    },
  };
}

export function formatarMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function formatarInteiro(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
}

export function formatarPercentual(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
}

export function valorCompactoMapa(valor: number): string {
  if (!valor || isNaN(valor) || valor <= 0) return "-";
  if (valor >= 1_000_000_000) {
    return `R$ ${(valor / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  }
  if (valor >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  }
  if (valor >= 1_000) {
    return `R$ ${(valor / 1_000).toFixed(0).replace(".", ",")} mil`;
  }
  return formatarMoeda(valor);
}

export function valorResumido(v: number | null | undefined, comMoeda: boolean = false): string {
  if (v === null || v === undefined || isNaN(v)) return "-";
  const absV = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  const pref = comMoeda ? "R$ " : "";
  if (absV >= 1_000_000_000) {
    return `${sinal}${pref}${(absV / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  }
  if (absV >= 1_000_000) {
    return `${sinal}${pref}${(absV / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  }
  if (absV >= 1_000) {
    return `${sinal}${pref}${(absV / 1_000).toFixed(1).replace(".", ",")} mil`;
  }
  return `${sinal}${pref}${absV.toFixed(0)}`;
}

export function agregar(
  dados: TransacaoTratada[],
  chaves: string[]
): ResumoAgregado[] {
  if (!dados.length) return [];

  const grupos = new Map<string, { transacoes: TransacaoTratada[]; chaveValores: Record<string, any> }>();

  for (const item of dados) {
    const k = chaves.map((c) => String((item as any)[c] ?? "")).join("___");
    if (!grupos.has(k)) {
      const chaveValores: Record<string, any> = {};
      for (const c of chaves) {
        chaveValores[c] = (item as any)[c];
      }
      grupos.set(k, { transacoes: [], chaveValores });
    }
    grupos.get(k)!.transacoes.push(item);
  }

  const resultado: ResumoAgregado[] = [];

  for (const entry of Array.from(grupos.values())) {
    const { transacoes, chaveValores } = entry;
    let faturamento = 0;
    let quantidade = 0;
    let quantidadeTicket = 0;
    let faturamentoTicket = 0;
    let linhasQtdNaoPositiva = 0;
    const pedidosSet = new Set<string>();
    const clientesSet = new Set<string>();

    for (const t of transacoes) {
      faturamento += t.faturamento;
      quantidade += t.quantidade;
      quantidadeTicket += t.quantidade_ticket;
      faturamentoTicket += t.faturamento_ticket;
      linhasQtdNaoPositiva += t.linhas_qtd_nao_positiva;
      if (t.pedido) pedidosSet.add(t.pedido);
      if (t.cliente) clientesSet.add(t.cliente);
    }

    const pedidos = pedidosSet.size;
    const clientes = clientesSet.size;
    const linhas = transacoes.length;
    const valorMedioPedido = pedidos > 0 ? faturamento / pedidos : 0;
    const ticketUnitarioCalc = quantidadeTicket > 0 ? faturamentoTicket / quantidadeTicket : 0;

    resultado.push({
      ...chaveValores,
      faturamento,
      quantidade,
      quantidade_ticket: quantidadeTicket,
      faturamento_ticket: faturamentoTicket,
      pedidos,
      linhas,
      clientes,
      ticket_unitario_calc: ticketUnitarioCalc,
      valor_medio_pedido: valorMedioPedido,
      linhas_qtd_nao_positiva: linhasQtdNaoPositiva,
    });
  }

  return resultado;
}

export function curvaAbc(
  dados: TransacaoTratada[],
  dimensao: string,
  metrica: string = "faturamento"
): any[] {
  if (!dados.length) return [];
  const resumo = agregar(dados, [dimensao]);
  resumo.sort((a, b) => ((b as any)[metrica] || 0) - ((a as any)[metrica] || 0));

  const total = resumo.reduce((sum, item) => sum + ((item as any)[metrica] || 0), 0);
  let acumulado = 0;

  return resumo.map((item, idx) => {
    const val = (item as any)[metrica] || 0;
    const part = total > 0 ? val / total : 0;
    acumulado += part;
    let classe = "C";
    if (acumulado <= 0.8 || idx === 0) {
      classe = "A";
    } else if (acumulado <= 0.95) {
      classe = "B";
    }
    return {
      ...item,
      participacao: part,
      participacao_acumulada: acumulado,
      classe_abc: classe,
    };
  });
}

export function classificarCarteiraClientes(
  dados: TransacaoTratada[],
  refDate?: Date
): any[] {
  if (!dados.length) return [];
  const baseValida = dados.filter((d) => d.quantidade_ticket > 0);
  if (!baseValida.length) return [];

  const ref = refDate ? refDate.getTime() : Math.max(...baseValida.map((d) => d.data_emissao.getTime()));

  const clientesMap = new Map<string, TransacaoTratada[]>();
  for (const d of baseValida) {
    if (!clientesMap.has(d.cliente)) clientesMap.set(d.cliente, []);
    clientesMap.get(d.cliente)!.push(d);
  }

  const linhas: any[] = [];

  for (const entry of Array.from(clientesMap.entries())) {
    const cliente = entry[0];
    const trans = entry[1];
    trans.sort((a: TransacaoTratada, b: TransacaoTratada) => a.data_emissao.getTime() - b.data_emissao.getTime());
    const primeira = trans[0].data_emissao;
    const ultima = trans[trans.length - 1].data_emissao;

    const datasUnicas: number[] = Array.from(
      new Set(trans.map((t: TransacaoTratada) => new Date(t.data_emissao.getFullYear(), t.data_emissao.getMonth(), t.data_emissao.getDate()).getTime()))
    ).sort((a: number, b: number) => a - b);

    const gaps: number[] = [];
    for (let i = 1; i < datasUnicas.length; i++) {
      gaps.push(Math.round((datasUnicas[i] - datasUnicas[i - 1]) / (1000 * 60 * 60 * 24)));
    }

    const intervaloMedio = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    const ultimoGap = gaps.length ? gaps[gaps.length - 1] : null;

    const diasSemCompra = Math.max(0, Math.round((ref - ultima.getTime()) / (1000 * 60 * 60 * 24)));
    const diasDesdePrimeira = Math.max(0, Math.round((ref - primeira.getTime()) / (1000 * 60 * 60 * 24)));

    const limiarAtencao = Math.max(45, intervaloMedio ? intervaloMedio * 1.5 : 60);
    const limiarInativo = Math.max(90, intervaloMedio ? intervaloMedio * 2.5 : 90);

    const pedidosUnicos = new Set(trans.map((t: TransacaoTratada) => t.pedido)).size;
    const mesesUnicos = new Set(trans.map((t: TransacaoTratada) => t.ano_mes)).size;
    const faturamento = trans.reduce((s: number, t: TransacaoTratada) => s + t.faturamento, 0);
    const quantidade = trans.reduce((s: number, t: TransacaoTratada) => s + t.quantidade, 0);

    let status = "Compra única";
    if (diasSemCompra > limiarInativo) {
      status = "Inativo";
    } else if (diasSemCompra > limiarAtencao) {
      status = "Em atenção";
    } else if (ultimoGap !== null && ultimoGap >= 60 && diasSemCompra <= 45) {
      status = "Recuperado";
    } else if (diasDesdePrimeira <= 45) {
      status = "Novo";
    } else if (pedidosUnicos >= 2) {
      status = "Recorrente";
    }

    const ult = trans[trans.length - 1];

    linhas.push({
      cliente,
      primeira_compra: primeira.toLocaleDateString("pt-BR"),
      ultima_compra: ultima.toLocaleDateString("pt-BR"),
      dias_sem_compra: diasSemCompra,
      pedidos: pedidosUnicos,
      meses_com_compra: mesesUnicos,
      faturamento,
      quantidade,
      intervalo_medio_dias: intervaloMedio ? Math.round(intervaloMedio) : "-",
      status,
      representante: ult.representante,
      uf: ult.uf,
      regiao: ult.regiao,
    });
  }

  linhas.sort((a, b) => b.faturamento - a.faturamento);
  return linhas;
}

export function dreAproximada(dados: TransacaoTratada[], dimensoes: string[] = []): any[] {
  if (!dados.length) return [];

  if (!dimensoes.length) {
    let faturamento = 0;
    let custo = 0;
    let tributos = 0;
    let frete = 0;
    let acessorios = 0;

    for (const d of dados) {
      faturamento += d.faturamento;
      custo += d.custo;
      tributos += d.tributos_dre;
      frete += d.frete;
      acessorios += d.acessorios_dre;
    }

    const receitaLiquida = faturamento - tributos - frete - acessorios;
    const resultadoAprox = receitaLiquida - custo;
    const margem = faturamento > 0 ? resultadoAprox / faturamento : 0;

    return [
      {
        faturamento,
        custo,
        tributos,
        frete,
        acessorios,
        receita_liquida_aprox: receitaLiquida,
        resultado_aprox: resultadoAprox,
        margem_aprox_pct: margem,
      },
    ];
  }

  const mapa = new Map<string, any>();
  for (const d of dados) {
    const k = dimensoes.map((c) => String((d as any)[c] ?? "")).join("___");
    if (!mapa.has(k)) {
      const obj: any = {};
      for (const c of dimensoes) obj[c] = (d as any)[c];
      obj.faturamento = 0;
      obj.custo = 0;
      obj.tributos = 0;
      obj.frete = 0;
      obj.acessorios = 0;
      mapa.set(k, obj);
    }
    const item = mapa.get(k);
    item.faturamento += d.faturamento;
    item.custo += d.custo;
    item.tributos += d.tributos_dre;
    item.frete += d.frete;
    item.acessorios += d.acessorios_dre;
  }

  const res = Array.from(mapa.values()).map((row) => {
    const receitaLiquida = row.faturamento - row.tributos - row.frete - row.acessorios;
    const resultadoAprox = receitaLiquida - row.custo;
    const margem = row.faturamento > 0 ? resultadoAprox / row.faturamento : 0;
    return {
      ...row,
      receita_liquida_aprox: receitaLiquida,
      resultado_aprox: resultadoAprox,
      margem_aprox_pct: margem,
    };
  });

  res.sort((a, b) => b.resultado_aprox - a.resultado_aprox);
  return res;
}

export function compararPeriodos(
  dados: TransacaoTratada[],
  inicioA: Date,
  fimA: Date,
  inicioB: Date,
  fimB: Date,
  dimensao: string,
  metrica: string = "faturamento"
): { resumo: any; detalhe: any[] } {
  const tIniA = inicioA.getTime();
  const tFimA = fimA.getTime();
  const tIniB = inicioB.getTime();
  const tFimB = fimB.getTime();

  const dadosA = dados.filter((d) => d.data_emissao.getTime() >= tIniA && d.data_emissao.getTime() <= tFimA);
  const dadosB = dados.filter((d) => d.data_emissao.getTime() >= tIniB && d.data_emissao.getTime() <= tFimB);

  const calcTotal = (itens: TransacaoTratada[]) => {
    if (metrica === "pedidos") return new Set(itens.map((d) => d.pedido)).size;
    if (metrica === "clientes") return new Set(itens.map((d) => d.cliente)).size;
    return itens.reduce((s, d) => s + ((d as any)[metrica] || 0), 0);
  };

  const valorA = calcTotal(dadosA);
  const valorB = calcTotal(dadosB);
  const varAbs = valorB - valorA;
  const varPct = valorA !== 0 ? varAbs / valorA : 0;

  const agrecA = agregar(dadosA, [dimensao]);
  const agrecB = agregar(dadosB, [dimensao]);

  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  for (const item of agrecA) {
    const k = String((item as any)[dimensao]);
    const v = metrica === "pedidos" ? item.pedidos : metrica === "clientes" ? item.clientes : (item as any)[metrica];
    mapA.set(k, v);
  }
  for (const item of agrecB) {
    const k = String((item as any)[dimensao]);
    const v = metrica === "pedidos" ? item.pedidos : metrica === "clientes" ? item.clientes : (item as any)[metrica];
    mapB.set(k, v);
  }

  const todasChaves = Array.from(new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys())]));
  const detalhe: any[] = [];

  for (const ch of todasChaves) {
    const vA = mapA.get(ch) || 0;
    const vB = mapB.get(ch) || 0;
    const dAbs = vB - vA;
    const dPct = vA !== 0 ? dAbs / vA : 0;
    const contrib = varAbs !== 0 ? dAbs / varAbs : 0;

    detalhe.push({
      [dimensao]: ch,
      valor_a: vA,
      valor_b: vB,
      variacao_abs: dAbs,
      variacao_pct: dPct,
      contribuicao_variacao: contrib,
      impacto_abs: Math.abs(dAbs),
    });
  }

  detalhe.sort((a, b) => b.impacto_abs - a.impacto_abs);

  return {
    resumo: {
      valor_a: valorA,
      valor_b: valorB,
      variacao_abs: varAbs,
      variacao_pct: varPct,
      linhas_a: dadosA.length,
      linhas_b: dadosB.length,
    },
    detalhe,
  };
}

export function gerarAlertasComerciais(dados: TransacaoTratada[]): any[] {
  if (!dados.length) return [];
  const alertas: any[] = [];

  const abcCli = curvaAbc(dados, "cliente", "faturamento");
  const top10Fat = abcCli.slice(0, 10).reduce((s, c) => s + c.faturamento, 0);
  const totalFat = abcCli.reduce((s, c) => s + c.faturamento, 0);
  const concTop10 = totalFat > 0 ? top10Fat / totalFat : 0;

  if (concTop10 >= 0.5) {
    alertas.push({
      nivel: "Atenção",
      tipo: "Concentração",
      mensagem: `Os 10 maiores clientes concentram ${(concTop10 * 100).toFixed(1)}% do faturamento total.`,
      valor: concTop10,
      referencia: "Top 10 clientes",
    });
  }

  const carteira = classificarCarteiraClientes(dados);
  if (carteira.length) {
    const fatValores = carteira.map((c) => c.faturamento).sort((a, b) => a - b);
    const p80 = fatValores[Math.floor(fatValores.length * 0.8)] || 0;
    const risco = carteira.filter((c) => c.faturamento >= p80 && (c.status === "Em atenção" || c.status === "Inativo")).slice(0, 8);
    for (const r of risco) {
      alertas.push({
        nivel: r.status === "Inativo" ? "Crítico" : "Atenção",
        tipo: "Cliente em risco",
        mensagem: `${r.cliente} está ${r.dias_sem_compra} dias sem comprar e possui faturamento histórico de ${formatarMoeda(r.faturamento)}.`,
        valor: r.faturamento,
        referencia: r.cliente,
      });
    }
  }

  const dre = dreAproximada(dados);
  if (dre.length && dre[0].resultado_aprox < 0) {
    alertas.push({
      nivel: "Crítico",
      tipo: "Resultado aproximado",
      mensagem: `O resultado gerencial aproximado do período está negativo em ${formatarMoeda(dre[0].resultado_aprox)}.`,
      valor: dre[0].resultado_aprox,
      referencia: "Período filtrado",
    });
  }

  if (!alertas.length) {
    alertas.push({
      nivel: "Informativo",
      tipo: "Sem alertas fortes",
      mensagem: "Nenhuma regra automática ultrapassou os limiares críticos configurados.",
      valor: 0,
      referencia: "Período filtrado",
    });
  }

  return alertas;
}

export function exportarTabelaExcel(tabela: any[], nomeArquivo: string = "exportacao.xlsx", nomeAba: string = "Dados") {
  if (!tabela || !tabela.length) return;
  const ws = XLSX.utils.json_to_sheet(tabela);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31));
  XLSX.writeFile(wb, nomeArquivo);
}

export function exportarTabelaCsv(tabela: any[], nomeArquivo: string = "exportacao.csv") {
  if (!tabela || !tabela.length) return;
  const csv = Papa.unparse(tabela, { delimiter: ";" });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


export function concentracaoTop(tabela: any[], metrica: string = "faturamento") {
  if (!tabela.length) return { top_5: 0, top_10: 0, top_20: 0 };
  const total = tabela.reduce((s: number, row: any) => s + (Number(row[metrica]) || 0), 0);
  if (!total) return { top_5: 0, top_10: 0, top_20: 0 };
  return {
    top_5: tabela.slice(0, 5).reduce((s: number, row: any) => s + (Number(row[metrica]) || 0), 0) / total,
    top_10: tabela.slice(0, 10).reduce((s: number, row: any) => s + (Number(row[metrica]) || 0), 0) / total,
    top_20: tabela.slice(0, 20).reduce((s: number, row: any) => s + (Number(row[metrica]) || 0), 0) / total,
  };
}

export function mixClientes(dados: TransacaoTratada[]): any[] {
  const positivos = dados.filter((d) => d.quantidade_ticket > 0);
  const mapa = new Map<string, TransacaoTratada[]>();
  for (const d of positivos) {
    if (!mapa.has(d.cliente)) mapa.set(d.cliente, []);
    mapa.get(d.cliente)!.push(d);
  }
  return Array.from(mapa.entries()).map(([cliente, rows]) => {
    const familias = new Set(rows.map((d) => d.familia)).size;
    const produtos = new Set(rows.map((d) => d.produto)).size;
    const faturamento = rows.reduce((s, d) => s + d.faturamento, 0);
    return {
      cliente,
      familias,
      produtos,
      faturamento,
      quantidade: rows.reduce((s, d) => s + d.quantidade, 0),
      pedidos: new Set(rows.map((d) => d.pedido)).size,
      ultima_compra: rows.reduce((max, d) => Math.max(max, d.data_emissao.getTime()), 0),
      faturamento_por_familia: familias ? faturamento / familias : 0,
    };
  }).sort((a, b) => a.familias - b.familias || b.faturamento - a.faturamento);
}

export function oportunidadesCrossSell(dados: TransacaoTratada[], cliente: string, nivel: "familia" | "produto" = "familia", topN = 15): any[] {
  const positivos = dados.filter((d) => d.quantidade_ticket > 0);
  const totalClientes = Math.max(new Set(positivos.map((d) => d.cliente)).size, 1);
  const comprados = new Set(positivos.filter((d) => d.cliente === cliente).map((d) => String((d as any)[nivel])));
  const mapa = new Map<string, { clientes: Set<string>; faturamento: number; quantidade: number }>();
  for (const d of positivos) {
    const item = String((d as any)[nivel]);
    if (!mapa.has(item)) mapa.set(item, { clientes: new Set(), faturamento: 0, quantidade: 0 });
    const v = mapa.get(item)!;
    v.clientes.add(d.cliente);
    v.faturamento += d.faturamento_ticket;
    v.quantidade += d.quantidade_ticket;
  }
  return Array.from(mapa.entries())
    .filter(([item]) => !comprados.has(item))
    .map(([item, v]) => ({
      item,
      clientes_compradores: v.clientes.size,
      penetracao_clientes: v.clientes.size / totalClientes,
      faturamento_global: v.faturamento,
      quantidade_global: v.quantidade,
    }))
    .sort((a, b) => b.clientes_compradores - a.clientes_compradores || b.faturamento_global - a.faturamento_global)
    .slice(0, topN);
}

export function paresCompradosJuntos(dados: TransacaoTratada[], nivel: "familia" | "produto" = "familia", topN = 30): any[] {
  const positivos = dados.filter((d) => d.quantidade_ticket > 0);
  const pares = new Map<string, { pedidos: Set<string>; clientes: Set<string> }>();
  const porPedido = new Map<string, TransacaoTratada[]>();
  for (const d of positivos) {
    const key = `${d.cliente}::${d.pedido}`;
    if (!porPedido.has(key)) porPedido.set(key, []);
    porPedido.get(key)!.push(d);
  }
  for (const [pedidoKey, rows] of porPedido.entries()) {
    const itens = Array.from(new Set(rows.map((d) => String((d as any)[nivel])))).sort();
    for (let i = 0; i < itens.length; i++) {
      for (let j = i + 1; j < itens.length; j++) {
        const key = `${itens[i]}|||${itens[j]}`;
        if (!pares.has(key)) pares.set(key, { pedidos: new Set(), clientes: new Set() });
        const v = pares.get(key)!;
        v.pedidos.add(pedidoKey);
        v.clientes.add(rows[0].cliente);
      }
    }
  }
  return Array.from(pares.entries()).map(([key, v]) => {
    const [item_a, item_b] = key.split("|||");
    return { item_a, item_b, pedidos_juntos: v.pedidos.size, clientes_juntos: v.clientes.size };
  }).sort((a, b) => b.pedidos_juntos - a.pedidos_juntos || b.clientes_juntos - a.clientes_juntos).slice(0, topN);
}

export function precoMedioPorItem(dados: TransacaoTratada[], nivel: "produto" | "familia" = "produto"): any[] {
  const positivos = dados.filter((d) => d.quantidade_ticket > 0);
  const mapa = new Map<string, TransacaoTratada[]>();
  for (const d of positivos) {
    const key = String((d as any)[nivel]);
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(d);
  }
  return Array.from(mapa.entries()).map(([item, rows]) => {
    const quantidade = rows.reduce((s, d) => s + d.quantidade_ticket, 0);
    const faturamento = rows.reduce((s, d) => s + d.faturamento_ticket, 0);
    return { [nivel]: item, quantidade, faturamento, clientes: new Set(rows.map((d) => d.cliente)).size, pedidos: new Set(rows.map((d) => d.pedido)).size, preco_medio: quantidade ? faturamento / quantidade : 0 };
  }).sort((a, b) => b.faturamento - a.faturamento);
}

export function desviosPreco(dados: TransacaoTratada[], nivel: "produto" | "familia" = "produto", parceiro: "cliente" | "representante" = "cliente", limiarPct = 0.15): any[] {
  const positivos = dados.filter((d) => d.quantidade_ticket > 0);
  const geral = new Map<string, { fat: number; qtd: number }>();
  const grupos = new Map<string, { fat: number; qtd: number; pedidos: Set<string> }>();
  for (const d of positivos) {
    const item = String((d as any)[nivel]);
    const part = String((d as any)[parceiro]);
    if (!geral.has(item)) geral.set(item, { fat: 0, qtd: 0 });
    geral.get(item)!.fat += d.faturamento_ticket;
    geral.get(item)!.qtd += d.quantidade_ticket;
    const k = `${item}|||${part}`;
    if (!grupos.has(k)) grupos.set(k, { fat: 0, qtd: 0, pedidos: new Set() });
    const g = grupos.get(k)!;
    g.fat += d.faturamento_ticket;
    g.qtd += d.quantidade_ticket;
    g.pedidos.add(d.pedido);
  }
  return Array.from(grupos.entries()).map(([k, g]) => {
    const [item, part] = k.split("|||");
    const base = geral.get(item)!;
    const precoItem = base.qtd ? base.fat / base.qtd : 0;
    const precoGrupo = g.qtd ? g.fat / g.qtd : 0;
    return { [nivel]: item, [parceiro]: part, faturamento: g.fat, quantidade: g.qtd, pedidos: g.pedidos.size, preco_medio_grupo: precoGrupo, preco_medio_item: precoItem, desvio_pct: precoItem ? precoGrupo / precoItem - 1 : 0 };
  }).filter((r) => Math.abs(r.desvio_pct) >= limiarPct).sort((a, b) => Math.abs(b.desvio_pct) - Math.abs(a.desvio_pct) || b.faturamento - a.faturamento);
}

export function resumoDiarioInteligencia(dados: TransacaoTratada[]): any[] {
  const mapa = new Map<string, TransacaoTratada[]>();
  for (const d of dados) {
    const key = d.data_emissao.toISOString().slice(0, 10);
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(d);
  }
  return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([data, rows]) => {
    const dt = new Date(`${data}T00:00:00`);
    return { data, faturamento: rows.reduce((s, d) => s + d.faturamento, 0), quantidade: rows.reduce((s, d) => s + d.quantidade, 0), pedidos: new Set(rows.map((d) => d.pedido)).size, clientes: new Set(rows.map((d) => d.cliente)).size, dia_semana_num: dt.getDay() === 0 ? 6 : dt.getDay() - 1, dia_semana: rows[0].dia_semana, dia_mes: dt.getDate(), ano: dt.getFullYear(), mes_num: dt.getMonth() + 1, ano_mes: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` };
  });
}

export function painelRepresentantesInteligencia(dados: TransacaoTratada[], carteira: any[] = []): any[] {
  const res = agregar(dados, ["representante"]);
  return res.map((row) => {
    const clientesRep = new Set(dados.filter((d) => d.representante === row.representante).map((d) => d.cliente));
    const concentracao = Array.from(new Map(dados.filter((d) => d.representante === row.representante).map((d) => [d.cliente, d.faturamento])).entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).reduce((s, x) => s + x[1], 0);
    const clientesTotal = dados.filter((d) => d.representante === row.representante).reduce((s, d) => s + d.faturamento, 0);
    const car = carteira.filter((c) => c.representante === row.representante);
    return { ...row, clientes_ativos: car.filter((c) => !["Em atenção", "Inativo"].includes(c.status)).length || clientesRep.size, clientes_atencao: car.filter((c) => c.status === "Em atenção").length, clientes_inativos: car.filter((c) => c.status === "Inativo").length, concentracao_top5_clientes: clientesTotal ? concentracao / clientesTotal : 0 };
  }).sort((a, b) => b.faturamento - a.faturamento);
}

export function movimentoClientesMes(dados: TransacaoTratada[], ano: number, mes: number) {
  const inicio = new Date(ano, mes - 1, 1).getTime();
  const fim = new Date(ano, mes, 0, 23, 59, 59).getTime();
  const anteriorInicio = new Date(ano, mes - 2, 1).getTime();
  const anteriorFim = inicio - 1;
  const atuais = new Set(dados.filter((d) => d.data_emissao.getTime() >= inicio && d.data_emissao.getTime() <= fim).map((d) => d.cliente));
  const anteriores = new Set(dados.filter((d) => d.data_emissao.getTime() >= anteriorInicio && d.data_emissao.getTime() <= anteriorFim).map((d) => d.cliente));
  const historicos = new Set(dados.filter((d) => d.data_emissao.getTime() < inicio).map((d) => d.cliente));
  const novos = Array.from(atuais).filter((c) => !historicos.has(c));
  const recorrentes = Array.from(atuais).filter((c) => anteriores.has(c));
  const recuperados = Array.from(atuais).filter((c) => historicos.has(c) && !anteriores.has(c) && dados.filter((d) => d.cliente === c && d.data_emissao.getTime() < inicio).some((d) => inicio - d.data_emissao.getTime() >= 45 * 86400000));
  const perdidos = Array.from(anteriores).filter((c) => !atuais.has(c));
  return { novos, recorrentes, recuperados, perdidos, ativos_mes: Array.from(atuais) };
}

export function fechamentoMensalInteligencia(dados: TransacaoTratada[], ano: number, mes: number) {
  const inicio = new Date(ano, mes - 1, 1).getTime();
  const fim = new Date(ano, mes, 0, 23, 59, 59).getTime();
  const anteriorInicio = new Date(ano, mes - 2, 1).getTime();
  const anteriorFim = inicio - 1;
  const atual = dados.filter((d) => d.data_emissao.getTime() >= inicio && d.data_emissao.getTime() <= fim);
  const anterior = dados.filter((d) => d.data_emissao.getTime() >= anteriorInicio && d.data_emissao.getTime() <= anteriorFim);
  const faturamento = atual.reduce((s, d) => s + d.faturamento, 0);
  const fatAnt = anterior.reduce((s, d) => s + d.faturamento, 0);
  const pedidos = new Set(atual.map((d) => d.pedido)).size;
  return {
    resumo: atual.length ? { faturamento, faturamento_anterior: fatAnt, variacao_faturamento_abs: faturamento - fatAnt, variacao_faturamento_pct: fatAnt ? faturamento / fatAnt - 1 : 0, quantidade: atual.reduce((s, d) => s + d.quantidade, 0), pedidos, clientes: new Set(atual.map((d) => d.cliente)).size, ticket_unitario: atual.reduce((s, d) => s + d.quantidade, 0) ? faturamento / atual.reduce((s, d) => s + d.quantidade, 0) : 0, valor_medio_pedido: pedidos ? faturamento / pedidos : 0 } : {},
    movimentos: movimentoClientesMes(dados, ano, mes),
    top_clientes: agregar(atual, ["cliente"]).sort((a, b) => b.faturamento - a.faturamento).slice(0, 20),
    top_produtos: agregar(atual, ["produto"]).sort((a, b) => b.faturamento - a.faturamento).slice(0, 20),
    dre: dreAproximada(atual),
  };
}

export function tabelaExportacaoPronta(dados: TransacaoTratada[], tipo: string): any[] {
  if (tipo === "Faturamento diário") return agregar(dados, ["data_str"]).sort((a, b) => String(a.data_str).localeCompare(String(b.data_str)));
  if (tipo === "Resumo mensal") return agregar(dados, ["ano", "mes_num", "mes", "ano_mes"]).sort((a, b) => String(a.ano_mes).localeCompare(String(b.ano_mes)));
  if (tipo === "Resumo trimestral") return agregar(dados, ["ano", "trimestre"]).sort((a, b) => `${a.ano}${a.trimestre}`.localeCompare(`${b.ano}${b.trimestre}`));
  if (tipo === "Resumo anual") return agregar(dados, ["ano"]).sort((a, b) => a.ano - b.ano);
  if (tipo === "Por família") return agregar(dados, ["familia"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por produto/carreta") return agregar(dados, ["produto", "familia", "categoria_produto", "descricao_generica"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por cliente") return agregar(dados, ["cliente", "cliente_base", "cidade", "uf", "regiao", "representante"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por representante") return agregar(dados, ["representante"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por região / UF / cidade") return agregar(dados, ["regiao", "uf", "cidade"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por forma de venda") return agregar(dados, ["tipo_venda"]).sort((a, b) => b.faturamento - a.faturamento);
  if (tipo === "Por lista de preço") return agregar(dados, ["lista_preco_uf"]).sort((a, b) => b.faturamento - a.faturamento);
  return dados;
}

export function gerarExportacaoPersonalizada(dados: TransacaoTratada[], granularidade: string, metrica: string, dimensao?: string, comparativo = false): any[] {
  const metricMap: Record<string, string> = { Faturamento: "faturamento", Quantidade: "quantidade", Pedidos: "pedidos", Clientes: "clientes", "Ticket unitário": "ticket_unitario_calc", "Valor médio por pedido": "valor_medio_pedido" };
  const metricCol = metricMap[metrica] || "faturamento";
  if (!dados.length) return [];
  let keys: string[] = [];
  if (granularidade === "Diário") keys = ["data_str", ...(dimensao ? [dimensao] : [])];
  else if (granularidade === "Semanal") keys = ["ano", "semestre", ...(dimensao ? [dimensao] : [])];
  else if (granularidade === "Mensal") keys = ["ano", "mes_num", "mes", "ano_mes", ...(dimensao ? [dimensao] : [])];
  else if (granularidade === "Trimestral") keys = ["ano", "trimestre", ...(dimensao ? [dimensao] : [])];
  else keys = ["ano", ...(dimensao ? [dimensao] : [])];
  const base = agregar(dados, keys).map((row: any) => ({ ...row, metrica: row[metricCol] }));
  if (!comparativo || !dimensao || !["Mensal", "Anual"].includes(granularidade)) return base;
  const pivot = new Map<string, any>();
  for (const row of base) {
    const key = granularidade === "Mensal" ? `${row.mes_num}|||${row[dimensao]}` : String(row[dimensao]);
    if (!pivot.has(key)) pivot.set(key, { [dimensao]: row[dimensao], ...(granularidade === "Mensal" ? { mes: row.mes } : {}) });
    pivot.get(key)[String(row.ano)] = row[metricCol];
  }
  return Array.from(pivot.values());
}
