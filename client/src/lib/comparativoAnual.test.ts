import { describe, expect, it } from "vitest";
import { gerarComparativoAnual } from "./comparativoAnual";

describe("gerarComparativoAnual", () => {
  it("cria doze meses e mantém uma coluna independente para cada ano", () => {
    const result = gerarComparativoAnual([
      { ano: 2024, mes_num: 1, faturamento: 100 },
      { ano: 2024, mes_num: 1, faturamento: 50 },
      { ano: 2025, mes_num: 1, faturamento: 300 },
      { ano: 2025, mes_num: 2, faturamento: 75 },
    ], [2025, 2024]);

    expect(result).toHaveLength(12);
    expect(result[0]).toMatchObject({ mes: "Jan", "2025": 300, "2024": 150 });
    expect(result[1]).toMatchObject({ mes: "Fev", "2025": 75, "2024": 0 });
    expect(Object.keys(result[0] || {})).toEqual(expect.arrayContaining(["mes", "2025", "2024"]));
  });

  it("permite comparar somente os anos selecionados", () => {
    const result = gerarComparativoAnual([
      { ano: 2023, mes_num: 8, faturamento: 10 },
      { ano: 2024, mes_num: 8, faturamento: 20 },
      { ano: 2025, mes_num: 8, faturamento: 30 },
    ], [2025, 2023]);

    expect(result[7]).toMatchObject({ mes: "Ago", "2025": 30, "2023": 10 });
    expect(result[7]).not.toHaveProperty("2024");
  });
});
