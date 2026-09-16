import React, { useMemo, useState } from "react";
import { UF_NOME, formatarMoeda, formatarInteiro, valorCompactoMapa } from "../lib/faturamento";

interface MunicipioResumo {
  cidade: string;
  uf: string;
  faturamento: number;
  quantidade: number;
  pedidos: number;
  clientes: number;
}

interface MapMunicipiosProps {
  dadosMunicipios: MunicipioResumo[];
}

const UF_POSICOES: Record<string, { x: number; y: number }> = {
  AC:{x:90,y:270}, RO:{x:190,y:300}, AM:{x:190,y:150}, RR:{x:270,y:65}, PA:{x:390,y:170}, AP:{x:480,y:95}, TO:{x:475,y:300}, MA:{x:555,y:170}, PI:{x:590,y:240}, CE:{x:660,y:185}, RN:{x:735,y:185}, PB:{x:725,y:235}, PE:{x:710,y:285}, AL:{x:725,y:335}, SE:{x:700,y:385}, BA:{x:590,y:350}, MT:{x:315,y:350}, MS:{x:315,y:485}, GO:{x:440,y:410}, DF:{x:485,y:395}, MG:{x:535,y:485}, ES:{x:650,y:490}, SP:{x:440,y:550}, RJ:{x:590,y:555}, PR:{x:385,y:625}, SC:{x:415,y:680}, RS:{x:370,y:750}, UY:{x:300,y:790},
};

function hash(text: string) {
  return Array.from(text).reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 7);
}

export const MapMunicipios: React.FC<MapMunicipiosProps> = ({ dadosMunicipios }) => {
  const [hover, setHover] = useState<MunicipioResumo | null>(null);
  const maior = Math.max(...dadosMunicipios.map((d) => d.faturamento), 1);
  const municipios = useMemo(() => dadosMunicipios.filter((d) => d.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento), [dadosMunicipios]);
  const pontos = municipios.map((item) => {
    const base = UF_POSICOES[item.uf] || { x: 420, y: 420 };
    const h = hash(`${item.cidade}-${item.uf}`);
    const offsetX = ((h % 7) - 3) * 16;
    const offsetY = ((Math.floor(h / 7) % 7) - 3) * 14;
    const radius = 8 + Math.max(0, Math.sqrt(item.faturamento / maior) * 26);
    return { item, x: Math.max(25, Math.min(795, base.x + offsetX)), y: Math.max(25, Math.min(795, base.y + offsetY)), radius };
  });

  return (
    <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><span>📍</span> Mapa municipal de faturamento</h3>
          <p className="text-xs text-slate-400">Dimensão das bolhas proporcional ao faturamento do município no período filtrado. Passe o mouse para detalhar.</p>
        </div>
        <div className="text-xs text-slate-400">{municipios.length} município(s) com vendas</div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 relative rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
          <svg viewBox="0 0 820 820" className="w-full max-h-[560px]">
            <rect x="0" y="0" width="820" height="820" fill="#0f1b2d" />
            <path d="M120 120 L265 60 L500 100 L735 155 L770 330 L680 470 L620 610 L450 785 L275 720 L170 550 L70 390 Z" fill="#17263a" stroke="#334155" strokeWidth="3" opacity=".8" />
            {Object.entries(UF_POSICOES).map(([uf, pos]) => <text key={uf} x={pos.x} y={pos.y - 30} fill="#64748b" fontSize="10" textAnchor="middle">{uf}</text>)}
            {pontos.map(({ item, x, y, radius }) => {
              const ativo = hover?.cidade === item.cidade && hover?.uf === item.uf;
              return <g key={`${item.cidade}-${item.uf}`} onMouseEnter={() => setHover(item)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r={radius + (ativo ? 4 : 0)} fill={ativo ? "#FDBA74" : "#F97316"} fillOpacity={0.78} stroke={ativo ? "#fff" : "#fed7aa"} strokeWidth={ativo ? 3 : 1.2} />
                <text x={x} y={y + radius + 12} textAnchor="middle" fill="#e2e8f0" fontSize={Math.max(8, Math.min(12, radius / 2.5))}>{item.cidade.length > 17 ? `${item.cidade.slice(0, 16)}…` : item.cidade}</text>
              </g>;
            })}
          </svg>
          {hover && <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs shadow-xl min-w-[205px] pointer-events-none">
            <div className="font-bold text-orange-300 mb-2">{hover.cidade} - {hover.uf}</div>
            <div className="space-y-1 text-slate-300"><div className="flex justify-between"><span>Faturamento</span><b className="text-white">{formatarMoeda(hover.faturamento)}</b></div><div className="flex justify-between"><span>Quantidade</span><b>{formatarInteiro(hover.quantidade)}</b></div><div className="flex justify-between"><span>Pedidos</span><b>{formatarInteiro(hover.pedidos)}</b></div><div className="flex justify-between"><span>Clientes</span><b>{formatarInteiro(hover.clientes)}</b></div></div>
          </div>}
        </div>
        <div className="xl:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">🏆 Top municípios</h4>
          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">{municipios.slice(0, 12).map((item, idx) => <div key={`${item.cidade}-${item.uf}`} onMouseEnter={() => setHover(item)} onMouseLeave={() => setHover(null)} className="p-2 rounded bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 cursor-pointer"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-white truncate"><span className="text-slate-500 mr-1">#{idx + 1}</span>{item.cidade} - {item.uf}</span><span className="font-bold text-orange-400 whitespace-nowrap">{valorCompactoMapa(item.faturamento)}</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.max(3, (item.faturamento / maior) * 100)}%` }} /></div><div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>{formatarInteiro(item.pedidos)} pedidos</span><span>{UF_NOME[item.uf] || item.uf}</span></div></div>)}{municipios.length === 0 && <div className="text-center py-6 text-xs text-slate-400">Nenhum município com vendas.</div>}</div>
        </div>
      </div>
    </div>
  );
};
