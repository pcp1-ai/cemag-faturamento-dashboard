import type { ChatQueryResult } from "./chatBaseQuery";
import type { ChatDictionaryEntry } from "../shared/chatDictionary";
import { queryPublishedBase } from "./chatBaseQuery";

export function buildChatSuggestions(_question: string, query: ChatQueryResult, dictionary: ChatDictionaryEntry[], rows: Record<string, unknown>[] = []): string[] {
  if (query.status !== "answered" || !query.result || (Array.isArray(query.result) && query.result.length === 0)) return [];
  const period = query.filters.data || query.filters.mes || query.filters.ano || query.period;
  const periodSuffix = period !== "todo o período da base" ? ` em ${period}` : "";
  const topName = Array.isArray(query.result) && query.result.length ? String(query.result[0]?.nome || "") : "";
  const suggestions: string[] = [];

  if (query.groupBy === "ano" && topName) {
    suggestions.push(`Como foi o faturamento mês a mês em ${topName}?`);
    suggestions.push(`Quais produtos tiveram maior faturamento em ${topName}?`);
    suggestions.push(`Qual representante teve maior faturamento em ${topName}?`);
  } else if (query.groupBy === "mes" && topName) {
    suggestions.push(`Qual representante teve maior faturamento em ${topName}?`);
    suggestions.push(`Quais produtos foram mais vendidos em ${topName}?`);
    suggestions.push(`Qual município teve maior faturamento em ${topName}?`);
  } else if (query.groupBy === "representante" && topName) {
    suggestions.push(`Quais produtos tiveram maior faturamento para ${topName}${periodSuffix}?`);
    suggestions.push(`Em quais municípios ${topName} mais vendeu${periodSuffix}?`);
    suggestions.push(`Qual representante teve maior quantidade faturada${periodSuffix}?`);
  } else if (["produto", "modelo", "familia"].includes(query.groupBy || "")) {
    suggestions.push(`Quais clientes compraram mais produtos${periodSuffix}?`);
    suggestions.push(`Qual representante teve maior faturamento${periodSuffix}?`);
    suggestions.push(`Quais municípios tiveram maior quantidade faturada${periodSuffix}?`);
  } else if (["cliente", "municipio", "uf"].includes(query.groupBy || "")) {
    suggestions.push(`Quais produtos tiveram maior faturamento${periodSuffix}?`);
    suggestions.push(`Qual representante teve maior faturamento${periodSuffix}?`);
    suggestions.push(`Quais representantes tiveram maior quantidade faturada${periodSuffix}?`);
  } else {
    suggestions.push(`Qual representante teve maior faturamento${periodSuffix}?`);
    suggestions.push(`Quais produtos foram mais vendidos${periodSuffix}?`);
    suggestions.push(`Quais municípios tiveram maior faturamento${periodSuffix}?`);
  }
  const fields = new Set(Object.keys(rows[0] || {}).map((field) => field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")));
  const supportedSuggestions = suggestions.filter((suggestion) => {
    const normalized = suggestion.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const requestedEntry = dictionary.find((entry) => entry.aliases.some((alias) => normalized.includes(alias.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"))));
    if (requestedEntry && requestedEntry.fieldAliases.every((alias) => !fields.has(alias.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")))) return false;
    const requestedYear = suggestion.match(/\b20\d{2}\b/)?.[0];
    const hasDate = ["data_emissao", "data", "date"].some((field) => fields.has(field));
    return !requestedYear || !hasDate || rows.some((row) => Object.values(row).some((value) => String(value).startsWith(requestedYear)));
  });
  return supportedSuggestions.filter((suggestion) => queryPublishedBase(suggestion, rows, query.sourceVersion).status === "answered").slice(0, 3);
}
