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

function movementDateValue(row: Record<string, unknown>): string | null {
  const value = fieldValue(row, ["data_movimento", "data movimentacao", "bai_movimentac"]);
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

export function queryPublishedBase(
  question: string,
  sourceRows: Record<string, unknown>[],
  sourceVersion: string,
  capabilities?: {
    availableMetrics?: string[];
    availableDimensions?: string[];
    indexes?: Record<string, Record<string, number[]>>;
    missingMetricRows?: Record<string, number>;
  },
): ChatQueryResult {
  const q = normalizarTermoChat(question);
  const result = (status: ChatQueryResult["status"], rows: Record<string, unknown>[], metric = "faturamento_valor", groupBy: string | null = null, filters: Record<string, string> = {}, period = "todo o período da base", limitations: string[] = []): ChatQueryResult => ({
    status, sourceVersion, period, metric, groupBy, filters, result: rows.length ? undefined : [], limitations,
  });
  const comparedYears = Array.from(new Set(Array.from(question.matchAll(/\b(19\d{2}|20\d{2})\b/g), (match) => match[1])));
  if (comparedYears.length >= 2 && /\b(compare|comparar|comparacao|comparativo|comparativos|comparando|diferen[cç]a|ano a ano|versus|vs)\b/.test(q)) {
    const requestedMonths = Object.keys(monthNumbers).filter((month) => (` ${q} `).includes(` ${month} `));
    if (requestedMonths.length > 1) {
      return { ...result("ambiguous", []), limitations: ["Para comparar anos, informe o mesmo mês para os dois anos ou remova os meses da pergunta. A comparação atual não interpreta dois meses diferentes em uma única consulta."] };
    }
    const baseQuestion = question.replace(/\b(19\d{2}|20\d{2})\b/g, " ");
    const comparisons = comparedYears.slice(0, 2).map((year) => ({
      year,
      query: queryPublishedBase(`${baseQuestion} ${year}`, sourceRows, sourceVersion, capabilities),
    }));
    const failed = comparisons.find(({ query }) => query.status !== "answered");
    if (failed) return { ...failed.query, limitations: [`Não foi possível comparar os anos solicitados. ${failed.query.limitations.join(" ")}`] };
    const metric = comparisons[0].query.metric;
    const values = comparisons.map(({ year, query }) => {
      const aggregate = query.result as Record<string, any>;
      const value = aggregate?.metricas?.[metric]
        ?? (metric === "faturamento_valor" ? aggregate?.faturamento : undefined)
        ?? (metric === "quantidade_faturada" ? aggregate?.quantidade : undefined);
      return { year, value: typeof value === "number" && Number.isFinite(value) ? value : null };
    });
    const first = values[0];
    const second = values[1];
    if (!first || !second || first.value === null || second.value === null) return { ...result("no_match", [], metric), limitations: ["A base não tem valores calculáveis para todos os anos solicitados."] };
    const difference = second.value - first.value;
    const variation = first.value === 0 ? null : difference / Math.abs(first.value);
    const items = [first, second].map(({ year, value }) => ({ nome: year, metricas: { [metric]: value } }));
    const differenceDisplay = ["faturamento_valor", "custo", "frete", "ticket_unitario", "faturamento_liquido_aprox", "ipi", "pis", "cofins", "icms", "iss", "ir", "inss", "ii", "impostos_principais", "tributos_dre"].includes(metric)
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(difference)
      : difference.toLocaleString("pt-BR");
    const note = variation === null
      ? `Variação entre ${first.year} e ${second.year}: ${differenceDisplay} (não há percentual porque o valor de referência é zero).`
      : `Variação de ${first.year} para ${second.year}: ${differenceDisplay} (${new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(variation)}).`;
    return {
      ...result("answered", [], metric, "ano", { anos: comparedYears.slice(0, 2).join(", ") }, `${first.year} vs ${second.year}`),
      result: items,
      limitations: [note],
    };
  }
  const year = question.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  const monthName = Object.keys(monthNumbers).find((month) => (` ${q} `).includes(` ${month} `));
  const monthNumeric = question.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  const dateMatch = question.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/) || question.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  const exactDate = dateMatch ? (dateMatch[1].length === 4 ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`) : null;
  const previousMonthRequested = /\b(mes passado|mes anterior|ultimo mes)\b/.test(q);
  const currentMonthRequested = /\b(este mes|nesse mes|mes atual)\b/.test(q);
  const saoPauloDateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
  }).formatToParts(new Date()).filter((part) => part.type !== "literal").map(({ type, value }) => [type, value]));
  const currentYear = Number(saoPauloDateParts.year);
  const currentMonthNumber = Number(saoPauloDateParts.month);
  const relativeMonthDate = new Date(Date.UTC(currentYear, currentMonthNumber - (previousMonthRequested ? 2 : 1), 1));
  const relativeMonth = `${relativeMonthDate.getUTCFullYear()}-${String(relativeMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = monthNumeric ? `${monthNumeric[1]}-${monthNumeric[2].padStart(2, "0")}` : monthName ? `${year || currentYear}-${monthNumbers[monthName]}` : previousMonthRequested || currentMonthRequested ? relativeMonth : null;
  if (!exactDate && /\bdia\s+\d{1,2}\b/.test(q)) return { ...result("ambiguous", []), limitations: ["Informe a data completa (dia, mês e ano) para consultar esse dia."] };
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
  if (capabilities?.availableMetrics && !capabilities.availableMetrics.includes(metric)) {
    const metricName = CHAT_BUSINESS_DICTIONARY.find((entry) => entry.canonical === metric)?.definition || metric.replaceAll("_", " ");
    return { ...result("no_match", [], metric), limitations: [`A planilha atual não tem todas as colunas necessárias para calcular essa métrica (${metricName}).`] };
  }
  const metricField = selectedMetric.fieldAliases;
  const rowsWithMetric = sourceRows.filter((row) => fieldValue(row, metricField) !== undefined);
  if (!rowsWithMetric.length) return { ...result("no_match", []), limitations: [`A base não contém valores preenchidos para ${hasQuantityIntent ? "quantidade faturada" : metric.replaceAll("_", " ")}.`] };

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
  const asksLatestDispatch = /\b(ultima|ultimo|mais recente|recente)\b/.test(q)
    && /\b(carga|carreta|saiu|saida|embarque|movimentacao)\b/.test(q);
  if (asksLatestDispatch) {
    const productFields = new Set(["produto", "familia", "grupo modelo", "descricao generica", "categoria produto", "tipo produto", "1o agrupamento"]);
    const matchedProduct = Array.from(matchedValues.values()).some(({ field }) => productFields.has(normalizarTermoChat(field)));
    if (!matchedProduct) {
      return { ...result("ambiguous", [], metric, "ultima_carga", filters), limitations: ["Informe o código ou o nome da carreta para localizar sua última saída."] };
    }
    if (!filtered.length) {
      return { ...result("no_match", [], metric, "ultima_carga", filters), limitations: ["Não encontrei essa carreta na base com os filtros informados."] };
    }
    const movementRows = filtered.map((row) => ({ row, date: movementDateValue(row) })).filter((item): item is { row: Record<string, unknown>; date: string } => Boolean(item.date));
    if (!movementRows.length) {
      return { ...result("no_match", [], metric, "ultima_carga", filters), limitations: ["Não há datas preenchidas em BAI_MOVIMENTAC para localizar a última saída dessa carreta."] };
    }
    const latestDate = movementRows.reduce((latest, item) => item.date > latest ? item.date : latest, movementRows[0].date);
    const latestRows = movementRows.filter((item) => item.date === latestDate);
    const loads = new Map<string, { pedido: string; clientes: Set<string>; produtos: Set<string>; representantes: Set<string>; cidades: Set<string>; ufs: Set<string>; quantidade: number; faturamento: number; linhas: number }>();
    for (const [rowIndex, { row }] of latestRows.entries()) {
      const pedido = String(fieldValue(row, ["pedido", "numero pedido", "ordem", "documento"]) ?? "").trim();
      const loadKey = pedido || String(fieldValue(row, ["id"]) ?? `sem-pedido-${rowIndex}`);
      const load = loads.get(loadKey) || { pedido: pedido || "Não informado", clientes: new Set<string>(), produtos: new Set<string>(), representantes: new Set<string>(), cidades: new Set<string>(), ufs: new Set<string>(), quantidade: 0, faturamento: 0, linhas: 0 };
      const addValue = (set: Set<string>, aliases: string[]) => { const value = String(fieldValue(row, aliases) ?? "").trim(); if (value) set.add(value); };
      addValue(load.clientes, ["cliente_base", "cliente", "comprador"]);
      addValue(load.produtos, ["produto", "item", "agrupamento"]);
      addValue(load.representantes, ["representante", "vendedor"]);
      addValue(load.cidades, ["cidade", "municipio"]);
      addValue(load.ufs, ["uf", "estado"]);
      load.quantidade += numberValue(fieldValue(row, ["quantidade", "qtd", "qtde"]));
      load.faturamento += numberValue(fieldValue(row, ["faturamento", "total", "valor faturado"]));
      load.linhas += 1;
      loads.set(loadKey, load);
    }
    const cargas = Array.from(loads.values()).map((load) => ({
      pedido: load.pedido, cliente: Array.from(load.clientes).join(", ") || "Não informado",
      produto: Array.from(load.produtos).join(", ") || "Não informado",
      representante: Array.from(load.representantes).join(", ") || "Não informado",
      cidade: Array.from(load.cidades).join(", ") || "Não informado", uf: Array.from(load.ufs).join(", ") || "Não informado",
      quantidade: load.quantidade, faturamento: load.faturamento, linhas: load.linhas,
    })).sort((a, b) => b.faturamento - a.faturamento).slice(0, 10);
    return { ...result("answered", [], metric, "ultima_carga", filters, latestDate), result: { tipo: "ultima_carga", data_movimentacao: latestDate, totalCargas: loads.size, cargas }, limitations: [] };
  }
  const groupCandidates = CHAT_BUSINESS_DICTIONARY
    .filter((entry) => ["representante", "cliente", "municipio", "uf", "produto", "tipo_produto", "categoria_produto", "modelo", "familia", "regiao", "tipo_venda", "cor", "grupo_modelo", "lista_preco_uf", "descricao_generica", "pedido"].includes(entry.canonical))
    .flatMap((entry) => entry.aliases.map((alias) => ({ entry, alias: normalizarTermoChat(alias) })))
    .filter(({ alias }) => alias && (` ${q} `).includes(` por ${alias} `))
    .sort((a, b) => b.alias.length - a.alias.length);
  let groupEntry = groupCandidates[0]?.entry || CHAT_BUSINESS_DICTIONARY.find((entry) => ["representante", "cliente", "municipio", "uf", "produto", "tipo_produto", "categoria_produto", "modelo", "familia", "regiao", "tipo_venda", "cor", "grupo_modelo", "lista_preco_uf", "descricao_generica", "pedido"].includes(entry.canonical) && entry.aliases.some((alias) => (` ${q} `).includes(` ${normalizarTermoChat(alias)} `)));
  const asksRankedDay = /\b(melhor dia|pior dia)\b/.test(q) || (/\bdia\b/.test(q) && /\b(maior|mais|menor|menos|pico)\b/.test(q));
  const asksRankedMonth = /\b(mes|periodo)\b/.test(q)
    && /\b(maior|mais|melhor|pico)\b/.test(q)
    && /\b(qual|em qual|maior|melhor)\b/.test(q);
  const temporalGroup = asksRankedDay || /\b(por dia|dia a dia|diario|diaria)\b/.test(q) ? "dia"
    : asksRankedMonth || /\b(por mes|mensal|mes a mes)\b/.test(q) ? "mes"
      : /\b(por ano|anual|ano a ano)\b/.test(q) ? "ano" : null;
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
  if (groupBy && capabilities?.availableDimensions && !capabilities.availableDimensions.includes(groupBy)) {
    return { ...result("no_match", [], metric, groupBy, filters), limitations: [`A dimensão "${groupBy.replaceAll("_", " ")}" não tem valores disponíveis na base atual.`] };
  }
  const period = exactDate || month || (year ? year : "todo o período da base");
  const baseResult = result("answered", filtered, metric, groupBy || null, filters, period);
  if (!filtered.length) return { ...baseResult, status: "no_match", result: [], limitations: [`Não há linhas correspondentes ao período e aos filtros solicitados (${period}).`] };

  let data: any;
  let truncatedGroups = 0;
  let displayedGroupLimit = 20;
  if (temporalGroup) {
    let groups = new Map<string, Record<string, unknown>[]>();
    const index = Object.keys(filters).length === 0 ? capabilities?.indexes?.[temporalGroup] : undefined;
    if (index) {
      groups = new Map(Object.entries(index).map(([name, rowIndexes]) => [
        name,
        rowIndexes.map((rowIndex) => sourceRows[rowIndex]).filter((row) => fieldValue(row, metricField) !== undefined),
      ] as const).filter(([, groupRows]) => groupRows.length > 0));
    } else {
      for (const row of filtered) {
        const date = dateValue(row);
        if (!date) continue;
        const key = temporalGroup === "ano" ? date.slice(0, 4) : temporalGroup === "mes" ? date.slice(0, 7) : date;
        groups.set(key, [...(groups.get(key) || []), row]);
      }
    }
    const periodRanking = (temporalGroup === "dia" || temporalGroup === "mes") && /\b(melhor|maior|maximo|pico|pior|menor|minimo|mais)\b/.test(q);
    const ascending = /\b(menor|menores|menos|pior|piores|minimo)\b/.test(q);
    const allGroups = Array.from(groups, ([nome, groupRows]) => ({ nome, ...aggregate(groupRows) }));
    const metricValue = (group: typeof allGroups[number]) => Number(group.metricas?.[metric] ?? (metric === "quantidade_faturada" ? group.quantidade : group.faturamento));
    allGroups.sort(periodRanking
      ? (a, b) => (ascending ? 1 : -1) * (metricValue(a) - metricValue(b)) || a.nome.localeCompare(b.nome, "pt-BR")
      : (a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    displayedGroupLimit = periodRanking ? 1 : 20;
    truncatedGroups = Math.max(0, allGroups.length - displayedGroupLimit);
    data = periodRanking ? allGroups.slice(0, 1) : temporalGroup === "mes" || temporalGroup === "dia" ? allGroups.slice(-20) : allGroups.slice(0, 20);
  } else if ((groupEntry || dynamicDimensionField) && groupBy) {
    const aliases = groupEntry?.fieldAliases || [dynamicDimensionField!];
    const dimensionField = Object.keys(filtered[0] || {}).find((key) => aliases.map(normalizarTermoChat).includes(normalizarTermoChat(key)));
    if (!dimensionField) return { ...baseResult, status: "no_match", result: [], limitations: [`A base não possui uma coluna correspondente a ${groupEntry?.canonical || dynamicDimensionField}.`] };
    let groups = new Map<string, Record<string, unknown>[]>();
    const index = Object.keys(filters).length === 0 ? capabilities?.indexes?.[groupBy] : undefined;
    if (index) {
      groups = new Map(Object.entries(index).map(([name, rowIndexes]) => [
        name,
        rowIndexes.map((rowIndex) => sourceRows[rowIndex]).filter((row) => fieldValue(row, metricField) !== undefined),
      ] as const).filter(([, groupRows]) => groupRows.length > 0));
    } else {
      for (const row of filtered) {
        const name = String(row[dimensionField] ?? "Não informado").trim() || "Não informado";
        groups.set(name, [...(groups.get(name) || []), row]);
      }
    }
    const ascending = /\b(menor|menores|menos|pior|piores|mais baixo|mais baixa)\b/.test(q);
    const allGroups = Array.from(groups, ([nome, groupRows]) => ({ nome, ...aggregate(groupRows) }))
      .sort((a, b) => (ascending ? 1 : -1) * (Number(a.metricas?.[metric] ?? a[metric === "quantidade_faturada" ? "quantidade" : "faturamento"] ?? 0) - Number(b.metricas?.[metric] ?? b[metric === "quantidade_faturada" ? "quantidade" : "faturamento"] ?? 0)) || a.nome.localeCompare(b.nome, "pt-BR"));
    truncatedGroups = Math.max(0, allGroups.length - 20);
    data = allGroups.slice(0, 20);
  } else data = aggregate(filtered);

  const missingRows = capabilities?.missingMetricRows?.[metric] || 0;
  const limitations = [
    ...(metric === "quantidade_faturada" ? ["A quantidade corresponde às linhas faturadas e não comprova produção física."] : []),
    ...(missingRows ? [`Na base completa, ${missingRows} linha(s) válida(s) não têm valor para esta métrica; esses campos ausentes não foram tratados como zero.`] : []),
    ...(truncatedGroups ? [`Exibindo ${displayedGroupLimit} grupo(s); ${truncatedGroups} grupos adicionais foram omitidos.`] : []),
  ];
  return { ...baseResult, result: data, limitations };
}
