import { CHAT_BUSINESS_DICTIONARY } from "../shared/chatDictionary";
import type { FaturamentoAnalytics } from "./faturamentoAnalytics";
import type { ChatQueryResult } from "./chatBaseQuery";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function metricValue(item: Record<string, any>, metric: string): number | null {
  const value = item.metricas?.[metric]
    ?? (metric === "faturamento_valor" ? item.faturamento : undefined)
    ?? (metric === "quantidade_faturada" ? item.quantidade : undefined)
    ?? (metric === "pedido" ? item.pedidos : undefined)
    ?? (metric === "cliente" ? item.clientes : undefined);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMetric(metric: string, value: number): string {
  const entry = CHAT_BUSINESS_DICTIONARY.find((item) => item.canonical === metric);
  const monetaryMetrics = new Set([
    "faturamento_valor", "custo", "frete", "faturamento_liquido_aprox", "ticket_unitario",
    "ipi", "pis", "cofins", "icms", "iss", "ir", "inss", "ii", "acessorio0", "acessorio1",
    "impostos_principais", "tributos_dre",
  ]);
  if (monetaryMetrics.has(metric)) {
    const formatted = money.format(value);
    return metric === "faturamento_liquido_aprox" ? `${formatted} (aproximado)` : formatted;
  }
  if (entry?.metricOperation === "countDistinct" || metric === "quantidade_faturada") return integer.format(value);
  return decimal.format(value);
}

function describeFilters(filters: Record<string, string>): string {
  const entries = Object.entries(filters);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(", ") : "nenhum filtro adicional";
}

function displayGroupLabel(value: unknown, groupBy: string | null): string {
  const label = String(value ?? "");
  if (groupBy === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [year, month, day] = label.split("-");
    return `${day}/${month}/${year}`;
  }
  if (groupBy === "mes" && /^\d{4}-\d{2}$/.test(label)) {
    const date = new Date(`${label}-01T00:00:00Z`);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return label;
}

export function formatChatResponse(query: ChatQueryResult, layer: FaturamentoAnalytics): string {
  if (query.status !== "answered") {
    return query.limitations.join(" ") || "Não encontrei uma resposta segura na base. Reformule a pergunta com período ou dimensão mais específica.";
  }

  const metricLabel = query.metric === "faturamento_valor" ? "faturamento bruto"
    : query.metric === "quantidade_faturada" ? "quantidade faturada"
      : query.metric.replaceAll("_", " ");
  const result = query.result as Record<string, any> | Record<string, any>[];
  let body: string;

  if (!Array.isArray(result) && result?.tipo === "ultima_carga") {
    const movementDate = displayGroupLabel(result.data_movimentacao, "dia");
    const loads = Array.isArray(result.cargas) ? result.cargas as Record<string, any>[] : [];
    const heading = result.totalCargas === 1
      ? `Última carga localizada: saída em ${movementDate}.`
      : `Última data de saída: ${movementDate}; ${integer.format(result.totalCargas || 0)} cargas registradas nessa data.`;
    const details = loads.map((load) => `Pedido ${load.pedido}; carreta/produto: ${load.produto}; cliente: ${load.cliente}; quantidade: ${integer.format(load.quantidade || 0)}; faturamento: ${money.format(load.faturamento || 0)}; representante: ${load.representante}.`);
    body = [heading, ...details].join("\n");
  } else if (Array.isArray(result)) {
    const lines = result.slice(0, 10).map((item, index) => {
      const value = metricValue(item, query.metric);
      const label = displayGroupLabel(item.nome ?? `Grupo ${index + 1}`, query.groupBy);
      return `${index + 1}. ${label}: ${value === null ? "valor indisponível" : formatMetric(query.metric, value)}`;
    });
    const singularLabel = result.length === 1 ? displayGroupLabel(result[0].nome, query.groupBy) : "";
    const singularValue = result.length === 1 ? metricValue(result[0], query.metric) : null;
    body = result.length === 1 && query.groupBy === "dia"
      ? `${metricLabel} em ${singularLabel}: ${singularValue === null ? "valor indisponível" : formatMetric(query.metric, singularValue)}.`
      : result.length === 1 && query.groupBy === "mes"
        ? `${metricLabel} no período ${singularLabel}: ${singularValue === null ? "valor indisponível" : formatMetric(query.metric, singularValue)}.`
        : `${metricLabel} por ${query.groupBy ?? "grupo"} (${result.length} grupo(s) exibido(s)):\n${lines.join("\n")}`;
  } else {
    const value = metricValue(result, query.metric);
    body = value === null
      ? "A consulta foi processada, mas não há um valor calculável para essa métrica."
      : `${metricLabel}: ${formatMetric(query.metric, value)}.`;
    if (typeof result.pedidos === "number") body += ` Pedidos/notas: ${integer.format(result.pedidos)}.`;
    if (typeof result.clientes === "number") body += ` Clientes: ${integer.format(result.clientes)}.`;
    if (typeof result.linhas === "number") body += ` Linhas: ${integer.format(result.linhas)}.`;
  }

  const notes = query.limitations.filter((note) =>
    query.metric === "quantidade_faturada" || !note.includes("quantidade corresponde"),
  );
  const coverage = layer.coverage.from && layer.coverage.to
    ? `${layer.coverage.from} a ${layer.coverage.to}`
    : "datas não identificadas";
  const metadata = `Fonte: ${layer.sourceName}, versão ${layer.sourceVersion.slice(0, 8)}; período consultado: ${query.period}; cobertura da base: ${coverage}; filtros: ${describeFilters(query.filters)}. Linhas válidas: ${integer.format(layer.validRowCount)}; ignoradas: ${integer.format(layer.ignoredRowCount)}.`;
  return [body, ...notes, metadata].filter(Boolean).join("\n\n");
}
