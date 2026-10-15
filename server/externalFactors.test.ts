import { describe, expect, it } from "vitest";
import { agregarChuvaMensal, agregarFatoresNacionais, agregarSelicMensal, periodoSazonal } from "./externalFactors";

describe("fatores externos", () => {
  it("calcula a média mensal da Selic a partir da série diária do BCB", () => {
    const result = agregarSelicMensal([
      { data: "02/01/2025", valor: "12.15" },
      { data: "15/01/2025", valor: "12.25" },
      { data: "03/02/2025", valor: "13" },
    ]);
    expect(result.get("2025-01")).toBeCloseTo(12.2);
    expect(result.get("2025-02")).toBe(13);
  });

  it("soma a precipitação diária em milímetros por mês", () => {
    const result = agregarChuvaMensal({ "20250101": 2.5, "20250102": 7.5, "20250201": 1, "20250202": -999 });
    expect(result.get("2025-01")).toBe(10);
    expect(result.get("2025-02")).toBe(1);
  });

  it("calcula o período dos trimestres sazonais a partir da rodada", () => {
    expect(periodoSazonal(2026, 9, 1)).toBe("2026-10 a 2026-12");
    expect(periodoSazonal(2026, 9, 2)).toBe("2027-01 a 2027-03");
  });

  it("agrega a visão Brasil pela média das referências regionais", () => {
    const base = (chuva_mm: number, selic_media_pct: number) => ({
      localidade: "Referência",
      latitude: 0,
      longitude: 0,
      meses: [{ ano_mes: "2026-01", chuva_mm, selic_media_pct }],
      previsao_chuva: [{ data: "2026-10-16", chuva_mm, probabilidade_chuva_pct: 50 }],
      expectativas_selic: [],
      previsao_sazonal: [],
      fontes: [],
      avisos: [],
      atualizado_em: "2026-01-01T00:00:00.000Z",
    });
    const result = agregarFatoresNacionais([base(10, 10), base(20, 12)]);
    expect(result.localidade).toContain("Brasil");
    expect(result.meses[0]).toMatchObject({ chuva_mm: 15, selic_media_pct: 11 });
    expect(result.previsao_chuva[0].chuva_mm).toBe(15);
    expect(result.avisos[0]).toContain("média simples");
  });
});
