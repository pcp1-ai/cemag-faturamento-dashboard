import { describe, expect, it } from "vitest";
import { gerarPrevisaoMensal, validarPrevisaoMensal } from "./faturamento";

const dados = Array.from({ length: 6 }, (_, index) => {
  const mes = String(index + 1).padStart(2, "0");
  return [
    { ano_mes: `2025-${mes}`, faturamento: 1000, quantidade: 2, pedido: `P${index}A`, cliente: `C${index}A` },
    { ano_mes: `2025-${mes}`, faturamento: 500, quantidade: 3, pedido: `P${index}A`, cliente: `C${index}B` },
  ];
}).flat() as any[];

describe("previsão mensal por métrica", () => {
  it("agrega faturamento e quantidade por mês", () => {
    const faturamento = gerarPrevisaoMensal(dados, 1, "Faturamento");
    const quantidade = gerarPrevisaoMensal(dados, 1, "Quantidade");
    expect(faturamento.serie[0].realizado).toBe(1500);
    expect(quantidade.serie[0].realizado).toBe(5);
  });

  it("agrega pedidos e clientes únicos por mês", () => {
    const pedidos = gerarPrevisaoMensal(dados, 1, "Pedidos");
    const clientes = gerarPrevisaoMensal(dados, 1, "Clientes");
    expect(pedidos.serie[0].realizado).toBe(1);
    expect(clientes.serie[0].realizado).toBe(2);
  });

  it("calcula ticket unitário e valor médio por pedido", () => {
    const ticket = gerarPrevisaoMensal(dados, 1, "Ticket unitário");
    const medio = gerarPrevisaoMensal(dados, 1, "Valor médio por pedido");
    expect(ticket.serie[0].realizado).toBe(300);
    expect(medio.serie[0].realizado).toBe(1500);
  });

  it("valida os últimos meses fora do treino", () => {
    const mesesExtras = Array.from({ length: 3 }, (_, index) => {
      const mes = String(index + 7).padStart(2, "0");
      return { ano_mes: `2025-${mes}`, faturamento: 1500, quantidade: 5, pedido: `P${index + 6}A`, cliente: `C${index + 6}A` };
    });
    const validacao = validarPrevisaoMensal([...dados, ...mesesExtras] as any[], "Faturamento");
    expect(validacao.pontos).toBe(3);
    expect(validacao.mape).toBe(0);
    expect(validacao.mae).toBe(0);
    expect(validacao.wape).toBe(0);
  });
});
