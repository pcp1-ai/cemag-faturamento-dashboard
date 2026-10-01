export interface RegistroComparativoAnual {
  ano: number;
  mes_num: number;
  faturamento: number;
  quantidade?: number;
  pedido?: string;
  cliente?: string;
}

export type MetricaComparativoAnual =
  | "faturamento"
  | "quantidade"
  | "pedidos"
  | "clientes"
  | "ticket_unitario"
  | "valor_medio_pedido";

export const MESES_COMPARATIVO = [
  "",
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function calcularMetricaComparativo(registros: RegistroComparativoAnual[], metrica: MetricaComparativoAnual) {
  const faturamento = registros.reduce((total, item) => total + item.faturamento, 0);
  const quantidade = registros.reduce((total, item) => total + (item.quantidade || 0), 0);
  const pedidos = new Set(registros.map((item) => item.pedido).filter(Boolean)).size;
  const clientes = new Set(registros.map((item) => item.cliente).filter(Boolean)).size;
  if (metrica === "faturamento") return faturamento;
  if (metrica === "quantidade") return quantidade;
  if (metrica === "pedidos") return pedidos;
  if (metrica === "clientes") return clientes;
  if (metrica === "ticket_unitario") return quantidade ? faturamento / quantidade : 0;
  return pedidos ? faturamento / pedidos : 0;
}

export function gerarComparativoAnual(
  registros: RegistroComparativoAnual[],
  anos: number[],
  metrica: MetricaComparativoAnual = "faturamento",
) {
  return Array.from({ length: 12 }, (_, index) => index + 1).map((mes_num) => {
    const linha: Record<string, string | number> = {
      mes: MESES_COMPARATIVO[mes_num],
    };
    for (const ano of anos) {
      linha[String(ano)] = calcularMetricaComparativo(
        registros.filter((item) => item.ano === ano && item.mes_num === mes_num),
        metrica,
      );
    }
    return linha;
  });
}
