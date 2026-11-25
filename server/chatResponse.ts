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

export function formatChatResponse(query: ChatQueryResult, layer: FaturamentoAnalytics): string {
  if (query.status !== "answered") {
    return query.limitations.join(" ") || "Não encontrei uma resposta segura na base. Reformule a pergunta com período ou dimensão mais específica.";
  }

  const metricLabel = query.metric === "faturamento_valor" ? "faturamento bruto"
    : query.metric === "quantidade_faturada" ? "quantidade faturada"
      : query.metric.replaceAll("_", " ");
  const result = query.result as Record<string, any> | Record<string, any>[];
  let body: string;

  if (Array.isArray(result)) {
    const lines = result.slice(0, 10).map((item, index) => {
      const value = metricValue(item, query.metric);
      const label = String(item.nome ?? `Grupo ${index + 1}`);
      return `${index + 1}. ${label}: ${value === null ? "valor indisponível" : formatMetric(query.metric, value)}`;
    });
    body = `${metricLabel} por ${query.groupBy ?? "grupo"} (${result.length} grupos exibidos):\n${lines.join("\n")}`;
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
