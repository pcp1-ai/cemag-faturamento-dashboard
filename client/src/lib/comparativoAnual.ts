export interface RegistroComparativoAnual {
  ano: number;
  mes_num: number;
  faturamento: number;
}

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

export function gerarComparativoAnual(registros: RegistroComparativoAnual[], anos: number[]) {
  return Array.from({ length: 12 }, (_, index) => index + 1).map((mes_num) => {
    const linha: Record<string, string | number> = {
      mes: MESES_COMPARATIVO[mes_num],
    };
    for (const ano of anos) {
      linha[String(ano)] = registros
        .filter((item) => item.ano === ano && item.mes_num === mes_num)
        .reduce((total, item) => total + item.faturamento, 0);
    }
    return linha;
  });
}
