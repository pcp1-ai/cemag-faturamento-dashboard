
export interface TransacaoRaw {
  [key: string]: any;
}

export interface TransacaoTratada {
  id: string;
  produto: string;
  tipo_produto: string;
  cor: string;
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

export function classificarTipoProduto(produto: any, categoria: any, descricao: any, tipoVenda: any): string {
  const produtoTexto = semAcento(String(produto ?? "")).trim().toUpperCase();
  const texto = semAcento([produto, categoria, descricao, tipoVenda].filter(Boolean).join(" ")).toUpperCase();
  // Regras de negócio informadas pela CEMAG: códigos 00000 são sucata.
  if (produtoTexto.startsWith("00000") || texto.includes("SUCATA") || texto.includes("SALVADO")) return "Sucata";
  // Códigos iniciados por 2 representam itens comprados.
  if (/^2/.test(produtoTexto)) return "Itens comprados";
  // A base usa "70 Sistemas Carretas" para conjuntos/componentes de
  // carretas. Esta regra precisa vir antes da regra de prefixos e do texto
  // genérico "CARRETA", pois esses itens não são carretas completas.
  if (texto.includes("SISTEMAS CARRETAS")) return "Conjunto";
  // Padrão CEMAG: estas famílias identificam carretas/implementos, mesmo
  // quando a descrição também contém termos genéricos de peças ou acessórios.
  // A checagem usa o início do código para cobrir variações como CBH6R,
  // CBHM6000-2E, FTC6500R, FA2A e os sufixos de ano/versão.
  if (/^(CBH|CTH|FTC|F6|FA|MCF|SEF|ROCAX)/.test(produtoTexto)) return "Carreta";
  if (texto.includes("CONJUNTO") || texto.includes("KIT ") || texto.startsWith("KIT")) return "Conjunto";
  if (/(PECA|PECAS|PARAF|ROLAMENTO|CORREIA|MANCAL|BUCHA|ENGRENAGEM|EIXO|CHAPA|LONA|PNEU|RODA|VALVULA|MOTOR|BOMBA|ACESSOR)/.test(texto)) return "Peça";
  if (texto.includes("CARRETA") || texto.includes("IMPLEMENTO")) return "Carreta";
  return "Outros";
}

export function classificarCor(produto: any, tipoProduto: string): string {
  if (tipoProduto !== "Carreta" && tipoProduto !== "Conjunto") return "Não aplicável";
  const texto = semAcento(String(produto ?? "")).trim().toUpperCase();
  const sufixo = texto.match(/(?:^|\s)(AV|LC|AN|VM|CE|LJ|VJ|CO)$/)?.[1];
  return sufixo || "Laranja";
}

export function grupoModelo(produto: any): string {
  const fam = familiaProduto(produto).toUpperCase();
  if (fam.startsWith("CBHM")) return "CBHM";
  if (fam.startsWith("CBH")) return "CBH";
  if (fam.startsWith("CTH")) return "CTH";
  if (fam.startsWith("FTC")) return "FTC";
  if (fam.startsWith("F6")) return "F6";
  if (fam.startsWith("FA")) return "FA";
  if (fam.startsWith("F")) return "F";
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
    const dataEmissaoVal = colunas.data_emissao ? row[colunas.data_emissao] : null;
    const dataMovimentoVal = colunas.data_movimento ? row[colunas.data_movimento] : null;

    if (prodVal === colunas.produto || cliVal === colunas.cliente) {
      cabecalhoIgnorado++;
      continue;
    }

    const dtEmissaoFallback = parseDataBr(dataEmissaoVal);
    const dtMovimento = parseDataBr(dataMovimentoVal);
    const dtPrincipal = dtMovimento || dtEmissaoFallback;
    if (!dtPrincipal) {
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

    const ano = dtPrincipal.getFullYear();
    const mesNum = dtPrincipal.getMonth() + 1;
    const mes = MESES[mesNum] || `M${mesNum}`;
    const mesCompleto = MESES_COMPLETOS[mesNum] || "";
    const anoMes = `${ano}-${String(mesNum).padStart(2, "0")}`;
    const anoMesData = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
    const trimestre = `T${Math.floor((mesNum - 1) / 3) + 1}`;
    const semestre = mesNum <= 6 ? "1º semestre" : "2º semestre";
    const diaSemana = diasSemanaMap[dtPrincipal.getDay()] || "";
    const diaMes = dtPrincipal.getDate();

    const qtdTicket = quantidade > 0 ? quantidade : 0;
    const fatTicket = quantidade > 0 ? faturamento : 0;
    const ticketUnitario = quantidade > 0 ? faturamento / quantidade : 0;
    const linhasQtdNaoPositiva = quantidade <= 0 ? 1 : 0;

    const familia = familiaProduto(produto);
    const grupo = grupoModelo(produto);
    const tipoProduto = classificarTipoProduto(produto, catProduto, descGenerica, tipoVenda);
    const cor = classificarCor(produto, tipoProduto);

    dadosTratados.push({
      id: `${pedido}_${idx}`,
      produto,
      tipo_produto: tipoProduto,
      cor,
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
      data_emissao: dtPrincipal,
      data_movimento: dtMovimento || undefined,
      data_str: dtPrincipal.toLocaleDateString("pt-BR"),
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
