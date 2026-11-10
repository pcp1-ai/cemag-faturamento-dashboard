export type FatorExternoMensal = {
  ano_mes: string;
  selic_media_pct: number | null;
  chuva_mm: number | null;
};

export type IndicadoresAgro = {
  ptax_media_brl: number | null;
  cafe_producao_t: number | null;
  cafe_area_colhida_ha: number | null;
  cafe_valor_producao_mil_brl: number | null;
  ano_referencia: number | null;
  credito_investimento_brl: number | null;
  credito_status: "consultado" | "indisponivel" | "nao_consultado";
  precos_agro: Array<{ produto: string; ticker: string; valor_usd: number | null; atualizado_em: string | null }>;
};

export type MercadoMaquinasAnfavea = {
  status: "consultado" | "indisponivel" | "nao_consultado";
  tipo_dado: string;
  agregacao: string;
  series: Array<{ ano_mes: string; maquina: string; unidades: number | null }>;
  fonte: string;
  atualizado_em: string | null;
};

export type FonteAgroStatus = {
  id: "ibge_pam" | "bcb_credito_rural" | "conab" | "comexstat";
  nome: string;
  status: "consultado" | "indisponivel" | "nao_consultado";
  periodicidade: string;
  periodo_disponivel: string;
  fonte: string;
  atualizado_em: string | null;
  observacao: string;
};

export type FatoresExternosResult = {
  localidade: string | null;
  latitude: number | null;
  longitude: number | null;
  meses: FatorExternoMensal[];
  previsao_chuva: Array<{ data: string; chuva_mm: number | null; probabilidade_chuva_pct: number | null }>;
  expectativas_selic: Array<{ data_consulta: string; reuniao: string; media_pct: number | null; mediana_pct: number | null; respondentes: number | null }>;
  previsao_sazonal: Array<{ modelo: string; temporada: string; periodo: string; chuva_total_mm: number | null; sinal_tercil: string | null; valor_sinal: number | null; atualizado_em: string }>;
  indices_climaticos: Array<{ indice: string; periodo: string; anomalia_c: number | null; classificacao: string }>;
  indicadores_agro: IndicadoresAgro;
  mercado_maquinas_anfavea: MercadoMaquinasAnfavea;
  fontes_agro: FonteAgroStatus[];
  fontes: string[];
  avisos: string[];
  atualizado_em: string;
};

type BcbRow = { data?: string; valor?: string | number };
type BcbCreditoRow = { nomeUF?: string; VlInvestimento?: number | string; QtdInvestimento?: number | string; AnoEmissao?: number | string; MesEmissao?: number | string };
type BcbFocusRow = { Indicador?: string; Data?: string; Reuniao?: string; Media?: number; Mediana?: number; numeroRespondentes?: number; baseCalculo?: number };

type GeocodeResult = { name?: string; latitude?: number; longitude?: number; admin1?: string; country?: string };
type SidraRow = { V?: string; D2C?: string; D3C?: string; D4C?: string };

function parsePtDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
}

function monthKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeys(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const limit = new Date(`${end}T00:00:00Z`);
  cursor.setUTCDate(1);
  while (cursor <= limit) {
    result.push(monthKeyFromDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

function toBcbDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toPowerDate(value: string) {
  return value.replaceAll("-", "");
}

async function fetchJson<T>(url: string, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/plain" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBytes(url: string, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function buscarPtaxMedia(dataInicio: string, dataFim: string) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${encodeURIComponent(toBcbDate(dataInicio))}&dataFinal=${encodeURIComponent(toBcbDate(dataFim))}`;
  const rows = await fetchJson<BcbRow[]>(url);
  const values = rows.map((row) => Number(row.valor)).filter((value) => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

async function buscarCafeIbge() {
  const ano = new Date().getUTCFullYear() - 1;
  const url = `https://apisidra.ibge.gov.br/values/t/1613/n1/1/v/214,215,216/p/${ano}`;
  const rows = await fetchJson<SidraRow[]>(url);
  const find = (codigo: string) => {
    const row = rows.find((item) => item.D2C === codigo && item.D4C === "0");
    const value = Number(row?.V);
    return Number.isFinite(value) ? value : null;
  };
  return { ano_referencia: ano, cafe_area_colhida_ha: find("216"), cafe_producao_t: find("214"), cafe_valor_producao_mil_brl: find("215") };
}

async function verificarFonteAgro(url: string, fonte: FonteAgroStatus["fonte"], id: FonteAgroStatus["id"], nome: string, periodicidade: string, periodo_disponivel: string, observacao: string): Promise<FonteAgroStatus> {
  try {
    await fetchText(url, 20_000);
    return { id, nome, status: "consultado", periodicidade, periodo_disponivel, fonte, atualizado_em: new Date().toISOString(), observacao };
  } catch (error) {
    return { id, nome, status: "indisponivel", periodicidade, periodo_disponivel, fonte, atualizado_em: null, observacao: `${observacao} (${error instanceof Error ? error.message : "erro de consulta"})` };
  }
}

function fontesAgroIniciais(): FonteAgroStatus[] {
  return [
    { id: "ibge_pam", nome: "Produção agrícola municipal — IBGE/PAM", status: "nao_consultado", periodicidade: "Anual", periodo_disponivel: "Último ano publicado pelo IBGE", fonte: "IBGE/SIDRA", atualizado_em: null, observacao: "Produção, área, rendimento e valor por município, estado e região." },
    { id: "bcb_credito_rural", nome: "Crédito rural — Banco Central/SICOR", status: "nao_consultado", periodicidade: "Consulta por operação e período", periodo_disponivel: "Conforme registros publicados pelo Banco Central", fonte: "Banco Central do Brasil — SICOR/MDCR", atualizado_em: null, observacao: "Investimento, custeio, contratos e valores por localidade quando a consulta municipal está disponível." },
    { id: "conab", nome: "Safra e preços agrícolas — CONAB", status: "nao_consultado", periodicidade: "Mensal, por produto/levantamento", periodo_disponivel: "Último levantamento publicado", fonte: "CONAB", atualizado_em: null, observacao: "Safra, preços mínimos, comercialização e programas de apoio; ausência de publicação não é tratada como zero." },
    { id: "comexstat", nome: "Comércio exterior — Comex Stat", status: "nao_consultado", periodicidade: "Mensal", periodo_disponivel: "Período disponível na consulta oficial", fonte: "MDIC — Comex Stat", atualizado_em: null, observacao: "Exportações e importações por produto, UF, país e período." },
  ];
}

async function buscarIndiceOni() {
  const texto = await fetchText("https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt");
  const linhas = texto.split(/\r?\n/).map((linha) => linha.trim()).filter((linha) => /^(DJF|JFM|FMA|MAM|AMJ|MJJ|JJA|JAS|ASO|SON|OND|NDJ)\s+\d{4}\s+/.test(linha));
  return linhas.slice(-12).map((linha) => {
    const [periodo, ano, , anomalia] = linha.split(/\s+/);
    const valor = Number(anomalia);
    return { indice: "ONI / ENSO", periodo: `${periodo} ${ano}`, anomalia_c: Number.isFinite(valor) ? valor : null, classificacao: Number.isFinite(valor) ? valor >= 0.5 ? "El Niño" : valor <= -0.5 ? "La Niña" : "Neutro" : "Sem dado" };
  });
}

async function buscarCreditoInvestimento(cidade: string, uf?: string) {
  if (!cidade || cidade === "Brasil" || !uf) return { value: null, status: "nao_consultado" as const };
  const ufNormalizada = uf.trim().toUpperCase();
  const url = `https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata/RegiaoUF?$format=json&$filter=${encodeURIComponent(`nomeUF eq '${ufNormalizada}'`)}&$top=10000`;
  try {
    const data = await fetchJson<{ value?: BcbCreditoRow[] }>(url, 30_000);
    const rows = data.value || [];
    const total = rows.reduce((sum, row) => sum + (Number(row.VlInvestimento) || 0), 0);
    return { value: total, status: "consultado" as const };
  } catch {
    return { value: null, status: "indisponivel" as const };
  }
}

async function buscarPrecosAgro() {
  const itens = [{ produto: "Café arábica", ticker: "KC=F" }, { produto: "Milho", ticker: "ZC=F" }, { produto: "Soja", ticker: "ZS=F" }];
  return Promise.all(itens.map(async (item) => {
    try {
      const data = await fetchJson<{ chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number } }> } }>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.ticker)}?range=1y&interval=1mo`);
      const meta = data.chart?.result?.[0]?.meta;
      return { produto: item.produto, ticker: item.ticker, valor_usd: Number.isFinite(meta?.regularMarketPrice) ? Number(meta?.regularMarketPrice) : null, atualizado_em: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null };
    } catch {
      return { produto: item.produto, ticker: item.ticker, valor_usd: null, atualizado_em: null };
    }
  }));
}

function decodificarHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function buscarMercadoMaquinasAnfavea(): Promise<MercadoMaquinasAnfavea> {
  const indisponivel = (fonte = "ANFAVEA — Central de Dados") => ({ status: "indisponivel" as const, tipo_dado: "VENDA VAREJO", agregacao: "mensal", series: [], fonte, atualizado_em: null });
  try {
    const pagina = await fetchText("https://anfavea.com.br/site/central-de-dados/", 30_000);
    const config = pagina.match(/var\s+anfaveaData\s*=\s*(\{.*?\});/s)?.[1];
    const nonce = config ? JSON.parse(config).nonce : null;
    if (!nonce) return indisponivel("ANFAVEA — nonce público não encontrado");
    const form = new FormData();
    form.append("action", "anfavea_dashboard1");
    form.append("nonce", nonce);
    form.append("dashboard", "dashboard3");
    form.append("tipo_dado_maquina", "VENDA VAREJO");
    ["TOTAL_AGRICOLAS", "TRATORES DE RODAS", "COLHEITADEIRAS DE GRAOS", "TOTAL_RODOVIARIAS", "TRATORES DE ESTEIRAS", "RETROESCAVADEIRAS", "PAS-CARREGADEIRAS", "ESCAVADEIRAS HIDRAULICAS", "MOTONIVELADORAS", "ROLOS COMPACTADORES", "MINI-CARREGADEIRAS", "MANIPULADORES TELESCOPICOS"].forEach((maquina) => form.append("maquinas[]", maquina));
    form.append("agregacao", "mensal");
    form.append("inicio", "2022-01");
    const hoje = new Date();
    form.append("fim", `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`);
    const resposta = await fetch("https://anfavea.com.br/site/wp-admin/admin-ajax.php", { method: "POST", body: form, headers: { Accept: "application/json", Referer: "https://anfavea.com.br/site/central-de-dados/", "User-Agent": "Mozilla/5.0 (compatible; CEMAG-Dashboard/1.0)" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json() as { success?: boolean; data?: { table_html?: string } };
    if (!json.success || !json.data?.table_html) throw new Error("resposta sem tabela");
    const html = json.data.table_html;
    const cabecalho = [...html.matchAll(/<th[^>]*>\s*([^<]+?)\s*<\/th>/gi)].map((match) => decodificarHtml(match[1]).trim()).filter((item) => item.toUpperCase() !== "PERÍODO");
    const meses: Record<string, string> = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };
    const series: MercadoMaquinasAnfavea["series"] = [];
    for (const row of html.matchAll(/<tr[^>]*>\s*<td[^>]*>\s*<strong[^>]*>\s*([^<]+?)\s*<\/strong>\s*<\/td>([\s\S]*?)<\/tr>/gi)) {
      const periodo = decodificarHtml(row[1]).trim().match(/(\d{4})\s*-\s*([A-ZÇ]{3})/i);
      if (!periodo) continue;
      const anoMes = `${periodo[1]}-${meses[periodo[2].toUpperCase()] || "01"}`;
      const valores = [...row[2].matchAll(/data-valor-export="([\d.-]+)"/gi)].map((match) => Number(match[1]));
      valores.forEach((valor, indice) => series.push({ ano_mes: anoMes, maquina: cabecalho[indice] || `Máquina ${indice + 1}`, unidades: Number.isFinite(valor) ? valor : null }));
    }
    return { status: series.length ? "consultado" : "indisponivel", tipo_dado: "VENDA VAREJO", agregacao: "mensal", series, fonte: "ANFAVEA — Central de Dados, máquinas autopropulsadas (vendas no varejo)", atualizado_em: new Date().toISOString() };
  } catch (error) {
    return indisponivel(`ANFAVEA indisponível: ${error instanceof Error ? error.message : "erro de consulta"}`);
  }
}

async function consultarEmLotes<T>(itens: readonly T[], worker: (item: T, index: number) => Promise<FatoresExternosResult>, limite = 5) {
  const resultados: PromiseSettledResult<FatoresExternosResult>[] = [];
  for (let inicio = 0; inicio < itens.length; inicio += limite) {
    const lote = itens.slice(inicio, inicio + limite);
    resultados.push(...await Promise.allSettled(lote.map((item, index) => worker(item, inicio + index))));
  }
  return resultados;
}

function valorGradeCptec(bytes: Uint8Array, latitude: number, longitude: number) {
  const lon360 = longitude < 0 ? longitude + 360 : longitude;
  const x = Math.max(0, Math.min(383, Math.round(lon360 / 0.9375)));
  const y = Math.max(0, Math.min(191, Math.round((latitude + 89.531) / 0.9375)));
  const offset = (y * 384 + x) * 4;
  if (offset + 4 > bytes.length) return null;
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, true);
  return !Number.isFinite(value) || value < -900000 ? null : value;
}

export function periodoSazonal(initYear: number, initMonth: number, season: number) {
  const start = new Date(Date.UTC(initYear, initMonth - 1 + 1 + (season - 1) * 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 1));
  return `${monthKeyFromDate(start)} a ${monthKeyFromDate(end)}`;
}

export function agregarFatoresNacionais(resultados: FatoresExternosResult[], descricao = "Brasil — média de localidades selecionadas", avisosExtras: string[] = []): FatoresExternosResult {
  const media = (values: Array<number | null | undefined>) => {
    const validos = values.filter((value): value is number => value != null && Number.isFinite(value));
    return validos.length ? validos.reduce((sum, value) => sum + value, 0) / validos.length : null;
  };
  const porMes = new Map<string, FatorExternoMensal[]>();
  for (const resultado of resultados) for (const mes of resultado.meses) porMes.set(mes.ano_mes, [...(porMes.get(mes.ano_mes) || []), mes]);
  const meses = Array.from(porMes.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ano_mes, rows]) => ({ ano_mes, selic_media_pct: media(rows.map((row) => row.selic_media_pct)), chuva_mm: media(rows.map((row) => row.chuva_mm)) }));
  const porData = new Map<string, FatoresExternosResult["previsao_chuva"]>();
  for (const resultado of resultados) for (const item of resultado.previsao_chuva) porData.set(item.data, [...(porData.get(item.data) || []), item]);
  const previsao_chuva = Array.from(porData.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([data, rows]) => ({ data, chuva_mm: media(rows.map((row) => row.chuva_mm)), probabilidade_chuva_pct: media(rows.map((row) => row.probabilidade_chuva_pct)) }));
  const porTemporada = new Map<string, FatoresExternosResult["previsao_sazonal"]>();
  for (const resultado of resultados) for (const item of resultado.previsao_sazonal) porTemporada.set(item.temporada, [...(porTemporada.get(item.temporada) || []), item]);
  const previsao_sazonal = Array.from(porTemporada.values()).map((rows) => {
    const primeira = rows[0];
    const valor_sinal = media(rows.map((row) => row.valor_sinal));
    return { modelo: primeira.modelo, temporada: primeira.temporada, periodo: primeira.periodo, chuva_total_mm: media(rows.map((row) => row.chuva_total_mm)), sinal_tercil: valor_sinal == null ? null : valor_sinal > 0 ? "Acima do normal" : valor_sinal < 0 ? "Abaixo do normal" : "Sem sinal predominante", valor_sinal, atualizado_em: new Date().toISOString() };
  });
  const base = resultados[0];
  return { localidade: descricao, latitude: null, longitude: null, meses, previsao_chuva, expectativas_selic: base?.expectativas_selic || [], previsao_sazonal, indices_climaticos: base?.indices_climaticos || [], indicadores_agro: base?.indicadores_agro || { ptax_media_brl: null, cafe_producao_t: null, cafe_area_colhida_ha: null, cafe_valor_producao_mil_brl: null, ano_referencia: null, credito_investimento_brl: null, credito_status: "nao_consultado", precos_agro: [] }, mercado_maquinas_anfavea: base?.mercado_maquinas_anfavea || { status: "nao_consultado", tipo_dado: "VENDA VAREJO", agregacao: "mensal", series: [], fonte: "ANFAVEA — Central de Dados", atualizado_em: null }, fontes_agro: base?.fontes_agro || fontesAgroIniciais(), fontes: Array.from(new Set([...resultados.flatMap((resultado) => resultado.fontes), `Agregação: média simples de ${resultados.length} localidades selecionadas`])), avisos: [`A abrangência usa média simples das ${resultados.length} localidades selecionadas. Ela representa os pontos escolhidos, não uma média areal oficial de todo o território.`, ...avisosExtras, ...resultados.flatMap((resultado) => resultado.avisos)], atualizado_em: new Date().toISOString() };
}

async function buscarPrevisaoSazonal(latitude: number, longitude: number) {
  const hoje = new Date();
  for (let recuo = 1; recuo <= 4; recuo++) {
    const init = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - recuo, 1));
    const ano = init.getUTCFullYear();
    const mes = String(init.getUTCMonth() + 1).padStart(2, "0");
    const data = `${ano}${mes}0100`;
    try {
      const resposta: FatoresExternosResult["previsao_sazonal"] = [];
      for (const temporada of [1, 2]) {
        const base = "https://dataserver.cptec.inpe.br/dataserver_sazonal/calibrated/prec_seas";
        const nome = `BAM12_CALB_${data}_SEAS0${temporada}`;
        const total = valorGradeCptec(await fetchBytes(`${base}/totals/${ano}/${mes}/01/${nome}.dat`), latitude, longitude);
        const sinal = valorGradeCptec(await fetchBytes(`${base}/prob_terciles/${ano}/${mes}/01/${nome}.dat`), latitude, longitude);
        resposta.push({ modelo: "CPTEC/INPE BAM-1.2", temporada: `SEAS0${temporada}`, periodo: periodoSazonal(ano, init.getUTCMonth() + 1, temporada), chuva_total_mm: total, sinal_tercil: sinal == null ? null : sinal > 0 ? "Acima do normal" : sinal < 0 ? "Abaixo do normal" : "Sem sinal predominante", valor_sinal: sinal, atualizado_em: new Date().toISOString() });
      }
      return resposta;
    } catch {
      // A rodada mais recente pode ainda não estar publicada; tenta a anterior.
    }
  }
  return [];
}

export function agregarSelicMensal(rows: BcbRow[]) {
  const acumulado = new Map<string, number[]>();
  for (const row of rows) {
    const date = row.data ? parsePtDate(row.data) : null;
    const value = Number(row.valor);
    if (!date || !Number.isFinite(value)) continue;
    const key = monthKeyFromDate(date);
    acumulado.set(key, [...(acumulado.get(key) || []), value]);
  }
  return new Map(Array.from(acumulado.entries()).map(([key, values]) => [key, values.reduce((sum, value) => sum + value, 0) / values.length]));
}

export function agregarChuvaMensal(parameters: Record<string, number>) {
  const acumulado = new Map<string, number>();
  for (const [rawDate, rawValue] of Object.entries(parameters)) {
    const value = Number(rawValue);
    if (!/^\d{8}$/.test(rawDate) || !Number.isFinite(value) || value < -900) continue;
    const key = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}`;
    acumulado.set(key, (acumulado.get(key) || 0) + value);
  }
  return acumulado;
}

async function buscarCoordenadas(cidade: string, uf?: string) {
  const query = encodeURIComponent(`${cidade}${uf ? `, ${uf}` : ""}, Brasil`);
  const data = await fetchJson<{ results?: GeocodeResult[] }>(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=pt&format=json`);
  const results = data.results || [];
  return results.find((item) => item.country?.toLowerCase() === "brasil") || results[0] || null;
}

export async function obterFatoresExternos(input: { dataInicio: string; dataFim: string; cidade: string; uf?: string; localidades?: Array<{ cidade: string; uf?: string }>; descricaoAbrangencia?: string }, opcoes: { consultaRapida?: boolean; consultaAgregada?: boolean } = {}): Promise<FatoresExternosResult> {
  if (input.localidades?.length) {
    const localidades = input.localidades.filter((localidade) => localidade.cidade && localidade.cidade !== "Brasil");
    const resultados = await consultarEmLotes(localidades, (localidade, indice) => obterFatoresExternos({ dataInicio: input.dataInicio, dataFim: input.dataFim, cidade: localidade.cidade, uf: localidade.uf }, { consultaRapida: indice > 0, consultaAgregada: indice === 0 }));
    const respostas = resultados.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    const falhas = resultados.filter((item) => item.status === "rejected").length;
    return agregarFatoresNacionais(respostas, input.descricaoAbrangencia || "Abrangência selecionada", [`A primeira localidade recebeu consulta completa; as demais usam coleta territorial rápida para reduzir o tempo de resposta.`, ...(falhas ? [`${falhas} localidade(s) não responderam; os números representam apenas as localidades disponíveis.`] : [])]);
  }
  if (input.cidade.trim().toLowerCase() === "brasil") {
    const referencias = [["Manaus", "AM"], ["Recife", "PE"], ["Brasília", "DF"], ["São Paulo", "SP"], ["Porto Alegre", "RS"]] as const;
    const resultados = await consultarEmLotes(referencias, ([cidade, uf]: readonly [string, string], indice: number) => obterFatoresExternos({ ...input, cidade, uf }, { consultaRapida: indice > 0, consultaAgregada: indice === 0 }));
    const respostas = resultados.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    const falhas = resultados.filter((item) => item.status === "rejected").length;
    return agregarFatoresNacionais(respostas, "Brasil — referências regionais padrão", falhas ? [`${falhas} referência(s) regional(is) não respondeu(ram); os números são parciais.`] : []);
  }
  const meses = monthKeys(input.dataInicio, input.dataFim);
  const porMes = new Map<string, FatorExternoMensal>(meses.map((anoMes) => [anoMes, { ano_mes: anoMes, selic_media_pct: null, chuva_mm: null }]));
  const fontes: string[] = [];
  const avisos: string[] = [];
  const previsao_chuva: FatoresExternosResult["previsao_chuva"] = [];
  const expectativas_selic: FatoresExternosResult["expectativas_selic"] = [];
  const previsao_sazonal: FatoresExternosResult["previsao_sazonal"] = [];
  const indices_climaticos: FatoresExternosResult["indices_climaticos"] = [];
  const indicadores_agro: IndicadoresAgro = { ptax_media_brl: null, cafe_producao_t: null, cafe_area_colhida_ha: null, cafe_valor_producao_mil_brl: null, ano_referencia: null, credito_investimento_brl: null, credito_status: "nao_consultado", precos_agro: [] };
  const fontes_agro = fontesAgroIniciais();
  let mercado_maquinas_anfavea: MercadoMaquinasAnfavea = { status: "nao_consultado", tipo_dado: "VENDA VAREJO", agregacao: "mensal", series: [], fonte: "ANFAVEA — Central de Dados", atualizado_em: null };

  if (!opcoes.consultaRapida) {
    try {
      const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=${encodeURIComponent(toBcbDate(input.dataInicio))}&dataFinal=${encodeURIComponent(toBcbDate(input.dataFim))}`;
      const selic = agregarSelicMensal(await fetchJson<BcbRow[]>(bcbUrl));
      for (const [key, value] of selic) {
        const row = porMes.get(key);
        if (row) row.selic_media_pct = value;
      }
      fontes.push("Banco Central do Brasil — SGS série 432 (meta Selic)");
    } catch (error) {
      avisos.push(`Selic indisponível no momento: ${error instanceof Error ? error.message : "erro de consulta"}`);
    }
  }

  if (!opcoes.consultaRapida && !opcoes.consultaAgregada) {
    mercado_maquinas_anfavea = await buscarMercadoMaquinasAnfavea();
    if (mercado_maquinas_anfavea.status === "consultado") fontes.push(mercado_maquinas_anfavea.fonte);
    else avisos.push(mercado_maquinas_anfavea.fonte);
    try {
    indices_climaticos.push(...await buscarIndiceOni());
    if (indices_climaticos.length) fontes.push("NOAA/CPC — índice ONI de El Niño e La Niña");
  } catch (error) {
    avisos.push(`Índice climático NOAA/CPC indisponível: ${error instanceof Error ? error.message : "erro de consulta"}`);
  }
  try {
    indicadores_agro.ptax_media_brl = await buscarPtaxMedia(input.dataInicio, input.dataFim);
    if (indicadores_agro.ptax_media_brl != null) fontes.push("Banco Central do Brasil — SGS série 1 (PTAX venda)");
  } catch (error) {
    avisos.push(`PTAX indisponível no momento: ${error instanceof Error ? error.message : "erro de consulta"}`);
  }

  try {
    Object.assign(indicadores_agro, await buscarCafeIbge());
    const fonteIbge = fontes_agro.find((fonte) => fonte.id === "ibge_pam");
    if (fonteIbge) { fonteIbge.status = "consultado"; fonteIbge.periodo_disponivel = String(indicadores_agro.ano_referencia || "último ano publicado"); fonteIbge.atualizado_em = new Date().toISOString(); }
    fontes.push("IBGE — SIDRA/PAM tabela 1613 (café, último ano disponível)");
  } catch (error) {
    const fonteIbge = fontes_agro.find((fonte) => fonte.id === "ibge_pam");
    if (fonteIbge) { fonteIbge.status = "indisponivel"; fonteIbge.observacao = `Consulta IBGE indisponível: ${error instanceof Error ? error.message : "erro de consulta"}`; }
    avisos.push(`Produção de café do IBGE indisponível: ${error instanceof Error ? error.message : "erro de consulta"}`);
  }

  indicadores_agro.precos_agro = await buscarPrecosAgro();
  if (indicadores_agro.precos_agro.some((item) => item.valor_usd != null)) fontes.push("Yahoo Finance — futuros internacionais KC=F, ZC=F e ZS=F (USD)" );

  if (!opcoes.consultaAgregada) {
    const credito = await buscarCreditoInvestimento(input.cidade, input.uf);
    indicadores_agro.credito_investimento_brl = credito.value;
    indicadores_agro.credito_status = credito.status;
    const fonteCredito = fontes_agro.find((fonte) => fonte.id === "bcb_credito_rural");
    if (fonteCredito) { fonteCredito.status = credito.status; fonteCredito.atualizado_em = credito.status === "consultado" ? new Date().toISOString() : null; }
    if (credito.status === "consultado") fontes.push("Banco Central do Brasil — SICOR/MDCR investimento");
    if (credito.status === "indisponivel") avisos.push("Crédito rural de investimento não respondeu; será mantido como indisponível até a próxima atualização.");
  } else {
    avisos.push("Crédito rural foi omitido na abrangência agregada para evitar timeout; consulte um município para carregar o SICOR/MDCR.");
  }

  try {
    const focusUrl = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoSelic?$filter=Indicador%20eq%20%27Selic%27&$orderby=Data%20desc&$top=200&$format=json";
    const focus = await fetchJson<{ value?: BcbFocusRow[] }>(focusUrl);
    const vistos = new Set<string>();
    for (const row of focus.value || []) {
      if (!row.Reuniao || vistos.has(row.Reuniao)) continue;
      vistos.add(row.Reuniao);
      expectativas_selic.push({ data_consulta: row.Data || "", reuniao: row.Reuniao, media_pct: Number.isFinite(row.Media) ? Number(row.Media) : null, mediana_pct: Number.isFinite(row.Mediana) ? Number(row.Mediana) : null, respondentes: Number.isFinite(row.numeroRespondentes) ? Number(row.numeroRespondentes) : null });
      if (expectativas_selic.length >= 12) break;
    }
    if (expectativas_selic.length) fontes.push("Banco Central do Brasil — Boletim Focus / Expectativas de Mercado (Selic por reunião)");
  } catch (error) {
    avisos.push(`Expectativa futura da Selic indisponível: ${error instanceof Error ? error.message : "erro de consulta"}`);
  }
  } else {
    avisos.push(opcoes.consultaAgregada ? "Abrangência agregada prioriza Selic histórica e clima futuro; consulte um município para carregar todas as fontes agropecuárias." : "Consulta territorial rápida: PTAX, produção IBGE, commodities, crédito e Focus foram consultados apenas na referência principal.");
  }

  let localidade: GeocodeResult | null = null;
  if (input.cidade && input.cidade !== "Não identificado") {
    try {
      localidade = await buscarCoordenadas(input.cidade, input.uf);
      if (!localidade?.latitude || !localidade.longitude) throw new Error("município não localizado");
      if (!opcoes.consultaRapida && !opcoes.consultaAgregada) {
        const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${localidade.longitude}&latitude=${localidade.latitude}&start=${toPowerDate(input.dataInicio)}&end=${toPowerDate(input.dataFim)}&format=JSON`;
        const power = await fetchJson<{ properties?: { parameter?: { PRECTOTCORR?: Record<string, number> } } }>(powerUrl, 45_000);
        const chuva = agregarChuvaMensal(power.properties?.parameter?.PRECTOTCORR || {});
        for (const [key, value] of chuva) {
          const row = porMes.get(key);
          if (row) row.chuva_mm = value;
        }
        fontes.push("NASA POWER — precipitação corrigida MERRA-2 (PRECTOTCORR)");
      }
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${localidade.latitude}&longitude=${localidade.longitude}&daily=precipitation_sum,precipitation_probability_mean&forecast_days=16&timezone=auto`;
      const forecast = await fetchJson<{ daily?: { time?: string[]; precipitation_sum?: Array<number | null>; precipitation_probability_mean?: Array<number | null> } }>(forecastUrl, 30_000);
      const times = forecast.daily?.time || [];
      for (let i = 0; i < times.length; i++) previsao_chuva.push({ data: times[i], chuva_mm: forecast.daily?.precipitation_sum?.[i] ?? null, probabilidade_chuva_pct: forecast.daily?.precipitation_probability_mean?.[i] ?? null });
      if (previsao_chuva.length) fontes.push("Open-Meteo — previsão meteorológica diária (até 16 dias)");
      if (!opcoes.consultaRapida && !opcoes.consultaAgregada) {
        const sazonal = await buscarPrevisaoSazonal(Number(localidade.latitude), Number(localidade.longitude));
        previsao_sazonal.push(...sazonal);
        if (sazonal.length) fontes.push("CPTEC/INPE — previsão sazonal de precipitação (trimestres)");
        else avisos.push("Previsão sazonal do CPTEC/INPE ainda não disponível para a rodada mais recente.");
      }
    } catch (error) {
      avisos.push(`Chuva indisponível para ${input.cidade}: ${error instanceof Error ? error.message : "erro de consulta"}`);
    }
  } else {
    avisos.push("Selecione um município identificado para consultar a chuva.");
  }

  if (!opcoes.consultaRapida && !opcoes.consultaAgregada) {
    const fontesVerificadas = await Promise.all([
      verificarFonteAgro("https://www.conab.gov.br/precos-minimos", "CONAB", "conab", "Safra e preços agrícolas — CONAB", "Mensal, por levantamento", "Último levantamento publicado", "A página oficial respondeu; os conjuntos detalhados dependem do produto e do levantamento selecionado."),
      verificarFonteAgro("https://comexstat.mdic.gov.br/pt/home", "MDIC — Comex Stat", "comexstat", "Comércio exterior — Comex Stat", "Mensal", "Período disponível na consulta oficial", "O portal oficial respondeu; a consulta detalhada de exportações será parametrizada por produto e UF."),
    ]);
    for (const fonte of fontesVerificadas) { const indice = fontes_agro.findIndex((item) => item.id === fonte.id); if (indice >= 0) fontes_agro[indice] = fonte; }
  }

  return {
    localidade: localidade?.name || null,
    latitude: Number.isFinite(localidade?.latitude) ? Number(localidade?.latitude) : null,
    longitude: Number.isFinite(localidade?.longitude) ? Number(localidade?.longitude) : null,
    meses: Array.from(porMes.values()),
    previsao_chuva,
    expectativas_selic,
    previsao_sazonal,
    indices_climaticos,
    indicadores_agro,
    mercado_maquinas_anfavea,
    fontes_agro,
    fontes,
    avisos,
    atualizado_em: new Date().toISOString(),
  };
}
