import React, { useEffect, useMemo, useState } from "react";
import { formatarMoeda, formatarInteiro, valorCompactoMapa, semAcento } from "../lib/faturamento";

interface MunicipioResumo { cidade: string; uf: string; faturamento: number; quantidade: number; pedidos: number; clientes: number; }
interface MapMunicipiosProps { dadosMunicipios: MunicipioResumo[]; selectedUf?: string | null; onClearSelection?: () => void; }
type Feature = { type: "Feature"; properties?: { id?: string; name?: string; description?: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: any } };

const CODIGO_UF: Record<string, string> = { "11":"RO", "12":"AC", "13":"AM", "14":"RR", "15":"PA", "16":"AP", "17":"TO", "21":"MA", "22":"PI", "23":"CE", "24":"RN", "25":"PB", "26":"PE", "27":"AL", "28":"SE", "29":"BA", "31":"MG", "32":"ES", "33":"RJ", "35":"SP", "41":"PR", "42":"SC", "43":"RS", "50":"MS", "51":"MT", "52":"GO", "53":"DF" };
const norm = (v: string) => semAcento(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const WIDTH = 920; const HEIGHT = 760;
const collectPoints = (value: any, out: number[][] = []) => { if (Array.isArray(value) && typeof value[0] === "number") out.push(value as number[]); else if (Array.isArray(value)) value.forEach((child) => collectPoints(child, out)); return out; };
const geometryPath = (geometry: Feature["geometry"], project: (lon: number, lat: number) => number[]) => { const ringPath = (ring: number[][]) => ring.map(([lon, lat], i) => { const [x, y] = project(lon, lat); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + " Z"; return geometry.type === "Polygon" ? geometry.coordinates.map(ringPath).join(" ") : geometry.coordinates.map((polygon: number[][][]) => polygon.map(ringPath).join(" ")).join(" "); };

export const MapMunicipios: React.FC<MapMunicipiosProps> = ({ dadosMunicipios, selectedUf, onClearSelection }) => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [hover, setHover] = useState<MunicipioResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/municipios_brasil.geojson")
      .then((r) => { if (!r.ok) throw new Error("GeoJSON municipal indisponível"); return r.json(); })
      .then((json) => setFeatures(json.features || []))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const porChave = useMemo(() => {
    const map = new Map<string, MunicipioResumo>();
    for (const item of dadosMunicipios) map.set(`${norm(item.cidade)}::${item.uf}`, item);
    return map;
  }, [dadosMunicipios]);
  const dadosVisiveis = useMemo(() => selectedUf ? dadosMunicipios.filter((d) => d.uf === selectedUf) : [], [dadosMunicipios, selectedUf]);
  const maior = Math.max(...dadosVisiveis.map((d) => d.faturamento), 1);
  const ativos = useMemo(() => dadosVisiveis.filter((d) => d.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento), [dadosVisiveis]);
  const ufsAtivas = useMemo(() => new Set(selectedUf ? [selectedUf] : []), [selectedUf]);
  const featuresVisiveis = useMemo(() => features.filter((feature) => ufsAtivas.has(CODIGO_UF[String(feature.properties?.id || "").slice(0, 2)] || "")), [features, ufsAtivas]);
  const projetar = useMemo(() => {
    const points = featuresVisiveis.flatMap((feature) => collectPoints(feature.geometry.coordinates));
    if (!points.length) return (lon: number, lat: number) => [((lon + 74.2) / 40.8) * WIDTH, ((6.2 - lat) / 40.2) * HEIGHT];
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const point of points) { minLon = Math.min(minLon, point[0]); maxLon = Math.max(maxLon, point[0]); minLat = Math.min(minLat, point[1]); maxLat = Math.max(maxLat, point[1]); }
    const padLon = Math.max((maxLon - minLon) * 0.08, 0.4), padLat = Math.max((maxLat - minLat) * 0.08, 0.4);
    const lo = minLon - padLon, hi = maxLon + padLon, bottom = minLat - padLat, top = maxLat + padLat;
    return (lon: number, lat: number) => [((lon - lo) / (hi - lo)) * WIDTH, ((top - lat) / (top - bottom)) * HEIGHT];
  }, [featuresVisiveis]);
  const cor = (faturamento: number) => { if (!faturamento) return "#17263a"; const ratio = Math.min(1, Math.pow(faturamento / maior, 0.42)); return `hsl(${Math.round(28 - ratio * 10)} ${Math.round(45 + ratio * 45)}% ${Math.round(18 + ratio * 35)}%)`; };

  return <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-5 shadow-lg">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><span>📍</span> Municípios{selectedUf ? ` de ${selectedUf}` : ""}</h3><p className="text-xs text-slate-400">{selectedUf ? "Detalhamento territorial do estado selecionado. Passe o mouse sobre um município para consultar os indicadores." : "Selecione um estado acima para abrir o mapa detalhado dos municípios."}</p></div>{selectedUf && <button type="button" onClick={onClearSelection} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">← Voltar aos estados</button>}</div>
    {!selectedUf ? <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-400">Clique em um estado no mapa acima para visualizar seus municípios.</div> : carregando ? <div className="h-96 flex items-center justify-center text-sm text-slate-400">Carregando limites municipais...</div> : erro ? <div className="h-96 flex items-center justify-center text-sm text-red-300">{erro}</div> : <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <div className="xl:col-span-8 relative rounded-lg border border-slate-800 bg-[#102036] overflow-hidden"><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-h-[600px]"><rect width={WIDTH} height={HEIGHT} fill="#102036" />{featuresVisiveis.map((feature, i) => { const id = String(feature.properties?.id || ""); const uf = CODIGO_UF[id.slice(0, 2)] || ""; const item = porChave.get(`${norm(feature.properties?.name || feature.properties?.description || "")}::${uf}`); const ativo = !!item; const isHover = !!item && hover?.cidade === item.cidade && hover?.uf === item.uf; return <path key={`${id}-${i}`} d={geometryPath(feature.geometry, projetar)} fill={cor(item?.faturamento || 0)} fillOpacity={ativo ? 0.9 : 0.5} stroke={isHover ? "#ffffff" : "#64748b"} strokeWidth={isHover ? 1.8 : 0.22} vectorEffect="non-scaling-stroke" onMouseEnter={() => item && setHover(item)} onMouseLeave={() => setHover(null)} className="cursor-pointer transition-opacity hover:opacity-100" />; })}</svg>{hover && <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs shadow-xl min-w-[215px] pointer-events-none"><div className="font-bold text-orange-300 mb-2">{hover.cidade} - {hover.uf}</div><div className="space-y-1 text-slate-300"><div className="flex justify-between"><span>Faturamento</span><b className="text-white">{formatarMoeda(hover.faturamento)}</b></div><div className="flex justify-between"><span>Quantidade</span><b>{formatarInteiro(hover.quantidade)}</b></div><div className="flex justify-between"><span>Pedidos</span><b>{formatarInteiro(hover.pedidos)}</b></div><div className="flex justify-between"><span>Clientes</span><b>{formatarInteiro(hover.clientes)}</b></div></div></div>}<div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded bg-slate-950/80 border border-slate-700 px-2 py-1 text-[10px] text-slate-300"><span>Sem vendas</span>{[0.15,0.35,0.6,0.85,1].map((r) => <span key={r} className="w-5 h-3 rounded" style={{ background: cor(maior * r) }} />)}<span>Líder</span></div></div>
      <div className="xl:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-lg p-4"><h4 className="text-sm font-semibold text-slate-200 mb-3">🏆 Top municípios</h4><div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">{ativos.slice(0, 15).map((item, idx) => <div key={`${item.cidade}-${item.uf}`} onMouseEnter={() => setHover(item)} onMouseLeave={() => setHover(null)} className="p-2 rounded bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 cursor-pointer"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-white truncate"><span className="text-slate-500 mr-1">#{idx + 1}</span>{item.cidade} - {item.uf}</span><span className="font-bold text-orange-400 whitespace-nowrap">{valorCompactoMapa(item.faturamento)}</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.max(3, (item.faturamento / maior) * 100)}%` }} /></div><div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>{formatarInteiro(item.pedidos)} pedidos</span><span>{item.uf}</span></div></div>)}{ativos.length === 0 && <div className="text-center py-6 text-xs text-slate-400">Nenhum município com vendas.</div>}</div></div>
    </div>}
  </div>;
};
