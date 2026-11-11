import { describe, expect, it } from "vitest";
import { queryPublishedBase } from "./chatBaseQuery";

const rows = [
  { data_emissao: "2025-01-10", faturamento: 1200, quantidade: 2, frete: 100, icms: 80, segmento: "Agro", representante: "Ana", cliente: "Loja A", cidade: "Campinas", uf: "SP", produto: "Carreta Graneleira", tipo_produto: "Carreta", familia: "Graneleira" },
  { data_emissao: "2025-01-22", faturamento: 900, quantidade: 3, frete: 80, icms: 50, segmento: "Construção", representante: "Bruno", cliente: "Loja B", cidade: "Santos", uf: "SP", produto: "Carreta Baú", tipo_produto: "Carreta", familia: "Baú" },
  { data_emissao: "2024-03-04", faturamento: 500, quantidade: 1, frete: 20, icms: 25, segmento: "Agro", representante: "Ana", cliente: "Loja C", cidade: "Campinas", uf: "SP", produto: "Kit Reparo", tipo_produto: "Peça", familia: "Peças" },
];

describe("queryPublishedBase", () => {
  it("calculates complete totals and filters the requested year", () => {
    const result = queryPublishedBase("faturamento em 2025", rows, "v1");
    expect(result.status).toBe("answered");
    expect(result.result).toMatchObject({ faturamento: 2100, quantidade: 5, linhas: 2 });
    expect(result.period).toContain("2025");
  });

  it("filters an exact day instead of returning the whole year's total", () => {
    const result = queryPublishedBase("quanto foi faturado em 10/01/2025?", rows, "v1");
    expect(result.period).toBe("2025-01-10");
    expect(result.filters.data).toBe("2025-01-10");
    expect(result.result).toMatchObject({ faturamento: 1200, quantidade: 2, linhas: 1 });
  });

  it("filters a numeric year-month period", () => {
    const result = queryPublishedBase("faturamento em 2025-01", rows, "v1");
    expect(result.period).toBe("2025-01");
    expect(result.result).toMatchObject({ faturamento: 2100, linhas: 2 });
  });

  it("filters a two-letter UF without including other states", () => {
    const multiState = [...rows, { ...rows[0], cidade: "Salvador", uf: "BA", faturamento: 700 }];
    const result = queryPublishedBase("faturamento em SP", multiState, "v1");
    expect(result.result).toMatchObject({ faturamento: 2600 });
    expect(result.filters.uf).toBe("SP");
  });

  it("does not broaden when a requested representative is absent", () => {
    const result = queryPublishedBase("faturamento do representante Carlos", rows, "v1");
    expect(result.status).toBe("no_match");
    expect(result.filters.representante).toBe("Carlos");
    expect(result.result).toEqual([]);
  });

  it("keeps the requested representative filter when a period is also present", () => {
    const result = queryPublishedBase("faturamento do representante Ana em 2025", rows, "v1");
    expect(result.filters.representante).toBe("Ana");
    expect(result.result).toMatchObject({ faturamento: 1200 });
  });

  it("does not replace gross revenue with a similarly named net field", () => {
    const result = queryPublishedBase("faturamento", [{ faturamento_liquido_aprox: 100 }], "v1");
    expect(result.status).toBe("no_match");
  });

  it("keeps quantity as metric when clients are a grouping dimension", () => {
    const result = queryPublishedBase("quais clientes compraram mais produtos em 2025?", rows, "v1");
    expect(result.metric).toBe("quantidade_faturada");
    expect(result.result[0]).toMatchObject({ nome: "Loja B", quantidade: 3 });
  });

  it("rejects a grouping dimension that is not in the source schema", () => {
    const result = queryPublishedBase("faturamento por departamento", rows, "v1");
    expect(result.status).toBe("no_match");
    expect(result.result).toEqual([]);
  });

  it("asks for a full date when a question names only a day number", () => {
    const result = queryPublishedBase("quanto faturou no dia 10?", rows, "v1");
    expect(result.status).toBe("ambiguous");
    expect(result.result).toEqual([]);
  });

  it("ranks representative aliases by requested value metric", () => {
    const result = queryPublishedBase("ranking por vendedor em 2025", rows, "v1");
    expect(result.groupBy).toBe("representante");
    expect(result.result).toMatchObject([{ nome: "Ana", faturamento: 1200 }, { nome: "Bruno", faturamento: 900 }]);
  });

  it("returns the smallest groups when the question asks for the lowest", () => {
    const result = queryPublishedBase("quais representantes tiveram menor faturamento", rows, "v1");
    expect(result.result[0]).toMatchObject({ nome: "Bruno", faturamento: 900 });
  });

  it("groups full-base questions by year or month when requested", () => {
    const annual = queryPublishedBase("faturamento por ano", rows, "v1");
    expect(annual.groupBy).toBe("ano");
    expect(annual.result).toMatchObject([{ nome: "2024", faturamento: 500 }, { nome: "2025", faturamento: 2100 }]);
    const monthly = queryPublishedBase("faturamento por mês", rows, "v1");
    expect(monthly.groupBy).toBe("mes");
    expect(monthly.result).toMatchObject([{ nome: "2024-03", faturamento: 500 }, { nome: "2025-01", faturamento: 2100 }]);
  });

  it("uses mentioned base values as filters for follow-up questions", () => {
    const result = queryPublishedBase("quais produtos tiveram maior faturamento para Ana?", rows, "v1");
    expect(result.groupBy).toBe("produto");
    expect(result.filters.representante).toBe("Ana");
    expect(result.result).toMatchObject([{ nome: "Carreta Graneleira", faturamento: 1200 }, { nome: "Kit Reparo", faturamento: 500 }]);
  });

  it("uses billed quantity for most-sold products and filters carretas", () => {
    const result = queryPublishedBase("carretas mais vendidas", rows, "v1");
    expect(result.groupBy).toBe("produto");
    expect(result.metric).toBe("quantidade_faturada");
    expect(result.result[0]).toMatchObject({ nome: "Carreta Baú", quantidade: 3 });
    expect(result.result.some((item: any) => item.nome === "Kit Reparo")).toBe(false);
  });

  it("does not assume implemento means carreta", () => {
    expect(queryPublishedBase("faturamento de implementos", rows, "v1").status).toBe("ambiguous");
  });

  it("does not invent a profit field", () => {
    const result = queryPublishedBase("qual foi o lucro?", rows, "v1");
    expect(result.status).toBe("no_match");
    expect(result.limitations.join(" ")).toMatch(/lucro/i);
  });

  it("aggregates additional numeric measures such as freight", () => {
    const result = queryPublishedBase("qual foi o total de frete em 2025?", rows, "v1");
    expect(result.metric).toBe("frete");
    expect(result.result.metricas).toMatchObject({ frete: 180 });
  });

  it("recognizes numeric columns from the published base even when not preconfigured in the dictionary", () => {
    const result = queryPublishedBase("qual foi o total de icms em 2025?", rows, "v1");
    expect(result.metric).toBe("icms");
    expect(result.result.metricas.icms).toBe(130);
  });

  it("groups by a text column present only in the published base schema", () => {
    const result = queryPublishedBase("faturamento por segmento", rows, "v1");
    expect(result.groupBy).toBe("segmento");
    expect(result.result).toMatchObject([{ nome: "Agro", faturamento: 1700 }, { nome: "Construção", faturamento: 900 }]);
  });

  it("reports missing values without fabricating records", () => {
    const result = queryPublishedBase("faturamento por representante em 2023", rows, "v1");
    expect(result.status).toBe("no_match");
    expect(result.result).toEqual([]);
    expect(result.sourceVersion).toBe("v1");
  });
});
