export type FatorExternoMensal = {
  ano_mes: string;
  selic_media_pct: number | null;
  chuva_mm: number | null;
};

export type FatoresExternosResult = {
  localidade: string | null;
  latitude: number | null;
  longitude: number | null;
  meses: FatorExternoMensal[];
  previsao_chuva: Array<{ data: string; chuva_mm: number | null; probabilidade_chuva_pct: number | null }>;
  expectativas_selic: Array<{ data_consulta: string; reuniao: string; media_pct: number | null; mediana_pct: number | null; respondentes: number | null }>;
  previsao_sazonal: Array<{ modelo: string; temporada: string; periodo: string; chuva_total_mm: number | null; sinal_tercil: string | null; valor_sinal: number | null; atualizado_em: string }>;
  fontes: string[];
  avisos: string[];
  atualizado_em: string;
};

type BcbRow = { data?: string; valor?: string | number };
type BcbFocusRow = { Indicador?: string; Data?: string; Reuniao?: string; Media?: number; Mediana?: number; numeroRespondentes?: number; baseCalculo?: number };

type GeocodeResult = { name?: string; latitude?: number; longitude?: number; admin1?: string; country?: string };

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

export async function obterFatoresExternos(input: { dataInicio: string; dataFim: string; cidade: string; uf?: string }): Promise<FatoresExternosResult> {
  const meses = monthKeys(input.dataInicio, input.dataFim);
  const porMes = new Map<string, FatorExternoMensal>(meses.map((anoMes) => [anoMes, { ano_mes: anoMes, selic_media_pct: null, chuva_mm: null }]));
  const fontes: string[] = [];
  const avisos: string[] = [];
  const previsao_chuva: FatoresExternosResult["previsao_chuva"] = [];
  const expectativas_selic: FatoresExternosResult["expectativas_selic"] = [];
  const previsao_sazonal: FatoresExternosResult["previsao_sazonal"] = [];

  try {
    const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados?formato=json&dataInicial=${encodeURIComponent(toBcbDate(input.dataInicio))}&dataFinal=${encodeURIComponent(toBcbDate(input.dataFim))}`;
    const selic = agregarSelicMensal(await fetchJson<BcbRow[]>(bcbUrl));
    for (const [key, value] of selic) {
      const row = porMes.get(key);
      if (row) row.selic_media_pct = value;
    }
    fontes.push("Banco Central do Brasil — SGS série 1178 (Selic anualizada base 252)");
  } catch (error) {
    avisos.push(`Selic indisponível no momento: ${error instanceof Error ? error.message : "erro de consulta"}`);
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

  let localidade: GeocodeResult | null = null;
  if (input.cidade && input.cidade !== "Não identificado") {
    try {
      localidade = await buscarCoordenadas(input.cidade, input.uf);
      if (!localidade?.latitude || !localidade.longitude) throw new Error("município não localizado");
      const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=${localidade.longitude}&latitude=${localidade.latitude}&start=${toPowerDate(input.dataInicio)}&end=${toPowerDate(input.dataFim)}&format=JSON`;
      const power = await fetchJson<{ properties?: { parameter?: { PRECTOTCORR?: Record<string, number> } } }>(powerUrl, 45_000);
      const chuva = agregarChuvaMensal(power.properties?.parameter?.PRECTOTCORR || {});
      for (const [key, value] of chuva) {
        const row = porMes.get(key);
        if (row) row.chuva_mm = value;
      }
      fontes.push("NASA POWER — precipitação corrigida MERRA-2 (PRECTOTCORR)");
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${localidade.latitude}&longitude=${localidade.longitude}&daily=precipitation_sum,precipitation_probability_mean&forecast_days=16&timezone=auto`;
      const forecast = await fetchJson<{ daily?: { time?: string[]; precipitation_sum?: Array<number | null>; precipitation_probability_mean?: Array<number | null> } }>(forecastUrl, 30_000);
      const times = forecast.daily?.time || [];
      for (let i = 0; i < times.length; i++) previsao_chuva.push({ data: times[i], chuva_mm: forecast.daily?.precipitation_sum?.[i] ?? null, probabilidade_chuva_pct: forecast.daily?.precipitation_probability_mean?.[i] ?? null });
      if (previsao_chuva.length) fontes.push("Open-Meteo — previsão meteorológica diária (até 16 dias)");
      const sazonal = await buscarPrevisaoSazonal(Number(localidade.latitude), Number(localidade.longitude));
      previsao_sazonal.push(...sazonal);
      if (sazonal.length) fontes.push("CPTEC/INPE — previsão sazonal de precipitação (trimestres)");
      else avisos.push("Previsão sazonal do CPTEC/INPE ainda não disponível para a rodada mais recente.");
    } catch (error) {
      avisos.push(`Chuva indisponível para ${input.cidade}: ${error instanceof Error ? error.message : "erro de consulta"}`);
    }
  } else {
    avisos.push("Selecione um município identificado para consultar a chuva.");
  }

  return {
    localidade: localidade?.name || null,
    latitude: Number.isFinite(localidade?.latitude) ? Number(localidade?.latitude) : null,
    longitude: Number.isFinite(localidade?.longitude) ? Number(localidade?.longitude) : null,
    meses: Array.from(porMes.values()),
    previsao_chuva,
    expectativas_selic,
    previsao_sazonal,
    fontes,
    avisos,
    atualizado_em: new Date().toISOString(),
  };
}
