import React from "react";
import { formatarMoeda, formatarInteiro } from "../lib/faturamento";
import { DollarSign, Package, ShoppingCart, Users, Tag, TrendingUp } from "lucide-react";

interface MetricCardsProps {
  faturamento: number;
  faturamentoBruto: number;
  faturamentoNegativos: number;
  faturamentoLiquido: number;
  quantidade: number;
  pedidos: number;
  clientes: number;
  ticketUnitario: number;
  valorMedioPedido: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  faturamento,
  faturamentoBruto,
  faturamentoNegativos,
  faturamentoLiquido,
  quantidade,
  pedidos,
  clientes,
  ticketUnitario,
  valorMedioPedido,
}) => {
  const cards = [
    {
      titulo: "Bruto",
      valor: formatarMoeda(faturamentoBruto),
      sub: "Soma dos lançamentos positivos",
      icone: DollarSign,
      corBorda: "#F97316", // Orange CEMAG
    },
    {
      titulo: "Negativos",
      valor: formatarMoeda(faturamentoNegativos),
      sub: "Devoluções e ajustes",
      icone: TrendingUp,
      corBorda: "#EF4444",
    },
    {
      titulo: "Líquido",
      valor: formatarMoeda(faturamentoLiquido),
      sub: "Bruto + negativos",
      icone: DollarSign,
      corBorda: "#22C55E",
    },
    {
      titulo: "Quantidade",
      valor: formatarInteiro(quantidade),
      sub: "Unidades comercializadas",
      icone: Package,
      corBorda: "#FB923C",
    },
    {
      titulo: "Pedidos/notas",
      valor: formatarInteiro(pedidos),
      sub: "Documentos únicos",
      icone: ShoppingCart,
      corBorda: "#7DD3FC", // Blue CEMAG
    },
    {
      titulo: "Clientes",
      valor: formatarInteiro(clientes),
      sub: "Compradores no período",
      icone: Users,
      corBorda: "#38BDF8",
    },
    {
      titulo: "Ticket unitário",
      valor: formatarMoeda(ticketUnitario),
      sub: "Preço médio por produto",
      icone: Tag,
      corBorda: "#22C55E", // Green
    },
    {
      titulo: "Valor médio/pedido",
      valor: formatarMoeda(valorMedioPedido),
      sub: "Média por pedido fechado",
      icone: TrendingUp,
      corBorda: "#A855F7",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 my-3">
      {cards.map((c, idx) => {
        const Icone = c.icone;
        return (
          <div
            key={idx}
            className="bg-gradient-to-br from-[#111827] to-[#0B1220] border border-[#263244] rounded-xl p-3.5 shadow-md flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:border-slate-600"
            style={{ borderLeft: `4px solid ${c.corBorda}` }}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                {c.titulo}
              </span>
              <Icone className="w-4 h-4 text-slate-400 opacity-80" />
            </div>
            <div className="text-lg md:text-xl font-extrabold text-white tracking-tight py-0.5 truncate">
              {c.valor}
            </div>
            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {c.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
};
