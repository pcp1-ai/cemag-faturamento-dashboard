import React, { useMemo, useState } from "react";
import { UF_NOME, valorCompactoMapa, formatarMoeda, formatarInteiro } from "../lib/faturamento";

interface MapBrasilProps {
  dadosUf: Record<string, { faturamento: number; quantidade: number; pedidos: number; clientes: number }>;
}

// Coordenadas aproximadas em grade esquemática dos estados para mapa de calor e visualização executiva
const UF_POSICOES: Record<string, { x: number; y: number; w?: number; h?: number }> = {
  RR: { x: 260, y: 40 },
  AP: { x: 440, y: 70 },
  AM: { x: 180, y: 130 },
  PA: { x: 380, y: 160 },
  MA: { x: 520, y: 160 },
  PI: { x: 570, y: 220 },
  CE: { x: 640, y: 180 },
  RN: { x: 710, y: 180 },
  PB: { x: 710, y: 230 },
  PE: { x: 700, y: 280 },
  AL: { x: 710, y: 330 },
  SE: { x: 690, y: 380 },
  AC: { x: 70, y: 240 },
  RO: { x: 190, y: 280 },
  MT: { x: 310, y: 330 },
  TO: { x: 470, y: 280 },
  BA: { x: 580, y: 340 },
  GO: { x: 430, y: 400 },
  DF: { x: 480, y: 390 },
  MG: { x: 530, y: 470 },
  ES: { x: 640, y: 480 },
  MS: { x: 300, y: 470 },
  SP: { x: 430, y: 530 },
  RJ: { x: 590, y: 540 },
  PR: { x: 380, y: 610 },
  SC: { x: 410, y: 670 },
  RS: { x: 360, y: 740 },
};

