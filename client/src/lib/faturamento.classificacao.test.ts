import { describe, expect, it } from "vitest";
import { classificarTipoProduto, grupoModelo } from "./faturamento";

describe("classificação de carretas conforme padrão CEMAG", () => {
  const carretas = [
    "CBHM4500 SS RD MM M17 VM",
    "CBHM6000 CA SS RD MM P750IMP M21 AN",
    "CBH5 UG SS RD P750(I) M21",
    "CBH6R FO SS T M21",
    "CBHM6000-2E SS RS/RS P750(I) M17",
    "FTC4300R SS RS/RS BB P750(I) M25",
    "FTC6500R CS RS/RS P750(I) M25",
    "F6 CS RS/RS A90 P750(I) M23",
    "FA2 SS T M23",
    "FA2A SS T M23",
  ];

  it.each(carretas)("classifica %s como Carreta", (produto) => {
    expect(classificarTipoProduto(produto, "", "", "")).toBe("Carreta");
  });

  it("prioriza a família de carreta mesmo quando há termos genéricos de peça", () => {
    expect(classificarTipoProduto("FTC4300R", "", "EIXO E ACESSÓRIO", "")).toBe("Carreta");
  });

  it("mantém sucata e itens comprados como categorias prioritárias", () => {
    expect(classificarTipoProduto("00000-PEÇA", "", "", "")).toBe("Sucata");
    expect(classificarTipoProduto("200123", "", "", "")).toBe("Itens comprados");
  });

  it("identifica os grupos de modelo das famílias novas", () => {
    expect(grupoModelo("FTC6500R SS RS/RS P750(I) M25")).toBe("FTC");
    expect(grupoModelo("F6 CS RS/RS A90 P750(I) M23")).toBe("F6");
    expect(grupoModelo("FA2 SS T M23")).toBe("FA");
  });
});
