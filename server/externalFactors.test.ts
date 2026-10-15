import { describe, expect, it } from "vitest";
import { agregarChuvaMensal, agregarSelicMensal, periodoSazonal } from "./externalFactors";

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
});