export const MapBrasil: React.FC<MapBrasilProps> = ({ dadosUf }) => {
  const [hoverUf, setHoverUf] = useState<string | null>(null);

  const maiorFat = useMemo(() => {
    let m = 0;
    for (const info of Object.values(dadosUf)) {
      if (info.faturamento > m) m = info.faturamento;
    }
    return m;
  }, [dadosUf]);

  const obterCor = (fat: number) => {
    if (!fat || fat <= 0 || maiorFat <= 0) return "#1E293B"; // slate-800
    const ratio = Math.min(Math.max(Math.pow(fat / maiorFat, 0.4), 0), 1);
    // Escala de laranja CEMAG
    if (ratio < 0.3) return "#7C2D12"; // dark amber
    if (ratio < 0.6) return "#C2410C"; // orange-700
    if (ratio < 0.85) return "#EA580C"; // orange-600
    return "#F97316"; // orange-500 (CEMAG orange)
  };

  const ufsAtivas = useMemo(() => {
    return Object.entries(dadosUf)
      .filter(([_, v]) => v.faturamento > 0)
      .sort((a, b) => b[1].faturamento - a[1].faturamento);
  }, [dadosUf]);

  const infoHover = hoverUf ? dadosUf[hoverUf] : null;

  return (
    <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-5 shadow-lg relative">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🗺️</span> Distribuição por Unidade Federativa (UF)
          </h3>
          <p className="text-xs text-slate-400">
            Intensidade de cor baseada no faturamento acumulado por estado no período filtrado.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Menor</span>
          <div className="w-4 h-3 rounded" style={{ backgroundColor: "#1E293B" }}></div>
          <div className="w-4 h-3 rounded" style={{ backgroundColor: "#7C2D12" }}></div>
          <div className="w-4 h-3 rounded" style={{ backgroundColor: "#C2410C" }}></div>
          <div className="w-4 h-3 rounded" style={{ backgroundColor: "#EA580C" }}></div>
          <div className="w-4 h-3 rounded" style={{ backgroundColor: "#F97316" }}></div>
          <span className="text-slate-400">Líder</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Painel do Mapa Interativo */}
        <div className="lg:col-span-8 flex justify-center relative min-h-[440px]">
          <svg viewBox="0 0 820 820" className="w-full max-w-[580px] h-auto drop-shadow-md">
            {/* Linhas de conexão ou callouts para estados pequenos do Nordeste e Sudeste */}
            <line x1="710" y1="180" x2="770" y2="160" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="710" y1="230" x2="770" y2="210" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="700" y1="280" x2="770" y2="260" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="710" y1="330" x2="770" y2="310" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="690" y1="380" x2="770" y2="360" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="640" y1="480" x2="710" y2="470" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="590" y1="540" x2="680" y2="530" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="480" y1="390" x2="520" y2="360" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />

            {/* Nós dos Estados */}
            {Object.entries(UF_POSICOES).map(([uf, pos]) => {
              const info = dadosUf[uf] || { faturamento: 0, quantidade: 0, pedidos: 0, clientes: 0 };
              const cor = obterCor(info.faturamento);
              const isHovered = hoverUf === uf;
              const hasFat = info.faturamento > 0;
              const isTop = ufsAtivas.slice(0, 3).some(([topUf]) => topUf === uf);

              const radius = isTop ? 28 : 24;

              return (
                <g
                  key={uf}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoverUf(uf)}
                  onMouseLeave={() => setHoverUf(null)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={cor}
                    stroke={isHovered ? "#FFFFFF" : isTop ? "#FDE047" : "#334155"}
                    strokeWidth={isHovered ? 3 : isTop ? 2.5 : 1.5}
                    className="transition-all duration-150"
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#FFFFFF"
                    fontSize={isTop ? 14 : 12}
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {uf}
                  </text>
                  {hasFat && (
                    <text
                      x={pos.x}
                      y={pos.y + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#CBD5E1"
                      fontSize={9}
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {valorCompactoMapa(info.faturamento).replace("R$ ", "")}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip flutuante ao passar mouse */}
          {infoHover && hoverUf && (
            <div className="absolute top-2 right-2 bg-slate-900/95 border border-slate-700 backdrop-blur-md rounded-lg p-3 text-xs shadow-xl min-w-[190px] z-10 pointer-events-none">
              <div className="font-bold text-sm text-amber-400 mb-1 flex items-center justify-between">
                <span>{UF_NOME[hoverUf] || hoverUf} ({hoverUf})</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                  {dadosUf[hoverUf]?.faturamento > 0 ? "Com vendas" : "Sem vendas"}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Faturamento:</span>
                  <span className="font-semibold text-white">{formatarMoeda(infoHover.faturamento)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantidade:</span>
                  <span className="font-semibold text-white">{formatarInteiro(infoHover.quantidade)} un.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pedidos/notas:</span>
                  <span className="font-semibold text-white">{formatarInteiro(infoHover.pedidos)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Clientes ativos:</span>
                  <span className="font-semibold text-white">{formatarInteiro(infoHover.clientes)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumo lateral Top UFs */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>🏆 Top Estados Líderes</span>
              <span className="text-xs text-orange-400 font-normal">
                {ufsAtivas.length} de 27 estados
              </span>
            </h4>
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {ufsAtivas.slice(0, 8).map(([uf, info], idx) => {
                const pct = maiorFat > 0 ? (info.faturamento / maiorFat) * 100 : 0;
                return (
                  <div
                    key={uf}
                    onMouseEnter={() => setHoverUf(uf)}
                    onMouseLeave={() => setHoverUf(null)}
                    className="p-2 rounded bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">#{idx + 1}</span>
                        {uf} - {UF_NOME[uf] || uf}
                      </span>
                      <span className="font-semibold text-orange-400">{formatarMoeda(info.faturamento)}</span>
                    </div>
                    <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{formatarInteiro(info.pedidos)} pedidos</span>
                      <span>{formatarInteiro(info.quantidade)} unidades</span>
                    </div>
                  </div>
                );
              })}
              {ufsAtivas.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">Nenhum estado com vendas no filtro atual.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
