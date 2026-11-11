import { CHAT_BUSINESS_DICTIONARY, normalizarTermoChat } from "../shared/chatDictionary";

export type ChatQueryResult = {
  status: "answered" | "ambiguous" | "no_match";
  sourceVersion: string;
  period: string;
  metric: string;
  groupBy: string | null;
  filters: Record<string, string>;
  result: any;
  limitations: string[];
};

const monthNumbers: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

function fieldValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  const normalizedAliases = aliases.map(normalizarTermoChat);
  const key = keys.find((candidate) => normalizedAliases.includes(normalizarTermoChat(candidate)));
  return key ? row[key] : undefined;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(row: Record<string, unknown>): string | null {
  const value = fieldValue(row, ["data_emissao", "data emissão", "data_movimentacao", "data movimentação", "bai_emissao", "bai_movimentac", "data", "date"]);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : null;
}

function aggregate(rows: Record<string, unknown>[]) {
  const faturamentoField = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "faturamento_valor")!.fieldAliases;
  const quantityField = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "quantidade_faturada")!.fieldAliases;
  const pedidos = new Set(rows.map((row) => String(fieldValue(row, ["pedido", "numero pedido", "ordem", "documento"]) ?? "").trim()).filter(Boolean));
  const clientes = new Set(rows.map((row) => String(fieldValue(row, ["cliente", "comprador", "nome cliente"]) ?? "").trim()).filter(Boolean));
  const metricas: Record<string, number> = {};
  for (const entry of CHAT_BUSINESS_DICTIONARY.filter((item) => item.metricOperation)) {
    const values = rows.map((row) => fieldValue(row, entry.fieldAliases)).filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
    if (!values.length) continue;
    if (entry.metricOperation === "countDistinct") metricas[entry.canonical] = new Set(values.map(String)).size;
    else {
      const total = values.reduce<number>((sum, value) => sum + numberValue(value), 0);
      metricas[entry.canonical] = entry.metricOperation === "average" ? total / values.length : total;
    }
  }
  for (const key of Object.keys(rows[0] || {})) {
    const metricKey = normalizarTermoChat(key).replace(/\s+/g, "_");
    if (!metricKey || metricas[metricKey] !== undefined || /^(id|ano|year|mes|mes_num|month|dia|dia_mes)$/.test(metricKey)) continue;
    const values = rows.map((row) => row[key]).filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
    if (values.length && values.every((value) => typeof value === "number" || /^-?[\d.,]+$/.test(String(value).trim()))) {
      metricas[metricKey] = values.reduce<number>((sum, value) => sum + numberValue(value), 0);
    }
  }
  return {
    faturamento: rows.reduce((sum, row) => sum + numberValue(fieldValue(row, faturamentoField)), 0),
    quantidade: rows.reduce((sum, row) => sum + numberValue(fieldValue(row, quantityField)), 0),
    linhas: rows.length,
    pedidos: pedidos.size,
    clientes: clientes.size,
    metricas,
  };
}

