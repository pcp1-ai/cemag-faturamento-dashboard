import { describe, expect, it } from "vitest";
import { buildChatSuggestions } from "./chatSuggestions";
import type { ChatQueryResult } from "./chatBaseQuery";
import { queryPublishedBase } from "./chatBaseQuery";
import { CHAT_BUSINESS_DICTIONARY } from "../shared/chatDictionary";

const makeQuery = (groupBy: string | null, result: any, status: ChatQueryResult["status"] = "answered"): ChatQueryResult => ({
  status, sourceVersion: "v1", period: "2025", metric: "faturamento_valor", groupBy, filters: { ano: "2025" }, result, limitations: [],
});

const rows = [
  { data_emissao: "2025-01-10", faturamento: 1200, quantidade: 2, representante: "Ana", cliente: "Loja A", produto: "Carreta Graneleira", cidade: "Campinas", tipo_produto: "Carreta" },
  { data_emissao: "2025-01-12", faturamento: 800, quantidade: 1, representante: "Bruno", cliente: "Loja B", produto: "Carreta Baú", cidade: "Santos", tipo_produto: "Carreta" },
];

describe("buildChatSuggestions", () => {
  it("suggests continuations using the returned representative ranking", () => {
    const suggestions = buildChatSuggestions("ranking por vendedor", makeQuery("representante", [{ nome: "Ana" }]), CHAT_BUSINESS_DICTIONARY, rows);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("suggests relevant follow-ups for product queries only when answerable", () => {
    const suggestions = buildChatSuggestions("produto mais vendido", makeQuery("produto", [{ nome: "Carreta Baú" }]), CHAT_BUSINESS_DICTIONARY, rows);
    expect(suggestions).toContain("Quais clientes compraram mais produtos em 2025?");
    for (const suggestion of suggestions) expect(queryPublishedBase(suggestion, rows, "v1").status).toBe("answered");
  });

  it("can submit a representative follow-up as a filtered base query", () => {
    const initial = queryPublishedBase("ranking por vendedor em 2025", rows, "v1");
    const [followUp] = buildChatSuggestions("ranking por vendedor em 2025", initial, CHAT_BUSINESS_DICTIONARY, rows);
    expect(followUp).toBeDefined();
    const result = queryPublishedBase(followUp, rows, "v1");
    expect(result.status).toBe("answered");
    expect(result.filters.representante).toBe("Ana");
    expect(result.result[0]).toMatchObject({ nome: "Carreta Graneleira", faturamento: 1200 });
  });

  it("does not suggest questions when query is ambiguous, empty, or unavailable", () => {
    expect(buildChatSuggestions("implementos", makeQuery(null, [], "ambiguous"), CHAT_BUSINESS_DICTIONARY, rows)).toEqual([]);
    expect(buildChatSuggestions("faturamento 2030", makeQuery(null, [], "no_match"), CHAT_BUSINESS_DICTIONARY, rows)).toEqual([]);
  });

  it("filters suggestions that require fields absent from the published base", () => {
    const sparseRows = [{ faturamento: 100 }];
    const suggestions = buildChatSuggestions("faturamento", makeQuery(null, { faturamento: 100 }), CHAT_BUSINESS_DICTIONARY, sparseRows);
    expect(suggestions).toEqual([]);
  });
});
