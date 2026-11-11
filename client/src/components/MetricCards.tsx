import React from "react";
import { formatarMoeda, formatarInteiro } from "../lib/faturamento";
import { DollarSign, Package, ShoppingCart, Users, Tag, TrendingUp } from "lucide-react";

interface MetricCardsProps {
  faturamento: number;
  quantidade: number;
  pedidos: number;
  clientes: number;
  ticketUnitario: number;
  valorMedioPedido: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  faturamento,
  quantidade,
  pedidos,
  clientes,
  ticketUnitario,
  valorMedioPedido,
}) => {
  const cards = [
    {
      titulo: "Faturamento",
      valor: formatarMoeda(faturamento),
      sub: "Total bruto faturado",
      icone: DollarSign,
      corBorda: "#FF4E09", // Orange CEMAG
    },
    {
      titulo: "Quantidade",
      valor: formatarInteiro(quantidade),
      sub: "Unidades comercializadas",
      icone: Package,
      corBorda: "#FF4E09",
    },
    {
      titulo: "Pedidos/notas",
      valor: formatarInteiro(pedidos),
      sub: "Documentos únicos",
      icone: ShoppingCart,
      corBorda: "#FF4E09",
    },
    {
      titulo: "Clientes",
      valor: formatarInteiro(clientes),
      sub: "Compradores no período",
      icone: Users,
      corBorda: "#FF4E09",
    },
    {
      titulo: "Ticket unitário",
      valor: formatarMoeda(ticketUnitario),
      sub: "Preço médio por produto",
      icone: Tag,
      corBorda: "#FF4E09",
    },
    {
      titulo: "Valor médio/pedido",
      valor: formatarMoeda(valorMedioPedido),
      sub: "Média por pedido fechado",
      icone: TrendingUp,
      corBorda: "#FF4E09",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-6 my-3">
      {cards.map((c, idx) => {
        const Icone = c.icone;
        return (
          <div
            key={idx}
            className={`bg-gradient-to-br from-[#111827] to-[#0B1220] border border-[#263244] rounded-xl p-3 sm:p-3.5 shadow-md flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:border-orange-500/50 hover:-translate-y-0.5 ${idx === 0 ? "max-[639px]:col-span-2" : ""}`}
            style={{ borderLeft: `4px solid ${c.corBorda}` }}
          >
            <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-300 tracking-wide uppercase">
                {c.titulo}
              </span>
              <Icone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 opacity-80 shrink-0" />
            </div>
            <div className="text-[clamp(1rem,4.3vw,1.35rem)] md:text-xl font-extrabold text-white tracking-tight py-0.5 whitespace-nowrap">
              {c.valor}
            </div>
            <div className="hidden sm:block text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {c.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
};