export function queryPublishedBase(question: string, sourceRows: Record<string, unknown>[], sourceVersion: string): ChatQueryResult {
  const q = normalizarTermoChat(question);
  const result = (status: ChatQueryResult["status"], rows: Record<string, unknown>[], metric = "faturamento_valor", groupBy: string | null = null, filters: Record<string, string> = {}, period = "todo o período da base", limitations: string[] = []): ChatQueryResult => ({
    status, sourceVersion, period, metric, groupBy, filters, result: rows.length ? undefined : [], limitations,
  });
  const year = question.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  const monthName = Object.keys(monthNumbers).find((month) => (` ${q} `).includes(` ${month} `));
  const monthNumeric = question.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  const dateMatch = question.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/) || question.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  const exactDate = dateMatch ? (dateMatch[1].length === 4 ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`) : null;
  const month = monthNumeric ? `${monthNumeric[1]}-${monthNumeric[2].padStart(2, "0")}` : monthName ? `${year || new Date().getUTCFullYear()}-${monthNumbers[monthName]}` : null;
  if (!exactDate && /\bdia\s+\d{1,2}\b/.test(q)) return { ...result("ambiguous", []), limitations: ["Informe a data completa (dia, mês e ano) para consultar esse dia."] };
  if (/\bde\s+\d{1,2}\s+de\s+[\p{L}]+/u.test(q) && !exactDate) return { ...result("ambiguous", []), limitations: ["Informe também o ano para consultar essa data."] };
  if (/\bde\s+\d{1,2}\s+de\s+[\p{L}]+/u.test(q) && !exactDate) return { ...result("ambiguous", []), limitations: ["Informe também o ano para consultar essa data."] };
  const wantsProfit = /\b(lucro|lucros|margem|rentabilidade)\b/.test(q);
  const profitAliases = q.includes("margem") ? ["margem"] : q.includes("rentabilidade") ? ["rentabilidade"] : ["lucro", "lucros"];
  if (wantsProfit && !sourceRows.some((row) => fieldValue(row, profitAliases) !== undefined)) {
    return { ...result("no_match", []), limitations: ["A base publicada não possui campo de lucro/margem; faturamento não é lucro."] };
  }
  if (/\bimplementos?\b/.test(q) && !/\bcarretas?|semirreboques?\b/.test(q)) {
    return { ...result("ambiguous", []), limitations: ["Implemento é uma categoria ampla. Informe o tipo de produto desejado; o termo não foi assumido como sinônimo de carreta."] };
  }

  let explicitMetric: (typeof CHAT_BUSINESS_DICTIONARY)[number] | undefined = CHAT_BUSINESS_DICTIONARY
    .map((entry) => ({ entry, matchedLength: Math.max(0, ...entry.aliases.filter((alias) => (` ${q} `).includes(` ${normalizarTermoChat(alias)} `)).map((alias) => normalizarTermoChat(alias).length)) }))
    .filter(({ entry, matchedLength }) => entry.metricOperation && matchedLength > 0 && !(entry.metricOperation === "countDistinct" && /\b(cliente|clientes|pedido|pedidos)\b/.test(q) && !/\b(quantos?|quantidade|numero|total de|unicos?|diferentes?)\b/.test(q)))
    .filter(({ entry }) => entry.metricOperation !== "countDistinct" || /\b(quantos?|quantidade|numero|total de|clientes? unicos?|clientes? diferentes?)\b/.test(q))
    .sort((a, b) => b.matchedLength - a.matchedLength)[0]?.entry;
  const excludedDynamicMetricFields = new Set(["id", "ano", "year", "mes", "mes_num", "month", "dia", "dia_mes"]);
  const dynamicMetricField = !explicitMetric && /\b(total|valor|soma|quanto|media|medio|faturamento|quantidade|volume|custo|frete|imposto|tributo)\b/.test(q)
    ? Object.keys(sourceRows[0] || {}).find((key) => {
      const normalizedKey = normalizarTermoChat(key);
      if (!normalizedKey || excludedDynamicMetricFields.has(normalizedKey.replace(/\s+/g, "_")) || normalizedKey.length < 3) return false;
      const mentioned = (` ${q} `).includes(` ${normalizedKey} `);
      const numeric = sourceRows.some((row) => typeof row[key] === "number" || (typeof row[key] === "string" && /^-?[\d.,]+$/.test(row[key].trim())));
      return mentioned && numeric;
    })
    : undefined;
  const quantityEntry = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "quantidade_faturada")!;
  const amountEntry = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "faturamento_valor")!;
  const selectedMetricSafe = explicitMetric?.canonical === "lucro" ? { ...explicitMetric, fieldAliases: profitAliases } : explicitMetric;
  const hasQuantityIntent = (!explicitMetric || explicitMetric.canonical === "quantidade_faturada") && /\b(quantidade|unidades?|volume|mais vendid[oa]s?|mais produtos?|maior quantidade|vendeu mais|venderam mais|compraram mais produtos)\b/.test(q);
  const selectedMetric = hasQuantityIntent ? quantityEntry : selectedMetricSafe || (dynamicMetricField ? { canonical: normalizarTermoChat(dynamicMetricField).replace(/\s+/g, "_"), fieldAliases: [dynamicMetricField], metricOperation: "sum" as const } : amountEntry);
  const metric = selectedMetric.canonical;
  const metricField = selectedMetric.fieldAliases;
  const rowsWithMetric = sourceRows.filter((row) => fieldValue(row, metricField) !== undefined);
  if (!rowsWithMetric.length) return { ...result("no_match", []), limitations: [`A base não contém coluna reconhecida para ${hasQuantityIntent ? "quantidade faturada" : "faturamento"}.`] };

  const dateRows = rowsWithMetric.filter((row) => dateValue(row));
  let filtered = rowsWithMetric;
  const filters: Record<string, string> = {};
  if (exactDate) {
    filtered = filtered.filter((row) => dateValue(row) === exactDate);
    filters.data = exactDate;
  }
  if (year) {
    if (dateRows.length) filtered = filtered.filter((row) => dateValue(row)?.startsWith(`${year}-`));
    else {
      const yearField = Object.keys(rowsWithMetric[0] || {}).find((key) => /^(ano|year)$/i.test(key));
      if (yearField) filtered = filtered.filter((row) => String(row[yearField]) === year);
    }
    filters.ano = year;
  }
  if (month) {
    filtered = filtered.filter((row) => dateValue(row)?.startsWith(`${month}-`));
    filters.mes = month;
  }
  if (/\bcarretas?\b|\bsemirreboques?\b/.test(q)) {
    const typeField = fieldValue(rowsWithMetric[0] || {}, ["tipo_produto", "tipo produto", "categoria_produto", "categoria produto"]) !== undefined ? ["tipo_produto", "tipo produto", "categoria_produto", "categoria produto"] : ["produto", "item", "agrupamento"];
    filtered = filtered.filter((row) => normalizarTermoChat(String(fieldValue(row, typeField) ?? "")).includes("carreta"));
    filters.tipo_produto = "Carreta";
  }

  const ignoredValues = new Set([
    ...CHAT_BUSINESS_DICTIONARY.flatMap((entry) => [...entry.aliases, entry.canonical].map(normalizarTermoChat)),
    "mais", "maior", "menor", "ranking", "faturamento", "quantidade", "vendido", "vendida", "vendidos", "vendidas", "ano", "mes", "dia", "periodo", "em", "por", "de", "do", "da", "para", "qual", "quais", "quem", "teve", "meu", "todo", "toda", "base",
  ]);
  if (/\b(menor|menores|menos|pior|piores)\b/.test(q)) explicitMetric = undefined;
  const explicitNamedFilter = question.match(/\b(?:para|do representante|da representante|vendedor|vendedora)\s+([\p{L}][\p{L} .'-]{1,40}?)(?=\s+(?:em|no ano|por|com)\b|\s*\??$)/iu)
    || question.match(/\b(?:do cliente|da cliente)\s+([\p{L}][\p{L} .'-]{1,50}?)(?=\s+(?:em|no ano|por|com)\b|\s*\??$)/iu)
    || question.match(/\b(?:UF|estado|em)\s+([A-Z]{2})\s*\??$/i);
  let namedDimension: string | undefined;
  if (explicitNamedFilter) {
    const requested = explicitNamedFilter[1].trim();
    namedDimension = /\b(?:para|do representante|da representante|vendedor|vendedora)\b/i.test(explicitNamedFilter[0]) ? "representante" : /\b(?:do cliente|da cliente)\b/i.test(explicitNamedFilter[0]) ? "cliente" : "uf";
    const aliases = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === namedDimension)!.fieldAliases;
    const exists = sourceRows.some((row) => normalizarTermoChat(String(fieldValue(row, aliases) ?? "")) === normalizarTermoChat(requested));
    if (!exists) return { ...result("no_match", [], metric, null, { [namedDimension]: requested }, exactDate || month || year || "todo o período da base"), limitations: [`Não encontrei "${requested}" na base para o filtro ${namedDimension}.`] };
    filtered = filtered.filter((row) => normalizarTermoChat(String(fieldValue(row, aliases) ?? "")) === normalizarTermoChat(requested));
    filters[namedDimension] = requested;
  }
  const matchedValues = new Map<string, { field: string; value: string }>();
  for (const row of filtered) {
    for (const [field, rawValue] of Object.entries(row)) {
      if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
      const value = String(rawValue).trim();
      const normalizedValue = normalizarTermoChat(value);
      const isUf = normalizarTermoChat(field) === "uf" && /^[a-z]{2}$/i.test(value);
      if ((!isUf && normalizedValue.length < 3) || ignoredValues.has(normalizedValue) || /^\d+$/.test(normalizedValue)) continue;
      if ((` ${q} `).includes(` ${normalizedValue} `)) matchedValues.set(`${field}:${normalizedValue}`, { field, value });
    }
  }
  for (const { field, value } of matchedValues.values()) {
    if (namedDimension && normalizarTermoChat(field) === namedDimension) continue;
    filtered = filtered.filter((row) => normalizarTermoChat(String(row[field] ?? "")) === normalizarTermoChat(value));
    filters[field] = value;
  }
  let groupEntry = CHAT_BUSINESS_DICTIONARY.find((entry) => ["representante", "cliente", "municipio", "uf", "produto", "modelo", "familia", "regiao", "tipo_venda", "cor", "grupo_modelo", "lista_preco_uf", "descricao_generica", "pedido"].includes(entry.canonical) && entry.aliases.some((alias) => (` ${q} `).includes(` ${normalizarTermoChat(alias)} `)));
  const temporalGroup = /\b(por ano|anual|ano a ano)\b/.test(q) ? "ano" : /\b(por mes|mensal|mes a mes)\b/.test(q) ? "mes" : null;
  const dimensionAsked = Boolean(temporalGroup) || /\b(por|ranking|rank|melhor|maior|menor|quem|quais|qual|detalhe|detalhar|compare|comparar|mais)\b/.test(q);
  const entityMetricRequested = /\b(quantos?|quantidade|numero|total de|clientes? unicos?|clientes? diferentes?|pedidos? distintos?)\b/.test(q);
  if (groupEntry?.metricOperation === "countDistinct" && !entityMetricRequested && !/\bcompraram mais produtos\b/.test(q)) groupEntry = undefined;
  if (!groupEntry && /mais vendid[oa]s?|maior quantidade/.test(q)) groupEntry = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "produto");
  if (!groupEntry && /compraram mais produtos/.test(q)) groupEntry = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === "cliente");
  const dynamicDimensionField = !groupEntry && !temporalGroup && dimensionAsked
    ? Object.keys(rowsWithMetric[0] || {}).find((key) => {
      const normalizedKey = normalizarTermoChat(key);
      if (!normalizedKey || normalizedKey.length < 3 || /^(data|data emissao|data movimento|faturamento|quantidade|id|ano|mes|mes num|dia|dia mes)$/.test(normalizedKey)) return false;
      const namedAfterPor = (` ${q} `).includes(` por ${normalizedKey} `);
      const categorical = rowsWithMetric.some((row) => typeof row[key] === "string" && row[key].trim() !== "");
      return namedAfterPor && categorical;
    })
    : undefined;
  const unsupportedDimension = !groupEntry && !temporalGroup && /\bpor\s+[\p{L}][\p{L} ]{1,40}/u.test(q) && !dynamicDimensionField;
  if (unsupportedDimension) return { ...result("no_match", [], metric), limitations: ["A dimensão pedida não está disponível como coluna na base publicada. Informe uma dimensão existente, como representante, cliente, município, UF ou produto."] };
  const groupBy = temporalGroup || (groupEntry && dimensionAsked ? groupEntry.canonical : dynamicDimensionField ? normalizarTermoChat(dynamicDimensionField).replace(/\s+/g, "_") : null);
  if (groupBy === "lucro" || groupBy === "implemento") groupEntry = undefined;
  const period = exactDate || month || (year ? year : "todo o período da base");
  const baseResult = result("answered", filtered, metric, groupBy || null, filters, period);
  if (!filtered.length) return { ...baseResult, status: "no_match", result: [], limitations: [`Não há linhas correspondentes ao período e aos filtros solicitados (${period}).`] };

  let data: any;
  let truncatedGroups = 0;
  if (temporalGroup) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of filtered) {
      const date = dateValue(row);
      if (!date) continue;
      const key = temporalGroup === "ano" ? date.slice(0, 4) : date.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    const ascending = /\b(menor|menores|menos|pior|piores)\b/.test(q);
    const allGroups = Array.from(groups, ([nome, groupRows]) => ({ nome, ...aggregate(groupRows) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    truncatedGroups = Math.max(0, allGroups.length - 20);
    data = temporalGroup === "mes" ? allGroups.slice(-20) : allGroups.slice(0, 20);
  } else if ((groupEntry || dynamicDimensionField) && groupBy) {
    const aliases = groupEntry?.fieldAliases || [dynamicDimensionField!];
    const dimensionField = Object.keys(filtered[0] || {}).find((key) => aliases.map(normalizarTermoChat).includes(normalizarTermoChat(key)));
    if (!dimensionField) return { ...baseResult, status: "no_match", result: [], limitations: [`A base não possui uma coluna correspondente a ${groupEntry?.canonical || dynamicDimensionField}.`] };
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of filtered) {
      const name = String(row[dimensionField] ?? "Não informado").trim() || "Não informado";
      groups.set(name, [...(groups.get(name) || []), row]);
    }
    const ascending = /\b(menor|menores|menos|pior|piores|mais baixo|mais baixa)\b/.test(q);
    const allGroups = Array.from(groups, ([nome, groupRows]) => ({ nome, ...aggregate(groupRows) }))
      .sort((a, b) => (ascending ? 1 : -1) * (Number(a.metricas?.[metric] ?? a[metric === "quantidade_faturada" ? "quantidade" : "faturamento"] ?? 0) - Number(b.metricas?.[metric] ?? b[metric === "quantidade_faturada" ? "quantidade" : "faturamento"] ?? 0)) || a.nome.localeCompare(b.nome, "pt-BR"));
    truncatedGroups = Math.max(0, allGroups.length - 20);
    data = allGroups.slice(0, 20);
  } else data = aggregate(filtered);

  return { ...baseResult, result: data, limitations: ["A quantidade corresponde às linhas faturadas e não comprova produção física.", ...(truncatedGroups ? [`Exibindo 20 grupos; ${truncatedGroups} grupos adicionais foram omitidos.`] : [])] };
}
