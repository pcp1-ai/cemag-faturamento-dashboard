import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  TransacaoTratada,
  prepararDados,
  formatarMoeda,
  formatarInteiro,
  formatarPercentual,
  valorResumido,
  valorCompactoMapa,
  agregar,
  curvaAbc,
  classificarCarteiraClientes,
  dreAproximada,
  compararPeriodos,
  gerarAlertasComerciais,
  concentracaoTop,
  mixClientes,
  oportunidadesCrossSell,
  paresCompradosJuntos,
  precoMedioPorItem,
  desviosPreco,
  resumoDiarioInteligencia,
  painelRepresentantesInteligencia,
  fechamentoMensalInteligencia,
  tabelaExportacaoPronta,
  gerarExportacaoPersonalizada,
  exportarTabelaExcel,
  exportarTabelaCsv,
  exportarAuditoriaExcel,
  CLIENTE_INFO_OVERRIDE,
  UF_NOME,
  MESES,
  gerarPrevisaoMensal,
  validarPrevisaoMensal,
} from "../lib/faturamento";
import { MetricCards } from "../components/MetricCards";
import { SidebarFilters, FiltrosState } from "../components/SidebarFilters";
import { MapBrasil } from "../components/MapBrasil";
import { MapMunicipios } from "../components/MapMunicipios";
import { trpc } from "../lib/trpc";
import { calcularMetricaComparativo, calcularVariacaoComparativo, gerarComparativoAnual, MetricaComparativoAnual } from "../lib/comparativoAnual";
import {
  Menu,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  CheckCircle,
  Eye,
  Tv,
  LogOut,
  Printer,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

const CEMAG_ORANGE = "#F97316";
const CEMAG_ORANGE_SOFT = "#FB923C";
const CEMAG_BLUE = "#7DD3FC";
const CEMAG_GREEN = "#22C55E";
const CEMAG_RED = "#EF4444";
const CEMAG_MUTED = "#64748B";

const CAPITAIS_ESTADOS: Record<string, string> = { AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador", CE: "Fortaleza", DF: "Brasília", ES: "Vitória", GO: "Goiânia", MA: "São Luís", MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa", PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho", RR: "Boa Vista", SC: "Florianópolis", SP: "São Paulo", SE: "Aracaju", TO: "Palmas" };
const REGIOES_BRASIL = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const ROTULOS_METRICA_YOY: Record<MetricaComparativoAnual, string> = {
  faturamento: "Faturamento",
  quantidade: "Quantidade",
  pedidos: "Pedidos",
  clientes: "Clientes",
  ticket_unitario: "Ticket unitário",
  valor_medio_pedido: "Valor médio por pedido",
};

function formatarMetricaYoY(valor: number, metrica: MetricaComparativoAnual) {
  return metrica === "faturamento" || metrica === "ticket_unitario" || metrica === "valor_medio_pedido"
    ? formatarMoeda(valor)
    : formatarInteiro(valor);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

const metricKey = (label: string): string => ({
  "Faturamento": "faturamento",
  "Quantidade": "quantidade",
  "Pedidos": "pedidos",
  "Clientes": "clientes",
  "Ticket unitário": "ticket_unitario_calc",
  "Valor médio por pedido": "valor_medio_pedido",
}[label] || "faturamento");

const metricFormat = (value: number, label: string) =>
  ["Faturamento", "Ticket unitário", "Valor médio por pedido"].includes(label) ? formatarMoeda(value) : formatarInteiro(value);

const METRICAS_PAINEL = ["Faturamento", "Quantidade", "Pedidos", "Clientes", "Ticket unitário", "Valor médio por pedido"] as const;
const CAMPO_METRICA: Record<string, string> = { Faturamento: "faturamento", Quantidade: "quantidade", Pedidos: "pedidos", Clientes: "clientes", "Ticket unitário": "ticket_unitario_calc", "Valor médio por pedido": "valor_medio_pedido" };
const campoMetrica = (metrica: string) => CAMPO_METRICA[metrica] || "faturamento";
const valorMetrica = (row: any, metrica: string) => {
  const campo = campoMetrica(metrica);
  const fallback = campo === "ticket_unitario_calc" ? "ticketUnitario" : campo === "valor_medio_pedido" ? "valorMedioPedido" : campo;
  return Number(row?.[campo] ?? row?.[fallback] ?? 0);
};
const formatarMetrica = (valor: number, metrica: string) => ["Faturamento", "Ticket unitário", "Valor médio por pedido"].includes(metrica) ? formatarMoeda(valor) : formatarInteiro(valor);
const resumirMetrica = (valor: number, metrica: string) => ["Faturamento", "Ticket unitário", "Valor médio por pedido"].includes(metrica) ? valorResumido(valor, true) : formatarInteiro(valor);
const intervaloEixoMensal = (total: number) => Math.max(0, Math.ceil(total / 12) - 1);
const ROTULOS_SERIE_PREVISAO: Record<string, string> = {
  realizado: "Realizado",
  previsao_retroativa: "Provável retroativo",
  conservador_retroativo: "Conservador retroativo",
  otimista_retroativo: "Otimista retroativo",
  previsao: "Provável / fechamento",
  conservador: "Conservador",
  otimista: "Otimista",
};
const rotuloSeriePrevisao = (nome: unknown) => ROTULOS_SERIE_PREVISAO[String(nome)] || String(nome || "Série");

const SeletorMetrica: React.FC<{ value: string; onChange: (value: string) => void; label?: string }> = ({ value, onChange, label = "Métrica" }) => (
  <label className="flex items-center gap-2 text-xs text-slate-400">
    <span>{label}:</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1">
      {METRICAS_PAINEL.map((metrica) => <option key={metrica} value={metrica}>{metrica}</option>)}
    </select>
  </label>
);

const BASE_DB = "cemag_faturamento_db";
const BASE_STORE = "bases";

function abrirBaseDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BASE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(BASE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarBasePersistente(rows: any[], nome: string) {
  const payload = JSON.stringify(rows);
  try {
    // Bases pequenas continuam simples e compatíveis com a implementação anterior.
    if (payload.length < 1_500_000) {
      localStorage.setItem("cemag_base_padrao", payload);
      localStorage.setItem("cemag_base_padrao_nome", nome);
      return "localStorage";
    }
    throw new Error("base grande");
  } catch {
    const db = await abrirBaseDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BASE_STORE, "readwrite");
      tx.objectStore(BASE_STORE).put({ rows, nome }, "base_padrao");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Remove cópia antiga que poderia continuar ocupando quota.
    try { localStorage.removeItem("cemag_base_padrao"); localStorage.removeItem("cemag_base_padrao_nome"); } catch { /* sem ação */ }
    return "indexedDB";
  }
}

async function carregarBasePersistente(): Promise<{ rows: any[]; nome: string } | null> {
  try {
    const db = await abrirBaseDb();
    return await new Promise((resolve) => {
      const request = db.transaction(BASE_STORE, "readonly").objectStore(BASE_STORE).get("base_padrao");
      request.onsuccess = () => resolve(request.result?.rows?.length ? request.result : null);
      request.onerror = () => resolve(null);
    });
  } catch { return null; }
}

const ABAS = [
  { id: "visao_geral", label: "🏠 Visão geral" },
  { id: "metas", label: "🎯 Metas mensais" },
  { id: "previsoes", label: "📈 Previsões" },
  { id: "previsoes_agro", label: "🌾 Previsões Agro" },
  { id: "diagnostico", label: "🔎 Diagnóstico da base" },
  { id: "modo_apresentacao", label: "📺 Modo apresentação" },
  { id: "ano_ano", label: "📅 Ano x ano" },
  { id: "mes_mes", label: "🗓️ Mês x mês" },
  { id: "produtos", label: "🚜 Produtos e carretas" },
  { id: "clientes", label: "👥 Clientes" },
  { id: "inteligencia", label: "🧠 Inteligência comercial" },
  { id: "regioes", label: "🗺️ Regiões" },
  { id: "representantes", label: "🤝 Representantes" },
  { id: "tipos", label: "🏷️ Tipos e categorias" },
  { id: "base_tratada", label: "📄 Base tratada" },
  { id: "exportacoes", label: "📤 Exportações" },
];

const DataTable: React.FC<{ rows: any[]; columns: string[]; exportName?: string; percentColumns?: string[]; metricColumns?: Record<string, string> }> = ({ rows, columns, exportName = "tabela_dashboard", percentColumns = [], metricColumns = {} }) => (
  <div className="border border-slate-800 rounded-lg">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 border-b border-slate-800">
      <span className="text-[10px] text-slate-500">{rows.length.toLocaleString("pt-BR")} linha(s) disponíveis</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => exportarTabelaCsv(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))), `${exportName}.csv`)} className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700">
          <Download className="w-3 h-3" /> CSV completo
        </button>
        <button type="button" onClick={() => exportarTabelaExcel(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))), `${exportName}.xlsx`, exportName.slice(0, 31))} className="inline-flex items-center gap-1 rounded bg-orange-600 px-2 py-1 text-[10px] text-white hover:bg-orange-500">
          <FileSpreadsheet className="w-3 h-3" /> Excel completo
        </button>
      </div>
    </div>
    <div className="max-h-80 overflow-auto">
    <table className="w-full text-left text-xs text-slate-300">
      <thead className="bg-slate-950 sticky top-0 text-[10px] uppercase text-slate-400">
        <tr>{columns.map((c) => <th key={c} className="p-2 whitespace-nowrap">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60">
        {rows.slice(0, 300).map((r, i) => (
          <tr key={i} className="hover:bg-slate-800/40">
            {columns.map((c) => {
              const value = r[c];
              const normalized = String(c).toLowerCase();
              const isNumber = typeof value === "number";
              const isPercent = normalized.includes("pct") || normalized.includes("participacao") || percentColumns.includes(c);
              const isMoney = normalized.includes("faturamento") || normalized.includes("preco") || normalized.includes("resultado") || normalized.includes("receita") || normalized.includes("valor");
              const display = isNumber ? (metricColumns[c] ? formatarMetrica(value, metricColumns[c]) : isPercent ? formatarPercentual(value) : isMoney ? formatarMoeda(value) : formatarInteiro(value)) : String(value ?? "-");
              return <td key={c} className="p-2 max-w-[220px] truncate">{display}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length > 300 && <div className="p-2 text-[10px] text-slate-500 text-center">Prévia com 300 de {rows.length} linhas. Os botões acima exportam tudo.</div>}
    </div>
  </div>
);

const MetaCheckboxFilter: React.FC<{ label: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }> = ({ label, values, selected, onChange }) => {
  const [busca, setBusca] = useState("");
  const filtrados = values.filter((value) => value.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()));
  const alternar = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-400">
    <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{label} <span className="text-[10px] text-slate-500">({selected.length ? `${selected.length} selecionado(s)` : "todos"})</span></span><span className="flex gap-1"><button type="button" onClick={() => onChange([...values])} className="text-[10px] text-sky-400 hover:text-sky-300 whitespace-nowrap">Selecionar tudo</button><button type="button" onClick={() => onChange([])} className="text-[10px] text-orange-400 hover:text-orange-300 whitespace-nowrap">Limpar seleção</button></span></div>
    {values.length > 5 && <div className="relative mt-1"><Search className="absolute left-2 top-2 h-3 w-3 text-slate-500" /><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}...`} className="w-full rounded bg-slate-900 border border-slate-700 py-1 pl-7 pr-2 text-[11px] text-slate-200" /></div>}
    <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded border border-slate-800 bg-slate-900 p-1">{filtrados.map((value) => <label key={value} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-[11px] text-slate-300 hover:bg-slate-800"><input type="checkbox" checked={selected.includes(value)} onChange={() => alternar(value)} className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500" /><span className="truncate">{value}</span></label>)}{!filtrados.length && <span className="block p-1 text-[10px] text-slate-500">Nenhuma opção encontrada</span>}</div>
  </div>;
};

export default function Home({ onLogout, emailAutenticado, isAdmin = false }: { onLogout?: () => void; emailAutenticado?: string; isAdmin?: boolean }) {
  const arquivosCentrais = trpc.cemag.currentFiles.useQuery(undefined, { retry: false });
  const uploadCentralMutation = trpc.cemag.uploadFile.useMutation();
  const [loading, setLoading] = useState<boolean>(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [mensagemUpload, setMensagemUpload] = useState<{ tipo: "sucesso" | "aviso" | "erro"; texto: string } | null>(null);
  const [baseOriginal, setBaseOriginal] = useState<any[]>([]);
  const [nomeArquivoBase, setNomeArquivoBase] = useState<string>("data/tabelaFaturamento.csv");
  const [abaAtiva, setAbaAtiva] = useState<string>("visao_geral");
  const [ufMapaSelecionada, setUfMapaSelecionada] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [sidebarOculta, setSidebarOculta] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cemag_sidebar_oculta") === "true";
  });
  const [visualizacaoExpandida, setVisualizacaoExpandida] = useState<boolean>(false);

  useEffect(() => {
    window.localStorage.setItem("cemag_sidebar_oculta", String(sidebarOculta));
  }, [sidebarOculta]);

  // Filtros Globais
  const [filtros, setFiltros] = useState<FiltrosState>({
    dataInicio: "2022-01-01",
    dataFim: "",
    considerarTodasFormas: false,
    tiposVendaSelecionados: ["V ProdPrópria p Consumo"],
    familiasExcluidas: [],
    anos: [],
    regioes: [],
    ufs: [],
    cidades: [],
    representantes: [],
    listasPreco: [],
    clientes: [],
    clientesBase: [],
    categorias: [],
    descricoesGenericas: [],
    gruposModelo: [],
    familias: [],
    tiposProduto: ["Carreta"],
    buscaProduto: "",
  });

  // Carregar a base central administrada; cópias locais e a base embarcada são fallbacks.
  useEffect(() => {
    async function carregarBaseInicial() {
      try {
        setLoading(true);
        if (arquivosCentrais.isLoading) return;
        const arquivoCentral = arquivosCentrais.data?.base;
        if (arquivoCentral?.url) {
          const respCentral = await fetch(arquivoCentral.url);
          if (!respCentral.ok) throw new Error("Não foi possível baixar a base central atual.");
          if (/\.xlsx?$/i.test(arquivoCentral.fileName)) {
            const workbook = XLSX.read(new Uint8Array(await respCentral.arrayBuffer()), { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            if (!rows.length) throw new Error("A base central está vazia.");
            setBaseOriginal(rows);
          } else {
            const parsedCentral = Papa.parse(await respCentral.text(), { header: true, skipEmptyLines: true });
            if (!parsedCentral.data?.length) throw new Error("A base central está vazia.");
            setBaseOriginal(parsedCentral.data);
          }
          setNomeArquivoBase(arquivoCentral.fileName);
          return;
        }

        // Fallback para a cópia salva no navegador ou para a base embarcada.
        const baseSalva = localStorage.getItem("cemag_base_padrao");
        const nomeSalvo = localStorage.getItem("cemag_base_padrao_nome");
        if (baseSalva) {
          const rows = JSON.parse(baseSalva);
          if (Array.isArray(rows) && rows.length) {
            setBaseOriginal(rows);
            setNomeArquivoBase(nomeSalvo || "base_padrao_local.csv");
            return;
          }
        }
        const baseIndexed = await carregarBasePersistente();
        if (baseIndexed?.rows?.length) {
          setBaseOriginal(baseIndexed.rows);
          setNomeArquivoBase(baseIndexed.nome || "base_padrao_local.csv");
          return;
        }
        const resp = await fetch("/data/tabelaFaturamento.csv");
        if (!resp.ok) throw new Error("Não foi possível carregar a base padrão /data/tabelaFaturamento.csv");
        const text = await resp.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (parsed.data && parsed.data.length > 0) {
          setBaseOriginal(parsed.data);
          setNomeArquivoBase("tabelaFaturamento.csv");
        } else throw new Error("Arquivo vazio");
      } catch (err: any) {
        setErroCarregamento(err.message || "Erro ao carregar dados iniciais.");
      } finally {
        setLoading(false);
      }
    }
    carregarBaseInicial();
  }, [arquivosCentrais.data, arquivosCentrais.isLoading]);

  // Preparar os dados tratados com as regras CEMAG
  const { dados, meta } = useMemo(() => {
    if (!baseOriginal.length) return { dados: [], meta: { linhas_validas: 0 } };
    return prepararDados(baseOriginal, CLIENTE_INFO_OVERRIDE);
  }, [baseOriginal]);

  // Inicializar datas de período quando a base for carregada
  useEffect(() => {
    if (meta?.data_min && meta?.data_max && !filtros.dataFim) {
      const minBase = meta.data_min.toISOString().slice(0, 10);
      const maxStr = meta.data_max.toISOString().slice(0, 10);
      const inicioPadrao = minBase > "2022-01-01" ? minBase : "2022-01-01";
      setFiltros((prev) => ({
        ...prev,
        dataInicio: prev.dataInicio || inicioPadrao,
        dataFim: maxStr,
      }));
    }
  }, [meta, filtros.dataFim]);

  // Opções para a barra lateral
  const opcoesFiltros = useMemo(() => {
    if (!dados.length) {
      return {
        tiposVenda: [],
        familias: [],
        tiposProduto: [],
        anos: [],
        regioes: [],
        ufs: [],
        cidades: [],
        representantes: [],
        listasPreco: [],
        clientes: [],
        clientesBase: [],
        categorias: [],
        descricoes: [],
        gruposModelo: [],
      };
    }
    const setOf = (key: keyof TransacaoTratada) =>
      Array.from(new Set(dados.map((d) => d[key]))).filter(Boolean).sort();

    return {
      tiposVenda: setOf("tipo_venda") as string[],
      familias: setOf("familia") as string[],
      anos: (setOf("ano") as number[]).sort((a, b) => b - a),
      regioes: setOf("regiao") as string[],
      ufs: setOf("uf") as string[],
      cidades: setOf("cidade") as string[],
      representantes: setOf("representante") as string[],
      listasPreco: setOf("lista_preco_uf") as string[],
      clientes: setOf("cliente") as string[],
      clientesBase: setOf("cliente_base") as string[],
      categorias: setOf("categoria_produto") as string[],
      descricoes: setOf("descricao_generica") as string[],
      gruposModelo: setOf("grupo_modelo") as string[],
      tiposProduto: setOf("tipo_produto") as string[],
    };
  }, [dados]);

  // Aplicação estrita de todos os filtros
  const dadosFiltrados = useMemo(() => {
    if (!dados.length) return [];

    return dados.filter((d) => {
      // Período
      if (filtros.dataInicio) {
        const dIni = new Date(filtros.dataInicio + "T00:00:00");
        if (d.data_emissao < dIni) return false;
      }
      if (filtros.dataFim) {
        const dFim = new Date(filtros.dataFim + "T23:59:59");
        if (d.data_emissao > dFim) return false;
      }

      // Forma de Venda
      if (!filtros.considerarTodasFormas) {
        if (filtros.tiposVendaSelecionados.length > 0) {
          if (!filtros.tiposVendaSelecionados.includes(d.tipo_venda)) return false;
        } else {
          return false;
        }
      }

      // Exclusões de famílias
      if (filtros.familiasExcluidas.length > 0 && filtros.familiasExcluidas.includes(d.familia)) {
        return false;
      }

      // Multiselects
      if (filtros.anos.length > 0 && !filtros.anos.includes(d.ano)) return false;
      if (filtros.regioes.length > 0 && !filtros.regioes.includes(d.regiao)) return false;
      if (filtros.ufs.length > 0 && !filtros.ufs.includes(d.uf)) return false;
      if (filtros.cidades.length > 0 && !filtros.cidades.includes(d.cidade)) return false;
      if (filtros.representantes.length > 0 && !filtros.representantes.includes(d.representante)) return false;
      if (filtros.listasPreco.length > 0 && !filtros.listasPreco.includes(d.lista_preco_uf)) return false;
      if (filtros.clientes.length > 0 && !filtros.clientes.includes(d.cliente)) return false;
      if (filtros.clientesBase.length > 0 && !filtros.clientesBase.includes(d.cliente_base)) return false;
      if (filtros.categorias.length > 0 && !filtros.categorias.includes(d.categoria_produto)) return false;
      if (filtros.descricoesGenericas.length > 0 && !filtros.descricoesGenericas.includes(d.descricao_generica)) return false;
      if (filtros.gruposModelo.length > 0 && !filtros.gruposModelo.includes(d.grupo_modelo)) return false;
      if (filtros.familias.length > 0 && !filtros.familias.includes(d.familia)) return false;
      if (filtros.tiposProduto.length > 0 && !filtros.tiposProduto.includes(d.tipo_produto)) return false;

      // Busca textual
      if (filtros.buscaProduto.trim()) {
        const termo = filtros.buscaProduto.trim().toLowerCase();
        if (!d.produto.toLowerCase().includes(termo)) return false;
      }

      return true;
    });
  }, [dados, filtros]);

  // A previsão mantém os filtros comerciais ativos, mas usa o período configurado nesta aba.
  const dadosFiltradosSemPeriodo = useMemo(() => {
    if (!dados.length) return [];
    return dados.filter((d) => {
      if (!filtros.considerarTodasFormas && (filtros.tiposVendaSelecionados.length === 0 || !filtros.tiposVendaSelecionados.includes(d.tipo_venda))) return false;
      if (filtros.familiasExcluidas.includes(d.familia)) return false;
      if (filtros.anos.length > 0 && !filtros.anos.includes(d.ano)) return false;
      if (filtros.regioes.length > 0 && !filtros.regioes.includes(d.regiao)) return false;
      if (filtros.ufs.length > 0 && !filtros.ufs.includes(d.uf)) return false;
      if (filtros.cidades.length > 0 && !filtros.cidades.includes(d.cidade)) return false;
      if (filtros.representantes.length > 0 && !filtros.representantes.includes(d.representante)) return false;
      if (filtros.listasPreco.length > 0 && !filtros.listasPreco.includes(d.lista_preco_uf)) return false;
      if (filtros.clientes.length > 0 && !filtros.clientes.includes(d.cliente)) return false;
      if (filtros.clientesBase.length > 0 && !filtros.clientesBase.includes(d.cliente_base)) return false;
      if (filtros.categorias.length > 0 && !filtros.categorias.includes(d.categoria_produto)) return false;
      if (filtros.descricoesGenericas.length > 0 && !filtros.descricoesGenericas.includes(d.descricao_generica)) return false;
      if (filtros.gruposModelo.length > 0 && !filtros.gruposModelo.includes(d.grupo_modelo)) return false;
      if (filtros.familias.length > 0 && !filtros.familias.includes(d.familia)) return false;
      if (filtros.tiposProduto.length > 0 && !filtros.tiposProduto.includes(d.tipo_produto)) return false;
      if (filtros.buscaProduto.trim() && !d.produto.toLowerCase().includes(filtros.buscaProduto.trim().toLowerCase())) return false;
      return true;
    });
  }, [dados, filtros]);

  // KPIs agregados do topo
  const kpis = useMemo(() => {
    let faturamento = 0;
    let quantidade = 0;
    const pedidos = new Set<string>();
    const clientes = new Set<string>();

    for (const d of dadosFiltrados) {
      faturamento += d.faturamento;
      quantidade += d.quantidade;
      if (d.pedido) pedidos.add(d.pedido);
      if (d.cliente) clientes.add(d.cliente);
    }

    const totalPedidos = pedidos.size;
    const totalClientes = clientes.size;
    const ticketUnitario = quantidade > 0 ? faturamento / quantidade : 0;
    const valorMedioPedido = totalPedidos > 0 ? faturamento / totalPedidos : 0;

    return {
      faturamento,
      quantidade,
      pedidos: totalPedidos,
      clientes: totalClientes,
      ticketUnitario,
      valorMedioPedido,
    };
  }, [dadosFiltrados]);

  // Handler de upload de novo arquivo
  const handleUploadArquivo = (file: File) => {
    const nome = file.name.toLowerCase();
    const reader = new FileReader();
    setMensagemUpload({ tipo: "aviso", texto: `Lendo ${file.name}...` });

    const publicarBaseCentral = async (contentBase64: string) => {
      if (!isAdmin) return;
      try {
        await uploadCentralMutation.mutateAsync({
          kind: "base",
          fileName: file.name,
          contentType: file.type || (nome.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv"),
          contentBase64,
        });
        await arquivosCentrais.refetch();
        setMensagemUpload({ tipo: "sucesso", texto: `${file.name} publicado como base central. Todos os usuários verão esta versão ao acessar.` });
      } catch (error: any) {
        setMensagemUpload({ tipo: "erro", texto: `Arquivo carregado nesta sessão, mas não foi publicado no servidor: ${error?.message || "erro de conexão"}` });
      }
    };

    const concluirUpload = (linhas: any[], contentBase64: string) => {
      setBaseOriginal(linhas);
      setNomeArquivoBase(file.name);
      setMensagemUpload({ tipo: "sucesso", texto: `${file.name} carregado com sucesso: ${linhas.length.toLocaleString("pt-BR")} registros encontrados.` });
      void publicarBaseCentral(contentBase64);
      void salvarBasePersistente(linhas, file.name)
        .catch(() => undefined);
    };

    if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const json = XLSX.utils.sheet_to_json(sheet);
          if (json && json.length) {
            concluirUpload(json, arrayBufferToBase64(e.target?.result as ArrayBuffer));
          } else setMensagemUpload({ tipo: "erro", texto: "O arquivo Excel não contém registros válidos." });
        } catch (err: any) {
          setMensagemUpload({ tipo: "erro", texto: "Erro ao ler arquivo Excel: " + err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (parsed.data && parsed.data.length) {
            concluirUpload(parsed.data, textToBase64(text));
          } else setMensagemUpload({ tipo: "erro", texto: "O arquivo CSV não contém registros válidos." });
        } catch (err: any) {
          setMensagemUpload({ tipo: "erro", texto: "Erro ao processar CSV: " + err.message });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetFiltros = () => {
    if (meta?.data_min && meta?.data_max) {
      const minBase = meta.data_min.toISOString().slice(0, 10);
      setFiltros({
        dataInicio: minBase > "2022-01-01" ? minBase : "2022-01-01",
        dataFim: meta.data_max.toISOString().slice(0, 10),
        considerarTodasFormas: false,
        tiposVendaSelecionados: ["V ProdPrópria p Consumo"],
        familiasExcluidas: [],
        anos: [],
        regioes: [],
        ufs: [],
        cidades: [],
        representantes: [],
        listasPreco: [],
        clientes: [],
        clientesBase: [],
        categorias: [],
        descricoesGenericas: [],
        gruposModelo: [],
        familias: [],
        tiposProduto: [],
        buscaProduto: "",
      });
    }
  };

  // --------------------------------------------------------------------------
  // ESTADOS ESPECÍFICOS DE ABAS
  // --------------------------------------------------------------------------

  // Visão Geral: métrica escolhida
  const [metricaVisao, setMetricaVisao] = useState<string>("Faturamento");

  // Modo Apresentação: tema, métrica, topN
  const [temaApresentacao, setTemaApresentacao] = useState<"Escuro" | "Claro">("Escuro");
  const [metricaApresentacao, setMetricaApresentacao] = useState<string>("Faturamento");
  const [topNApresentacao, setTopNApresentacao] = useState<number>(8);
  const [apresentacaoBlocoExtra, setApresentacaoBlocoExtra] = useState<boolean>(false);

  // Ano x Ano
  const anosDisponiveisYoY = useMemo(() => {
    return Array.from(new Set(dadosFiltrados.map((d) => d.ano))).sort((a, b) => b - a);
  }, [dadosFiltrados]);
  const [anoBaseYoY, setAnoBaseYoY] = useState<number>(2024);
  const [anoCompYoY, setAnoCompYoY] = useState<number>(2025);
  const [yoyMesesEquiv, setYoyMesesEquiv] = useState<boolean>(true);
  const [anosSelecionadosYoY, setAnosSelecionadosYoY] = useState<number[]>([]);
  const [metricaYoY, setMetricaYoY] = useState<MetricaComparativoAnual>("faturamento");

  useEffect(() => {
    setAnosSelecionadosYoY((atuais) => {
      if (atuais.length === 0) return anosDisponiveisYoY;
      return atuais.filter((ano) => anosDisponiveisYoY.includes(ano));
    });
  }, [anosDisponiveisYoY]);

  // Mês x Mês
  const [metricaMoM, setMetricaMoM] = useState<string>("Faturamento");
  const [mesesComparativoSelecionados, setMesesComparativoSelecionados] = useState<string[]>([]);
  const [temaDashboard, setTemaDashboard] = useState<"claro" | "black">(() => (localStorage.getItem("cemag_tema_dashboard") as "claro" | "black") || "black");
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState<"executivo" | "mensal" | "auditoria" | "produtos" | "clientes" | "territorial" | "metas" | "previsoes">("executivo");
  const [relatorioDataInicio, setRelatorioDataInicio] = useState(() => filtros.dataInicio || "2022-01-01");
  const [relatorioDataFim, setRelatorioDataFim] = useState(() => filtros.dataFim || new Date().toISOString().slice(0, 10));

  useEffect(() => {
    localStorage.setItem("cemag_tema_dashboard", temaDashboard);
  }, [temaDashboard]);

  const imprimirRelatorio = () => window.print();

  // Produtos
  const [metricaProd, setMetricaProd] = useState<string>("Faturamento");
  const [agrupamentoProd, setAgrupamentoProd] = useState<string>("produto");
  const [topNProd, setTopNProd] = useState<number>(20);

  // Clientes
  const [metricaCli, setMetricaCli] = useState<string>("Faturamento");
  const [agrupCliente, setAgrupCliente] = useState<"cliente" | "cliente_base">("cliente");

  // Inteligência Comercial: sub-área
  const [subInteligencia, setSubInteligencia] = useState<string>("comparador");
  const [intelCompDim, setIntelCompDim] = useState<string>("cliente");
  const [intelCompMet, setIntelCompMet] = useState<string>("faturamento");
  const [intelDreDim, setIntelDreDim] = useState<string>("familia");
  const [intelCrossCliente, setIntelCrossCliente] = useState<string>("");

  // Regiões
  const [metricaGeo, setMetricaGeo] = useState<string>("Faturamento");

  // Representantes
  const [metricaRep, setMetricaRep] = useState<string>("Faturamento");
  const [metricaPrevisao, setMetricaPrevisao] = useState<string>("Faturamento");
  const [horizontePrevisao, setHorizontePrevisao] = useState<number>(6);
  const [previsaoDataInicio, setPrevisaoDataInicio] = useState<string>("2022-01-01");
  const [previsaoDataFim, setPrevisaoDataFim] = useState<string>("");
  const [incluirMesVigentePrevisao, setIncluirMesVigentePrevisao] = useState(true);
  const [seriesPrevisaoVisiveis, setSeriesPrevisaoVisiveis] = useState<Record<string, boolean>>({
    realizado: true,
    previsao_retroativa: true,
    conservador_retroativo: false,
    otimista_retroativo: false,
    previsao: true,
    conservador: true,
    otimista: true,
  });
  const [abrangenciaFatores, setAbrangenciaFatores] = useState<string>("cidade");
  const [regiaoFatores, setRegiaoFatores] = useState<string>(REGIOES_BRASIL[0]);
  const [ufsFatores, setUfsFatores] = useState<string[]>([]);
  const [cidadesSelecionadasFatores, setCidadesSelecionadasFatores] = useState<string[]>([]);
  const [cidadeFatoresExternos, setCidadeFatoresExternos] = useState<string>("");
  const [repEscolhido, setRepEscolhido] = useState<string>("");

  useEffect(() => {
    if (!meta?.data_min || !meta?.data_max) return;
    const minBase = meta.data_min.toISOString().slice(0, 10);
    const maxBase = meta.data_max.toISOString().slice(0, 10);
    if (previsaoDataInicio === "2022-01-01" && minBase > previsaoDataInicio) setPrevisaoDataInicio(minBase);
    if (!previsaoDataFim) setPrevisaoDataFim(maxBase);
  }, [meta, previsaoDataFim, previsaoDataInicio]);

  // Base tratada: colunas visíveis
  const [colunasBaseTratada, setColunasBaseTratada] = useState<string[]>([
    "pedido", "data_str", "cliente", "cidade", "uf", "representante",
    "produto", "familia", "quantidade", "faturamento", "tipo_venda"
  ]);

  // Exportações
  const [exportGranularidade, setExportGranularidade] = useState<string>("Mensal");
  const [exportMetrica, setExportMetrica] = useState<string>("Faturamento");
  const [exportDimensao, setExportDimensao] = useState<string>("Nenhum");
  const [exportModo, setExportModo] = useState<string>("prontas");
  const [exportTipo, setExportTipo] = useState<string>("Resumo mensal");

  // Metas mensais: CSV histórico + meta manual do mês vigente
  type MetaMensal = { ano: number; mes: number; meta: number; origem?: string };
  const hoje = new Date();
  const [metasImportadas, setMetasImportadas] = useState<MetaMensal[]>([]);
  const [metaManualAno, setMetaManualAno] = useState<number>(hoje.getFullYear());
  const [metaManualMes, setMetaManualMes] = useState<number>(hoje.getMonth() + 1);
  const [metaManualValor, setMetaManualValor] = useState<string>("");
  const [metaManualSalva, setMetaManualSalva] = useState<MetaMensal | null>(null);
  const [metaStatus, setMetaStatus] = useState<string>("");
  // Filtros exclusivos da análise de metas. Vazios significam toda a base.
  const [metaDataInicio, setMetaDataInicio] = useState<string>("");
  const [metaDataFim, setMetaDataFim] = useState<string>("");
  const [metaTiposProduto, setMetaTiposProduto] = useState<string[]>([]);
  const [metaTiposVenda, setMetaTiposVenda] = useState<string[]>([]);
  const [metaRegioes, setMetaRegioes] = useState<string[]>([]);
  const [metaUfs, setMetaUfs] = useState<string[]>([]);
  const [metaRepresentantes, setMetaRepresentantes] = useState<string[]>([]);
  const [metaClientes, setMetaClientes] = useState<string[]>([]);

  useEffect(() => {
    if (arquivosCentrais.isLoading) return;
    const carregarMetas = async () => {
      try {
        const arquivoCentral = arquivosCentrais.data?.metas;
        if (arquivoCentral?.url) {
          const resp = await fetch(arquivoCentral.url);
          if (!resp.ok) throw new Error("Não foi possível baixar as metas centrais.");
          const payload = await resp.json();
          const metas = Array.isArray(payload?.metas) ? payload.metas : Array.isArray(payload) ? payload : [];
          setMetasImportadas(metas.filter((item: any) => item?.origem !== "Manual — mês vigente"));
          const manual = metas.find((item: any) => item?.origem === "Manual — mês vigente");
          if (manual) {
            setMetaManualAno(manual.ano); setMetaManualMes(manual.mes); setMetaManualValor(String(manual.meta)); setMetaManualSalva(manual);
          }
          setMetaStatus(`Metas centrais atualizadas: ${metas.length} registro(s).`);
          return;
        }
        const saved = localStorage.getItem("cemag_metas_mensais");
        if (saved) setMetasImportadas(JSON.parse(saved));
        const manual = localStorage.getItem("cemag_meta_manual_vigente");
        if (manual) {
          const parsed = JSON.parse(manual);
          setMetaManualAno(parsed.ano); setMetaManualMes(parsed.mes); setMetaManualValor(String(parsed.meta)); setMetaManualSalva(parsed);
        }
      } catch { /* fallback para armazenamento local legado */ }
    };
    void carregarMetas();
  }, [arquivosCentrais.data, arquivosCentrais.isLoading]);

  const normalizarMeta = (row: any): MetaMensal | null => {
    const keys = Object.keys(row || {});
    const get = (names: string[]) => { const key = keys.find((k) => names.includes(String(k).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim())); return key ? row[key] : undefined; };
    const ano = Number(get(["ano", "year"]));
    const mesRaw = get(["mes", "month"]);
    const nomes: Record<string, number> = { janeiro:1, jan:1, fevereiro:2, fev:2, marco:3, mar:3, abril:4, abr:4, maio:5, mai:5, junho:6, jun:6, julho:7, jul:7, agosto:8, ago:8, setembro:9, set:9, outubro:10, out:10, novembro:11, nov:11, dezembro:12, dez:12 };
    const mes = typeof mesRaw === "string" && isNaN(Number(mesRaw)) ? nomes[mesRaw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()] : Number(mesRaw);
    const rawMeta = get(["meta", "meta_faturamento", "meta faturamento", "objetivo", "target"]);
    if (!ano || !mes || mes < 1 || mes > 12 || rawMeta === undefined) return null;
    const texto = String(rawMeta).replace(/R\$/g, "").replace(/\s/g, "");
    const meta = typeof rawMeta === "number" ? rawMeta : (texto.includes(",") ? Number(texto.replace(/\./g, "").replace(",", ".")) : Number(texto));
    return Number.isFinite(meta) && meta >= 0 ? { ano, mes, meta, origem: "CSV" } : null;
  };

  const publicarMetasCentrais = async (metas: MetaMensal[]) => {
    if (!isAdmin) return;
    try {
      await uploadCentralMutation.mutateAsync({
        kind: "metas",
        fileName: "metas_mensais.json",
        contentType: "application/json",
        contentBase64: textToBase64(JSON.stringify({ metas, updatedAt: new Date().toISOString() })),
      });
      await arquivosCentrais.refetch();
      setMetaStatus("Metas publicadas no servidor central. Todos os usuários verão esta versão.");
    } catch (error: any) {
      setMetaStatus(`Metas salvas neste navegador, mas não foram publicadas no servidor: ${error?.message || "erro de conexão"}`);
    }
  };

  const handleUploadMetas = (file: File) => {
    if (!isAdmin) { setMetaStatus("Somente a conta administradora pode atualizar as metas centrais."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || "");
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: "" });
        const rows = (parsed.data as any[]).map(normalizarMeta).filter(Boolean) as MetaMensal[];
        const unicas = Array.from(new Map(rows.map((r) => [`${r.ano}-${r.mes}`, r])).values());
        setMetasImportadas(unicas); localStorage.setItem("cemag_metas_mensais", JSON.stringify(unicas));
        setMetaStatus(`${unicas.length} meta(s) importada(s) com sucesso.`);
        void publicarMetasCentrais([...unicas, ...(metaManualSalva ? [metaManualSalva] : [])]);
      } catch (err: any) { setMetaStatus(`Erro ao ler metas: ${err.message || "arquivo inválido"}`); }
    };
    reader.readAsText(file);
  };

  const salvarMetaManual = () => {
    if (!isAdmin) { setMetaStatus("Somente a conta administradora pode atualizar a meta central."); return; }
    const valor = Number(String(metaManualValor).replace(/\./g, "").replace(",", "."));
    if (!valor || valor < 0 || !metaManualAno || !metaManualMes) { setMetaStatus("Informe ano, mês e uma meta válida."); return; }
    const meta: MetaMensal = { ano: metaManualAno, mes: metaManualMes, meta: valor, origem: "Manual — mês vigente" };
    setMetaManualSalva(meta); localStorage.setItem("cemag_meta_manual_vigente", JSON.stringify(meta)); setMetaStatus("Meta manual do mês vigente salva.");
    void publicarMetasCentrais([...metasImportadas, meta]);
  };

  const limparMetas = () => {
    if (!isAdmin) { setMetaStatus("Somente a conta administradora pode limpar as metas centrais."); return; }
    setMetasImportadas([]); setMetaManualSalva(null); setMetaManualValor(""); localStorage.removeItem("cemag_metas_mensais"); localStorage.removeItem("cemag_meta_manual_vigente"); setMetaStatus("Metas removidas localmente; publicando a remoção no servidor...");
    void publicarMetasCentrais([]);
  };

  // --------------------------------------------------------------------------
  // CÁLCULOS DERIVADOS POR ABA
  // --------------------------------------------------------------------------

  // Dados agregados por mês para gráficos de linha
  const dadosMensais = useMemo(() => {
    const agg = agregar(dadosFiltrados, ["ano_mes", "ano_mes_data", "ano", "mes_num", "mes"]);
    agg.sort((a, b) => a.ano_mes_data.localeCompare(b.ano_mes_data));
    return agg;
  }, [dadosFiltrados]);

  const mesesDisponiveisMoM = useMemo(() => dadosMensais.map((item: any) => ({ value: item.ano_mes, label: `${item.mes}/${item.ano}`, data: item.ano_mes_data })), [dadosMensais]);
  useEffect(() => {
    if (mesesDisponiveisMoM.length < 2) return;
    setMesesComparativoSelecionados((atuais) => {
      const validos = atuais.filter((mes) => mesesDisponiveisMoM.some((item) => item.value === mes));
      return validos.length >= 2 ? validos : mesesDisponiveisMoM.slice(-Math.min(4, mesesDisponiveisMoM.length)).map((mes) => mes.value);
    });
  }, [mesesDisponiveisMoM]);
  const mesesComparativoOrdenados = useMemo(() => mesesDisponiveisMoM.filter((mes) => mesesComparativoSelecionados.includes(mes.value)), [mesesDisponiveisMoM, mesesComparativoSelecionados]);
  const mesComparativoA = mesesComparativoOrdenados[0]?.value || "";
  const mesComparativoB = mesesComparativoOrdenados[mesesComparativoOrdenados.length - 1]?.value || "";
  const dadosMesComparativoA = useMemo(() => dadosFiltrados.filter((item) => item.ano_mes === mesComparativoA), [dadosFiltrados, mesComparativoA]);
  const dadosMesComparativoB = useMemo(() => dadosFiltrados.filter((item) => item.ano_mes === mesComparativoB), [dadosFiltrados, mesComparativoB]);
  const serieComparativoMoM = useMemo(() => mesesComparativoOrdenados.map((mes) => {
    const registros = dadosFiltrados.filter((item) => item.ano_mes === mes.value);
    const agregado = agregar(registros, [])[0] as any;
    return { periodo: mes.label, ano_mes: mes.value, valor: valorMetrica(agregado, metricaMoM), linhas: registros.length };
  }), [dadosFiltrados, mesesComparativoOrdenados, metricaMoM]);
  const linhaComparativoMoM = useMemo(() => {
    const valorA = valorMetrica(agregar(dadosMesComparativoA, [])[0] as any, metricaMoM);
    const valorB = valorMetrica(agregar(dadosMesComparativoB, [])[0] as any, metricaMoM);
    const variacao = calcularVariacaoComparativo(valorA, valorB);
    return { valorA, valorB, delta: variacao.delta, variacao: variacao.percentual };
  }, [dadosMesComparativoA, dadosMesComparativoB, metricaMoM]);
  const detalhesComparativoMoM = useMemo(() => {
    const dimensoes = [
      ["Produtos", "produto"],
      ["Clientes", "cliente"],
      ["Regiões", "regiao"],
      ["Representantes", "representante"],
      ["Tipos de venda", "tipo_venda"],
      ["Tipos de produto", "tipo_produto"],
    ] as const;
    return dimensoes.map(([dimensao, chave]) => {
      const a = new Map(agregar(dadosMesComparativoA, [chave]).map((row: any) => [String(row[chave] || "Não informado"), valorMetrica(row, metricaMoM)]));
      const b = new Map(agregar(dadosMesComparativoB, [chave]).map((row: any) => [String(row[chave] || "Não informado"), valorMetrica(row, metricaMoM)]));
      const itens = Array.from(new Set([...a.keys(), ...b.keys()])).map((item) => {
        const valorA = a.get(item) || 0;
        const valorB = b.get(item) || 0;
        const variacao = calcularVariacaoComparativo(valorA, valorB);
        return { dimensao, item, valor_a: valorA, valor_b: valorB, delta: variacao.delta, variacao_pct: variacao.percentual };
      }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      return { dimensao, itens };
    });
  }, [dadosMesComparativoA, dadosMesComparativoB, metricaMoM]);

  // A análise de metas mostra todo o histórico disponível, sem obedecer ao período global.
  const dadosMetas = useMemo(() => dados.filter((item) => {
    const dataItem = item.data_emissao.toISOString().slice(0, 10);
    const dentroInicio = !metaDataInicio || dataItem >= metaDataInicio;
    const dentroFim = !metaDataFim || dataItem <= metaDataFim;
    const dentroTipo = !metaTiposProduto.length || metaTiposProduto.includes(item.tipo_produto);
    const dentroVenda = !metaTiposVenda.length || metaTiposVenda.includes(item.tipo_venda);
    const dentroRegiao = !metaRegioes.length || metaRegioes.includes(item.regiao);
    const dentroUf = !metaUfs.length || metaUfs.includes(item.uf);
    const dentroRepresentante = !metaRepresentantes.length || metaRepresentantes.includes(item.representante);
    const dentroCliente = !metaClientes.length || metaClientes.includes(item.cliente);
    return dentroInicio && dentroFim && dentroTipo && dentroVenda && dentroRegiao && dentroUf && dentroRepresentante && dentroCliente;
  }), [dados, metaDataInicio, metaDataFim, metaTiposProduto, metaTiposVenda, metaRegioes, metaUfs, metaRepresentantes, metaClientes]);
  const formasVendaPeriodoMeta = useMemo(() => {
    return Array.from(dados.filter((item) => {
      const dataItem = item.data_emissao.toISOString().slice(0, 10);
      return (!metaDataInicio || dataItem >= metaDataInicio) && (!metaDataFim || dataItem <= metaDataFim);
    }).reduce((map, item) => map.set(item.tipo_venda, (map.get(item.tipo_venda) || 0) + 1), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
  }, [dados, metaDataInicio, metaDataFim]);
  const dadosMensaisBase = useMemo(() => {
    const agg = agregar(dadosMetas, ["ano_mes", "ano_mes_data", "ano", "mes_num", "mes"]);
    agg.sort((a, b) => a.ano_mes_data.localeCompare(b.ano_mes_data));
    return agg;
  }, [dadosMetas]);

  const cidadesFatoresExternos = opcoesFiltros.cidades;
  useEffect(() => {
    setCidadeFatoresExternos((atual) => atual && cidadesFatoresExternos.includes(atual) ? atual : (cidadesFatoresExternos[0] || ""));
  }, [cidadesFatoresExternos]);
  const cidadesClientesFatores = useMemo(() => Array.from(new Map(dados.filter((item) => item.cidade && item.uf).map((item) => [`${item.cidade}|${item.uf}`, { cidade: item.cidade, uf: item.uf }])).values()).sort((a, b) => `${a.cidade}|${a.uf}`.localeCompare(`${b.cidade}|${b.uf}`)), [dados]);
  useEffect(() => {
    setCidadesSelecionadasFatores((atuais) => atuais.length ? atuais.filter((key) => cidadesClientesFatores.some((item) => `${item.cidade}|${item.uf}` === key)) : cidadesClientesFatores.slice(0, 40).map((item) => `${item.cidade}|${item.uf}`));
  }, [cidadesClientesFatores]);
  const localidadesFatoresSelecionadas = useMemo(() => {
    if (abrangenciaFatores === "brasil") return Object.entries(CAPITAIS_ESTADOS).map(([uf, cidade]) => ({ cidade, uf }));
    if (abrangenciaFatores === "regiao") {
      const ufs = new Set(dados.filter((item) => item.regiao === regiaoFatores).map((item) => item.uf));
      return Array.from(ufs).filter((uf) => CAPITAIS_ESTADOS[uf]).map((uf) => ({ cidade: CAPITAIS_ESTADOS[uf], uf }));
    }
    if (abrangenciaFatores === "uf") return ufsFatores.filter((uf) => CAPITAIS_ESTADOS[uf]).map((uf) => ({ cidade: CAPITAIS_ESTADOS[uf], uf }));
    if (abrangenciaFatores === "clientes") return cidadesSelecionadasFatores.map((key) => { const [cidade, uf] = key.split("|"); return { cidade, uf }; }).filter((item) => item.cidade && item.uf).slice(0, 40);
    const uf = dados.find((item) => item.cidade === cidadeFatoresExternos)?.uf;
    return cidadeFatoresExternos ? [{ cidade: cidadeFatoresExternos, uf }] : [];
  }, [abrangenciaFatores, cidadesSelecionadasFatores, cidadeFatoresExternos, dados, regiaoFatores, ufsFatores]);
  const descricaoAbrangenciaFatores = abrangenciaFatores === "brasil" ? "Brasil — capitais dos 27 estados" : abrangenciaFatores === "regiao" ? `${regiaoFatores} — capitais dos estados com clientes` : abrangenciaFatores === "uf" ? `Estados selecionados — ${ufsFatores.join(", ")}` : abrangenciaFatores === "clientes" ? `Cidades dos clientes — ${localidadesFatoresSelecionadas.length} localidades` : cidadeFatoresExternos;
  const fatoresExternosInput = useMemo(() => ({
    dataInicio: filtros.dataInicio || meta?.data_min?.toISOString().slice(0, 10) || "2022-01-01",
    dataFim: filtros.dataFim || meta?.data_max?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10),
    cidade: abrangenciaFatores === "cidade" ? cidadeFatoresExternos : "Brasil",
    uf: abrangenciaFatores === "cidade" ? localidadesFatoresSelecionadas[0]?.uf : undefined,
    localidades: abrangenciaFatores === "cidade" ? undefined : localidadesFatoresSelecionadas,
    descricaoAbrangencia: descricaoAbrangenciaFatores,
  }), [abrangenciaFatores, cidadeFatoresExternos, descricaoAbrangenciaFatores, filtros.dataInicio, filtros.dataFim, localidadesFatoresSelecionadas, meta?.data_min, meta?.data_max]);
  const fatoresExternosQuery = trpc.cemag.fatoresExternos.useQuery(fatoresExternosInput, {
    enabled: (abaAtiva === "previsoes" || abaAtiva === "previsoes_agro") && localidadesFatoresSelecionadas.length > 0,
    retry: false,
    staleTime: 15 * 60 * 1000,
  });
  const statusFontesExternas = useMemo(() => {
    const resultado = fatoresExternosQuery.data;
    const fontes = resultado?.fontes || [];
    const avisos = resultado?.avisos || [];
    const verificar = (nome: string, palavras: string[]) => {
      const ok = fontes.some((fonte) => palavras.some((palavra) => fonte.toLowerCase().includes(palavra.toLowerCase())));
      const aviso = avisos.some((item) => palavras.some((palavra) => item.toLowerCase().includes(palavra.toLowerCase())));
      return ok ? "ok" : aviso ? "aviso" : "não consultada";
    };
    return [
      { nome: "Selic / BCB", status: verificar("Selic", ["selic", "Banco Central"]) },
      { nome: "Chuva / NASA", status: verificar("NASA", ["NASA", "Chuva"]) },
      { nome: "Previsão / Open-Meteo", status: verificar("Open-Meteo", ["Open-Meteo", "Chuva"]) },
      { nome: "Sazonal / CPTEC", status: verificar("CPTEC", ["CPTEC", "sazonal"]) },
      { nome: "Produção / IBGE", status: verificar("IBGE", ["IBGE", "produção"]) },
      { nome: "Commodities", status: verificar("commodities", ["Yahoo Finance", "commodities"]) },
      { nome: "Crédito / SICOR", status: resultado?.indicadores_agro.credito_status === "consultado" ? "ok" : resultado?.indicadores_agro.credito_status === "indisponivel" ? "aviso" : "não consultada" },
    ] as Array<{ nome: string; status: "ok" | "aviso" | "não consultada" }>;
  }, [fatoresExternosQuery.data]);
  const serieFatoresExternos = useMemo(() => {
    const porMes = new Map((fatoresExternosQuery.data?.meses || []).map((item) => [item.ano_mes, item]));
    return dadosMensais.map((item: any) => ({
      ano_mes: item.ano_mes,
      vendas: valorMetrica(item, metricaPrevisao),
      chuva_mm: porMes.get(item.ano_mes)?.chuva_mm ?? null,
      selic_media_pct: porMes.get(item.ano_mes)?.selic_media_pct ?? null,
    }));
  }, [dadosMensais, fatoresExternosQuery.data?.meses, metricaPrevisao]);
  const previsaoChuvaFutura = fatoresExternosQuery.data?.previsao_chuva || [];
  const expectativasSelicFuturas = fatoresExternosQuery.data?.expectativas_selic || [];
  const previsaoSazonal = fatoresExternosQuery.data?.previsao_sazonal || [];
  const indiceAgro = useMemo(() => {
    const dadosExternos = fatoresExternosQuery.data;
    if (!dadosExternos) return null;
    let pontuacao = 50;
    const componentes: Array<{ nome: string; valor: number; explicacao: string }> = [];
    const chuvaValida = previsaoChuvaFutura.map((item) => Number(item.chuva_mm)).filter(Number.isFinite);
    if (chuvaValida.length) {
      const mediaChuva = chuvaValida.reduce((sum, value) => sum + value, 0) / chuvaValida.length;
      const ajuste = mediaChuva >= 2 && mediaChuva <= 12 ? 8 : mediaChuva > 25 ? -8 : 0;
      pontuacao += ajuste;
      componentes.push({ nome: "Chuva de curto prazo", valor: ajuste, explicacao: `${mediaChuva.toFixed(1)} mm/dia em média nos dias consultados` });
    }
    const selicHistorica = dadosExternos.meses.map((item) => Number(item.selic_media_pct)).filter(Number.isFinite).at(-1);
    const selicFutura = expectativasSelicFuturas.map((item) => Number(item.mediana_pct ?? item.media_pct)).filter(Number.isFinite);
    if (selicHistorica != null && selicFutura.length) {
      const mediaFutura = selicFutura.reduce((sum, value) => sum + value, 0) / selicFutura.length;
      const ajuste = mediaFutura <= selicHistorica - 0.5 ? 8 : mediaFutura >= selicHistorica + 0.5 ? -8 : 0;
      pontuacao += ajuste;
      componentes.push({ nome: "Juros futuros", valor: ajuste, explicacao: `Focus ${mediaFutura.toFixed(2)}% versus Selic histórica ${selicHistorica.toFixed(2)}%` });
    }
    const sinais = previsaoSazonal.map((item) => Number(item.valor_sinal)).filter(Number.isFinite);
    if (sinais.length) {
      const sinal = sinais.reduce((sum, value) => sum + value, 0) / sinais.length;
      const ajuste = sinal > 0.15 ? 6 : sinal < -0.15 ? -6 : 0;
      pontuacao += ajuste;
      componentes.push({ nome: "Sinal climático sazonal", valor: ajuste, explicacao: sinal > 0.15 ? "predominância acima do normal" : sinal < -0.15 ? "predominância abaixo do normal" : "sem sinal predominante" });
    }
    const credito = dadosExternos.indicadores_agro.credito_status;
    if (credito === "consultado") pontuacao += 5;
    if (credito === "indisponivel") pontuacao -= 5;
    componentes.push({ nome: "Crédito rural", valor: credito === "consultado" ? 5 : credito === "indisponivel" ? -5 : 0, explicacao: `status ${credito}` });
    const score = Math.max(0, Math.min(100, Math.round(pontuacao)));
    const classe = score >= 65 ? "favorável" : score <= 35 ? "atenção" : "neutro";
    const alertas = componentes.filter((item) => item.valor < 0).map((item) => `${item.nome}: ${item.explicacao}.`);
    return { score, classe, componentes, alertas };
  }, [expectativasSelicFuturas, fatoresExternosQuery.data, previsaoChuvaFutura, previsaoSazonal]);

  const atingimentoMensal = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const row of dadosMensaisBase) mapa.set(`${row.ano}-${row.mes_num}`, { ...row, realizado: row.faturamento });
    const metas = [...metasImportadas, ...(metaManualSalva ? [metaManualSalva] : [])];
    for (const meta of metas) {
      const key = `${meta.ano}-${meta.mes}`;
      const row = mapa.get(key) || { ano: meta.ano, mes_num: meta.mes, mes: MESES[meta.mes], ano_mes: `${meta.ano}-${String(meta.mes).padStart(2, "0")}`, realizado: 0 };
      row.meta = meta.meta; row.origem_meta = meta.origem || "CSV"; row.atingimento = meta.meta > 0 ? row.realizado / meta.meta : 0; row.diferenca_meta = row.realizado - meta.meta;
      mapa.set(key, row);
    }
    return Array.from(mapa.values()).filter((row) => row.meta !== undefined).sort((a, b) => `${a.ano}-${a.mes_num}`.localeCompare(`${b.ano}-${b.mes_num}`));
  }, [dadosMensaisBase, metasImportadas, metaManualSalva]);

  // Mapa de UF para componente MapBrasil
  const dadosPorUf = useMemo(() => {
    const res: Record<string, { faturamento: number; quantidade: number; pedidos: number; clientes: number }> = {};
    for (const d of dadosFiltrados) {
      if (!res[d.uf]) res[d.uf] = { faturamento: 0, quantidade: 0, pedidos: 0, clientes: 0 };
      res[d.uf].faturamento += d.faturamento;
      res[d.uf].quantidade += d.quantidade;
    }
    // Pedidos e clientes únicos por UF
    for (const [uf, info] of Object.entries(res)) {
      const itemsUf = dadosFiltrados.filter((d) => d.uf === uf);
      info.pedidos = new Set(itemsUf.map((d) => d.pedido)).size;
      info.clientes = new Set(itemsUf.map((d) => d.cliente)).size;
    }
    return res;
  }, [dadosFiltrados]);

  const dadosMunicipios = useMemo(() => {
    const grupos = agregar(dadosFiltrados, ["cidade", "uf"]);
    return grupos.map((row: any) => ({ cidade: row.cidade, uf: row.uf, faturamento: row.faturamento, quantidade: row.quantidade, pedidos: row.pedidos, clientes: row.clientes }));
  }, [dadosFiltrados]);

  const dadosPrevisao = useMemo(() => {
    const inicio = previsaoDataInicio ? new Date(`${previsaoDataInicio}T00:00:00`) : null;
    const fim = previsaoDataFim ? new Date(`${previsaoDataFim}T23:59:59`) : null;
    return dadosFiltradosSemPeriodo.filter((item) => (!inicio || item.data_emissao >= inicio) && (!fim || item.data_emissao <= fim));
  }, [dadosFiltradosSemPeriodo, previsaoDataInicio, previsaoDataFim]);
  const previsaoMensal = useMemo(() => gerarPrevisaoMensal(dadosPrevisao, horizontePrevisao, metricaPrevisao, { incluirMesVigente: incluirMesVigentePrevisao }), [dadosPrevisao, horizontePrevisao, metricaPrevisao, incluirMesVigentePrevisao]);
  const validacaoPrevisao = useMemo(() => validarPrevisaoMensal(dadosPrevisao, metricaPrevisao), [dadosPrevisao, metricaPrevisao]);
  const explicacaoPrevisoes = useMemo(() => previsaoMensal.serie.filter((item) => item.tipo === "Previsão").map((item) => {
    const provavel = Number(item.previsao || 0);
    const conservador = Number(item.conservador || 0);
    const otimista = Number(item.otimista || 0);
    const margem = provavel ? (otimista / provavel - 1) : 0;
    return {
      mes: item.ano_mes,
      metrica: metricaPrevisao,
      conservador,
      provavel,
      otimista,
      margem_pct: margem,
      explicacao: `Provável = tendência + sazonalidade; Conservador = provável - ${(margem * 100).toFixed(1)}%; Otimista = provável + ${(margem * 100).toFixed(1)}%. Faixa baseada no erro histórico.`,
    };
  }), [previsaoMensal, metricaPrevisao]);
  const ultimoMesParcial = useMemo(() => {
    const vigente = previsaoMensal.serie.find((item) => item.mes_vigente);
    return vigente ? { ano_mes: vigente.ano_mes, parcial: vigente.realizado_parcial, fechamento: vigente.estimativa_fechamento, referencia_historica_mes: vigente.referencia_historica_mes, dias_decorridos: vigente.dias_decorridos, dias_periodo: vigente.dias_periodo } : null;
  }, [previsaoMensal]);

  const diagnosticoBase = useMemo(() => {
    const dataMin = meta?.data_min as Date | undefined;
    const dataMax = meta?.data_max as Date | undefined;
    const mesesEsperados: string[] = [];
    if (dataMin && dataMax) {
      const cursor = new Date(dataMin.getFullYear(), dataMin.getMonth(), 1);
      const fim = new Date(dataMax.getFullYear(), dataMax.getMonth(), 1);
      while (cursor <= fim) {
        mesesEsperados.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const mesesComVenda = new Set(dados.map((d) => d.ano_mes));
    const mesesSemVenda = mesesEsperados.filter((mes) => !mesesComVenda.has(mes));
    const anual = agregar(dados, ["ano"]).sort((a, b) => a.ano - b.ano);
    return {
      mesesEsperados,
      mesesSemVenda,
      anual,
      qtdNaoPositiva: dados.filter((d) => d.quantidade <= 0).length,
      faturamentoNaoPositivo: dados.filter((d) => d.faturamento <= 0).length,
      ufNaoIdentificada: dados.filter((d) => !d.uf || d.uf === "Não identificado").length,
      cidadeNaoIdentificada: dados.filter((d) => !d.cidade || d.cidade === "Não identificado").length,
      produtoNaoInformado: dados.filter((d) => !d.produto || d.produto === "Não informado").length,
      clienteNaoInformado: dados.filter((d) => !d.cliente || d.cliente === "Não informado").length,
    };
  }, [dados, meta]);

  const classificacaoFiltrada = useMemo(() => {
    const mapa = new Map<string, { tipo_produto: string; linhas: number; quantidade: number; faturamento: number; pedidos: Set<string>; clientes: Set<string>; produtos: Set<string>; categorias: Set<string> }>();
    for (const d of dadosFiltrados) {
      const tipo = d.tipo_produto || "Outros";
      if (!mapa.has(tipo)) mapa.set(tipo, { tipo_produto: tipo, linhas: 0, quantidade: 0, faturamento: 0, pedidos: new Set(), clientes: new Set(), produtos: new Set(), categorias: new Set() });
      const item = mapa.get(tipo)!;
      item.linhas += 1;
      item.quantidade += Number(d.quantidade || 0);
      item.faturamento += Number(d.faturamento || 0);
      item.pedidos.add(d.pedido);
      item.clientes.add(d.cliente);
      if (d.produto) item.produtos.add(d.produto);
      if (d.categoria_produto) item.categorias.add(d.categoria_produto);
    }
    const totalQuantidade = dadosFiltrados.reduce((s, d) => s + Number(d.quantidade || 0), 0);
    const totalFaturamento = dadosFiltrados.reduce((s, d) => s + Number(d.faturamento || 0), 0);
    const criterio: Record<string, string> = {
      Carreta: "Prefixo CBH/CTH/FTC/F6/FA/MCF/SEF/ROCAX ou texto de carreta/implemento",
      Conjunto: "Texto contém CONJUNTO ou KIT",
      Peça: "Descrição contém peça, eixo, roda, pneu, motor, acessório e termos similares",
      Sucata: "Código 00000 ou texto contém sucata/salvado",
      "Itens comprados": "Código do produto começa com 2",
      Outros: "Não atendeu às regras específicas anteriores",
    };
    return Array.from(mapa.values()).map((item) => ({
      tipo_produto: item.tipo_produto,
      criterio: criterio[item.tipo_produto] || "Regra de classificação aplicada",
      linhas: item.linhas,
      quantidade: item.quantidade,
      participacao_quantidade: totalQuantidade ? item.quantidade / totalQuantidade : 0,
      faturamento: item.faturamento,
      participacao_faturamento: totalFaturamento ? item.faturamento / totalFaturamento : 0,
      pedidos: item.pedidos.size,
      clientes: item.clientes.size,
      produtos_distintos: item.produtos.size,
      exemplos_produtos: Array.from(item.produtos).slice(0, 5).join(" | "),
      categorias_origem: Array.from(item.categorias).slice(0, 4).join(" | "),
    })).sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento);
  }, [dadosFiltrados]);

  // Formas de venda texto para exibição
  const formasVendaTexto = filtros.considerarTodasFormas
    ? "Todas"
    : filtros.tiposVendaSelecionados.join(", ") || "Nenhuma";
  const familiasExcluidasTexto = filtros.familiasExcluidas.length
    ? filtros.familiasExcluidas.join(", ")
    : "Nenhuma";

  const formatarDataResumo = (valor: Date | string | undefined) => {
    if (!valor) return "—";
    const data = valor instanceof Date ? valor : new Date(`${valor}T00:00:00`);
    return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
  };
  const periodoBaseTexto = `${formatarDataResumo(meta?.data_min)} a ${formatarDataResumo(meta?.data_max)}`;
  const periodoFiltroTexto = `${formatarDataResumo(filtros.dataInicio)} a ${formatarDataResumo(filtros.dataFim)}`;
  const periodoEfetivo = useMemo(() => {
    if (!dadosFiltrados.length) return "Nenhum registro";
    const datas = dadosFiltrados.map((d) => d.data_emissao).filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
    return `${formatarDataResumo(datas[0])} a ${formatarDataResumo(datas[datas.length - 1])}`;
  }, [dadosFiltrados]);

  // Resumo rápido para decisões: usa o último mês disponível no filtro e compara
  // automaticamente com o mesmo mês do ano anterior.
  const painelAgora = useMemo(() => {
    const meses = Array.from(new Set(dadosFiltrados.map((item) => item.ano_mes))).sort();
    const mesAtual = meses[meses.length - 1] || "";
    const [anoAtualTexto, mesAtualTexto] = mesAtual.split("-");
    const anoAtual = Number(anoAtualTexto);
    const mesAtualNumero = Number(mesAtualTexto);
    const registrosAtual = dadosFiltrados.filter((item) => item.ano_mes === mesAtual);
    const registrosAnterior = dadosFiltrados.filter((item) => item.ano === anoAtual - 1 && item.mes_num === mesAtualNumero);
    const soma = (registros: TransacaoTratada[]) => {
      const pedidos = new Set(registros.map((item) => item.pedido).filter(Boolean));
      const clientes = new Set(registros.map((item) => item.cliente).filter(Boolean));
      return { faturamento: registros.reduce((total, item) => total + item.faturamento, 0), quantidade: registros.reduce((total, item) => total + item.quantidade, 0), pedidos: pedidos.size, clientes: clientes.size };
    };
    const atual = soma(registrosAtual);
    const anterior = soma(registrosAnterior);
    const metaEncontrada = [...metasImportadas, ...(metaManualSalva ? [metaManualSalva] : [])].find((item) => item.ano === anoAtual && item.mes === mesAtualNumero);
    const diasRegistrados = registrosAtual.reduce((maior, item) => Math.max(maior, item.dia_mes || 0), 0);
    const diasNoMes = mesAtual ? new Date(anoAtual, mesAtualNumero, 0).getDate() : 0;
    const estaNoMesVigente = anoAtual === hoje.getFullYear() && mesAtualNumero === hoje.getMonth() + 1;
    const projecao = estaNoMesVigente && diasRegistrados > 0 ? (atual.faturamento / diasRegistrados) * diasNoMes : atual.faturamento;
    const variacao = anterior.faturamento ? ((atual.faturamento - anterior.faturamento) / Math.abs(anterior.faturamento)) * 100 : null;
    const atingimento = metaEncontrada && metaEncontrada.meta > 0 ? atual.faturamento / metaEncontrada.meta : null;
    const diasRestantes = estaNoMesVigente ? Math.max(0, diasNoMes - hoje.getDate()) : 0;
    const necessarioDia = metaEncontrada && diasRestantes > 0 ? Math.max(0, metaEncontrada.meta - atual.faturamento) / diasRestantes : 0;
    const top = (campo: keyof TransacaoTratada) => {
      const mapa = new Map<string, number>();
      for (const item of registrosAtual) { const nome = String(item[campo] || "Não informado"); mapa.set(nome, (mapa.get(nome) || 0) + item.faturamento); }
      return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])[0] || ["—", 0] as [string, number];
    };
    return { mesAtual, atual, anterior, meta: metaEncontrada?.meta || 0, projecao, variacao, atingimento, necessarioDia, estaNoMesVigente, diasRestantes, topCliente: top("cliente"), topProduto: top("produto"), topRegiao: top("regiao") };
  }, [dadosFiltrados, metasImportadas, metaManualSalva, hoje]);

  const linhasRelatorio = useMemo(() => {
    const inicio = relatorioDataInicio ? new Date(`${relatorioDataInicio}T00:00:00`).getTime() : -Infinity;
    const fim = relatorioDataFim ? new Date(`${relatorioDataFim}T23:59:59`).getTime() : Infinity;
    return dadosFiltrados.filter((item) => item.data_emissao.getTime() >= inicio && item.data_emissao.getTime() <= fim);
  }, [dadosFiltrados, relatorioDataInicio, relatorioDataFim]);

  const dadosRelatorio = useMemo(() => {
    const totalFaturamento = linhasRelatorio.reduce((sum, item) => sum + Number(item.faturamento || 0), 0);
    const totalQuantidade = linhasRelatorio.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
    const agrupar = (campo: keyof TransacaoTratada) => {
      const mapa = new Map<string, { nome: string; faturamento: number; quantidade: number }>();
      linhasRelatorio.forEach((item) => {
        const nome = String(item[campo] || "Não informado");
        const atual = mapa.get(nome) || { nome, faturamento: 0, quantidade: 0 };
        atual.faturamento += Number(item.faturamento || 0);
        atual.quantidade += Number(item.quantidade || 0);
        mapa.set(nome, atual);
      });
      return Array.from(mapa.values()).sort((a, b) => b.faturamento - a.faturamento).slice(0, 10);
    };
    return {
      totalFaturamento,
      totalQuantidade,
      pedidos: new Set(linhasRelatorio.map((item) => item.pedido).filter(Boolean)).size,
      clientes: new Set(linhasRelatorio.map((item) => item.cliente).filter(Boolean)).size,
      linhas: linhasRelatorio.length,
      topClientes: agrupar("cliente"),
      topProdutos: agrupar("produto"),
      topRegioes: agrupar("regiao"),
      meses: Array.from(new Set(linhasRelatorio.map((item) => item.ano_mes))).sort().map((mes) => { const registros = linhasRelatorio.filter((item) => item.ano_mes === mes); return { mes, faturamento: registros.reduce((sum, item) => sum + item.faturamento, 0), quantidade: registros.reduce((sum, item) => sum + item.quantidade, 0), pedidos: new Set(registros.map((item) => item.pedido)).size, clientes: new Set(registros.map((item) => item.cliente)).size }; }).slice(-24),
    };
  }, [linhasRelatorio]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Carregando painel analítico...</h2>
        <p className="text-sm text-slate-400 mt-2">Processando regras de faturamento, regiões e clientes.</p>
      </div>
    );
  }

  return (
    <div className={`cemag-dashboard ${temaDashboard === "black" ? "tema-black" : ""} min-h-screen bg-[#f4f4f2] text-[#222222] flex flex-col font-sans`}>
      {/* Top Header CEMAG */}
      <header className="bg-[#111827] border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white px-2 py-1 shadow-sm"><img src="/manus-storage/cemag-logo-orange_4de005c2.png" alt="CEMAG" className="h-7 w-auto object-contain" /></div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Inteligência Comercial</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    CEMAG Carretas Agrícolas
                  </span>
                  {emailAutenticado && <span className={`hidden lg:inline-flex items-center rounded border px-2 py-0.5 text-[10px] ${isAdmin ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300"}`} title={emailAutenticado}>{isAdmin ? "Administrador" : "Consulta"}</span>}
                </h1>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Painel de inteligência de faturamento, clientes, regiões e mix de carretas
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {emailAutenticado && <span className="hidden xl:inline max-w-[220px] truncate text-[11px] text-slate-400" title={emailAutenticado}>{emailAutenticado}</span>}
            <button type="button" onClick={() => setTemaDashboard((tema) => tema === "claro" ? "black" : "claro")} className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors shadow-sm" title="Alternar tema visual">
              <span className="h-3 w-3 rounded-full border border-orange-300 bg-orange-500" />
              <span className="hidden sm:inline">{temaDashboard === "black" ? "Tema claro" : "Black"}</span>
            </button>
            <button type="button" onClick={() => setRelatorioAberto(true)} className="no-print flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg border border-orange-500 transition-colors shadow-sm" title="Gerar relatório para impressão">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gerar relatório</span>
            </button>
            <button
              onClick={() => setSidebarOculta((v) => !v)}
              className="hidden lg:flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors shadow-sm"
              title={sidebarOculta ? "Mostrar painel de filtros" : "Ocultar painel de filtros"}
            >
              <Sliders className="w-3.5 h-3.5 text-sky-300" />
              <span>{sidebarOculta ? "Mostrar filtros" : "Ocultar filtros"}</span>
            </button>
            <button
              onClick={() => setVisualizacaoExpandida((v) => !v)}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors shadow-sm"
              title={visualizacaoExpandida ? "Sair da visualização ampliada" : "Expandir gráficos e mapas"}
            >
              {visualizacaoExpandida ? <Eye className="w-3.5 h-3.5 text-orange-300" /> : <Tv className="w-3.5 h-3.5 text-orange-300" />}
              <span className="hidden sm:inline">{visualizacaoExpandida ? "Sair da expansão" : "Expandir visualizações"}</span>
            </button>
            <button
              onClick={handleResetFiltros}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors shadow-sm"
              title="Restaurar parâmetros padrão"
            >
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Restaurar Padrões</span>
            </button>
            <button
              onClick={() => setAbaAtiva("exportacoes")}
              className="flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-red-900/60 text-slate-200 hover:text-red-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors shadow-sm"
                title="Sair da conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumo compacto de filtros ativos */}
        <div className="max-w-[1700px] mx-auto mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Fonte: <strong className="text-slate-200">{nomeArquivoBase}</strong></span>
            <span>•</span>
            <span>Formas de venda: <strong className="text-amber-400">{formasVendaTexto}</strong></span>
            <span>•</span>
            <span>Famílias excluídas: <strong className="text-slate-200">{familiasExcluidasTexto}</strong></span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Base: <strong className="text-slate-200">{periodoBaseTexto}</strong></span>
            <span>Filtro: <strong className="text-sky-300">{periodoFiltroTexto}</strong></span>
            <span>Resultado: <strong className="text-emerald-300">{periodoEfetivo}</strong></span>
            <span>Linhas: <strong className="text-orange-400">{dadosFiltrados.length.toLocaleString("pt-BR")}</strong> de {meta?.linhas_validas?.toLocaleString("pt-BR")}</span>
          </div>
        </div>
        {mensagemUpload && (
          <div className={`max-w-[1700px] mx-auto mt-2 rounded-lg border px-3 py-2 text-xs ${mensagemUpload.tipo === "sucesso" ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-200" : mensagemUpload.tipo === "erro" ? "border-red-700/60 bg-red-950/40 text-red-200" : "border-amber-700/60 bg-amber-950/40 text-amber-200"}`} role="status">
            {mensagemUpload.texto}
          </div>
        )}
      </header>

      {/* Conteúdo com Sidebar fixa na esquerda */}
      <div className="flex-1 flex max-w-[1700px] w-full mx-auto">
        {!sidebarOculta && <SidebarFilters
          filtros={filtros}
          setFiltros={setFiltros}
          opcoesFiltros={opcoesFiltros}
          nomeArquivoBase={nomeArquivoBase}
          onUploadArquivo={handleUploadArquivo}
          isAdmin={isAdmin}
          onResetFiltros={handleResetFiltros}
          linhasFiltradas={dadosFiltrados.length}
          totalLinhasValidas={meta?.linhas_validas || 0}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />}
        {sidebarOculta && !visualizacaoExpandida && (
          <button
            type="button"
            onClick={() => setSidebarOculta(false)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 rounded-r-xl border border-l-0 border-orange-500/50 bg-slate-900 px-2.5 py-3 text-xs font-semibold text-orange-300 shadow-xl hover:bg-slate-800"
            title="Mostrar painel de filtros"
          >
            <Sliders className="w-4 h-4" />
            <span className="[writing-mode:vertical-rl]">Filtros</span>
          </button>
        )}

        {/* Área Central Principal */}
        <main className={`printable-content ${visualizacaoExpandida ? "visualizacao-ampliada fixed inset-0 z-50 bg-[#0E1117] overflow-y-auto" : "flex-1"} p-4 md:p-6 overflow-x-hidden`}>
          {visualizacaoExpandida && <div className="sticky top-0 z-20 flex justify-end pb-3"><button type="button" onClick={() => setVisualizacaoExpandida(false)} className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-slate-900 px-3 py-2 text-xs font-semibold text-orange-300 shadow-lg hover:bg-slate-800"><Eye className="h-4 w-4" /> Sair da visualização ampliada</button></div>}
          {/* Navegação Superior de Abas (Idêntica ao st.radio PAGINAS) */}
          <div className="no-print mb-5 overflow-x-auto pb-1 scrollbar-thin">
            <div className="flex items-center gap-1.5 min-w-max bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
              {ABAS.map((aba) => {
                const isSelected = abaAtiva === aba.id;
                return (
                  <button
                    key={aba.id}
                    onClick={() => setAbaAtiva(aba.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      isSelected
                        ? "bg-orange-500 text-white shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    {aba.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Executivos de Topo (visíveis em todas as abas, exceto Modo Apresentação que tem cards próprios) */}
          {abaAtiva !== "modo_apresentacao" && (
            <MetricCards
              faturamento={kpis.faturamento}
              quantidade={kpis.quantidade}
              pedidos={kpis.pedidos}
              clientes={kpis.clientes}
              ticketUnitario={kpis.ticketUnitario}
              valorMedioPedido={kpis.valorMedioPedido}
            />
          )}

          {dadosFiltrados.length === 0 ? (
            <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-8 text-center my-6">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-300">Nenhum registro encontrado</h3>
              <p className="text-sm text-slate-300 mt-1">
                Tente ajustar os filtros na barra lateral ou selecionar outra forma de venda.
              </p>
              <button
                onClick={handleResetFiltros}
                className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg"
              >
                Restaurar Filtros Padrão
              </button>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* ABA 1: VISÃO GERAL */}
              {/* ========================================================= */}
              {abaAtiva === "visao_geral" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Visão Geral</h2>
                      <p className="text-xs text-slate-400">
                        Resumo executivo do período filtrado com foco nos principais movimentos comerciais.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">Métrica principal:</span>
                      <select
                        value={metricaVisao}
                        onChange={(e) => setMetricaVisao(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="Faturamento">Faturamento</option>
                        <option value="Quantidade">Quantidade</option>
                        <option value="Pedidos">Pedidos</option>
                        <option value="Clientes">Clientes</option>
                        <option value="Ticket unitário">Ticket unitário</option>
                        <option value="Valor médio por pedido">Valor médio por pedido</option>
                      </select>
                    </div>
                  </div>

                  {/* Painel Agora: números essenciais sem navegar pelas demais abas. */}
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white">Painel Agora</h3>
                        <p className="text-xs text-slate-400">Leitura rápida de {painelAgora.mesAtual || periodoEfetivo}, meta, ritmo e principais destaques.</p>
                      </div>
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300">Resumo executivo</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Faturamento</span><strong className="mt-1 block text-base text-white">{formatarMoeda(painelAgora.atual.faturamento)}</strong><span className={`text-[10px] font-semibold ${painelAgora.variacao !== null && painelAgora.variacao >= 0 ? "text-emerald-400" : "text-red-400"}`}>{painelAgora.variacao === null ? "Sem comparação" : `${painelAgora.variacao >= 0 ? "▲" : "▼"} ${Math.abs(painelAgora.variacao).toFixed(1)}% vs ano anterior`}</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Pedidos</span><strong className="mt-1 block text-base text-white">{formatarInteiro(painelAgora.atual.pedidos)}</strong><span className="text-[10px] text-slate-400">no período atual</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Clientes</span><strong className="mt-1 block text-base text-white">{formatarInteiro(painelAgora.atual.clientes)}</strong><span className="text-[10px] text-slate-400">compradores ativos</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Meta</span><strong className="mt-1 block text-base text-white">{painelAgora.meta ? formatarPercentual(painelAgora.atingimento || 0) : "—"}</strong><span className="text-[10px] text-slate-400">{painelAgora.meta ? `${formatarMoeda(painelAgora.meta)} definida` : "cadastre uma meta"}</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Projeção</span><strong className="mt-1 block text-base text-white">{formatarMoeda(painelAgora.projecao)}</strong><span className="text-[10px] text-slate-400">fechamento estimado</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Falta para meta</span><strong className="mt-1 block text-base text-white">{painelAgora.meta ? formatarMoeda(Math.max(0, painelAgora.meta - painelAgora.atual.faturamento)) : "—"}</strong><span className="text-[10px] text-slate-400">valor restante</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Ritmo diário</span><strong className="mt-1 block text-base text-white">{painelAgora.necessarioDia ? formatarMoeda(painelAgora.necessarioDia) : "—"}</strong><span className="text-[10px] text-slate-400">{painelAgora.diasRestantes ? `${painelAgora.diasRestantes} dias restantes` : "período fechado"}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">Cliente líder: </span><strong className="text-orange-300">{painelAgora.topCliente[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topCliente[1])}</span></div>
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">Produto líder: </span><strong className="text-orange-300">{painelAgora.topProduto[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topProduto[1])}</span></div>
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">Região líder: </span><strong className="text-orange-300">{painelAgora.topRegiao[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topRegiao[1])}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
                      {(() => {
                        const percentual = painelAgora.atingimento || 0;
                        const projecaoAtingimento = painelAgora.meta ? painelAgora.projecao / painelAgora.meta : 0;
                        const verde = painelAgora.meta > 0 && (percentual >= 1 || projecaoAtingimento >= 1);
                        const amarelo = painelAgora.meta > 0 && !verde && (percentual >= 0.75 || projecaoAtingimento >= 0.9);
                        const estilo = verde ? { borda: "border-emerald-500/30", fundo: "bg-emerald-500/10", texto: "text-emerald-300", ponto: "bg-emerald-400", trilho: "bg-emerald-950/60", suave: "text-emerald-200" } : amarelo ? { borda: "border-amber-500/30", fundo: "bg-amber-500/10", texto: "text-amber-300", ponto: "bg-amber-400", trilho: "bg-amber-950/60", suave: "text-amber-200" } : { borda: "border-red-500/30", fundo: "bg-red-500/10", texto: "text-red-300", ponto: "bg-red-400", trilho: "bg-red-950/60", suave: "text-red-200" };
                        const titulo = !painelAgora.meta ? "Meta não cadastrada" : verde ? "No ritmo para atingir a meta" : amarelo ? "Meta exige atenção" : "Ritmo abaixo do esperado";
                        return <div className={`rounded-lg border ${estilo.borda} ${estilo.fundo} p-3`}><div className="flex items-center justify-between gap-2"><span className={`text-xs font-bold ${estilo.texto}`}>{titulo}</span><span className={`h-2.5 w-2.5 rounded-full ${estilo.ponto}`} /></div><div className={`mt-2 h-2 overflow-hidden rounded-full ${estilo.trilho}`}><div className={`h-full rounded-full ${estilo.ponto}`} style={{ width: `${Math.min(100, Math.max(0, Math.round((painelAgora.meta ? Math.max(percentual, projecaoAtingimento) : 0) * 100)))}%` }} /></div><p className={`mt-2 text-[10px] ${estilo.suave}`}>{painelAgora.meta ? `Realizado ${formatarPercentual(percentual)} · projeção ${formatarPercentual(projecaoAtingimento)}` : "Informe uma meta mensal para ativar o semáforo."}</p></div>;
                      })()}
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"><div className="mb-2 text-xs font-bold text-white">O que mudou?</div><div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-300 sm:grid-cols-3"><span><b className="text-orange-300">{painelAgora.variacao === null ? "—" : `${painelAgora.variacao >= 0 ? "+" : ""}${painelAgora.variacao.toFixed(1)}%`}</b> vs mesmo mês do ano anterior</span><span><b className="text-orange-300">{formatarMoeda(painelAgora.topProduto[1])}</b> no produto líder</span><span><b className="text-orange-300">{formatarMoeda(painelAgora.topCliente[1])}</b> no cliente líder</span></div></div>
                    </div>
                  </div>

                  {/* 4 Destaques Líderes */}
                  {(() => {
                    const topCli = agregar(dadosFiltrados, ["cliente"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topProd = agregar(dadosFiltrados, ["produto"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topReg = agregar(dadosFiltrados, ["regiao"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topRep = agregar(dadosFiltrados, ["representante"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Cliente líder</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topCli?.cliente || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topCli, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Produto líder</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topProd?.produto || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topProd, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Região líder</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topReg?.regiao || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topReg, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Representante líder</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topRep?.representante || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topRep, metricaVisao), metricaVisao)}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Gráfico de Evolução Mensal */}
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
                    <h3 className="text-sm font-bold text-white mb-3">
                      Evolução mensal - {metricaVisao}
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosMensais} margin={{ top: 12, right: 24, left: 12, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="ano_mes" interval={intervaloEixoMensal(dadosMensais.length)} angle={dadosMensais.length > 18 ? -28 : -18} textAnchor="end" height={dadosMensais.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} />
                          <YAxis
                            stroke="#94A3B8"
                            fontSize={11}
                            tickFormatter={(v) => resumirMetrica(v, metricaVisao)}
                          />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155", borderRadius: "8px" }}
                            formatter={(v: any) => [
                              formatarMetrica(v, metricaVisao),
                              metricaVisao,
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey={campoMetrica(metricaVisao)}
                            stroke={CEMAG_ORANGE}
                            strokeWidth={3}
                            dot={{ fill: CEMAG_ORANGE_SOFT, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top 8 Produtos e Top 8 Clientes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top 8 Produtos */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">Top 8 carretas / produtos</h3>
                      {(() => {
                        const topProds = agregar(dadosFiltrados, ["produto"])
                          .sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))
                          .slice(0, 8);
                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={topProds} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaVisao)} fontSize={10} />
                                <YAxis dataKey="produto" type="category" stroke="#CBD5E1" fontSize={10} width={90} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaVisao), metricaVisao]}
                                />
                                <Bar dataKey={campoMetrica(metricaVisao)} fill={CEMAG_ORANGE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Top 8 Clientes */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">Top 8 clientes</h3>
                      {(() => {
                        const topClis = agregar(dadosFiltrados, ["cliente"])
                          .sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))
                          .slice(0, 8);
                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={topClis} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaVisao)} fontSize={10} />
                                <YAxis dataKey="cliente" type="category" stroke="#CBD5E1" fontSize={10} width={100} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaVisao), metricaVisao]}
                                />
                                <Bar dataKey={campoMetrica(metricaVisao)} fill={CEMAG_BLUE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 2: METAS MENSAIS */}
              {/* ========================================================= */}
              {abaAtiva === "metas" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">🎯 Metas mensais de faturamento</h2>
                    <p className="text-xs text-slate-400 mt-1">Importe metas históricas por CSV e informe manualmente a meta do mês vigente. A meta manual tem prioridade para o mesmo mês.</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-orange-400">Importar metas históricas por CSV</h3>
                      <p className="text-xs text-slate-400">Colunas aceitas: <code className="text-slate-200">mes;ano;meta</code>. Também aceita vírgula, nome do mês e valores no formato brasileiro.</p>
                      {isAdmin ? <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleUploadMetas(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-500" /> : <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">Modo consulta: as metas são carregadas da versão central publicada pela administradora.</div>}
                      <button onClick={() => exportarTabelaCsv([{ mes: 1, ano: hoje.getFullYear(), meta: 1000000 }], "modelo_metas_mensais.csv")} className="text-xs text-sky-400 hover:text-sky-300">Baixar modelo CSV</button>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-green-400">Meta manual do mês vigente</h3>
                      <p className="text-xs text-slate-400">{isAdmin ? "Atualize a meta do mês atual. A alteração será publicada para todos os usuários." : "A meta manual é exibida a partir da versão central publicada pela administradora."}</p>
                      <div className="grid grid-cols-3 gap-2"><label className="text-xs text-slate-400">Ano<input disabled={!isAdmin} type="number" value={metaManualAno} onChange={(e) => setMetaManualAno(Number(e.target.value))} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label><label className="text-xs text-slate-400">Mês<input disabled={!isAdmin} type="number" min="1" max="12" value={metaManualMes} onChange={(e) => setMetaManualMes(Number(e.target.value))} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label><label className="text-xs text-slate-400">Meta (R$)<input disabled={!isAdmin} type="text" placeholder="1.500.000,00" value={metaManualValor} onChange={(e) => setMetaManualValor(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label></div>
                      <div className="flex gap-2"><button disabled={!isAdmin} onClick={salvarMetaManual} className="rounded bg-green-600 hover:bg-green-500 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Salvar meta vigente</button><button disabled={!isAdmin} onClick={limparMetas} className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-50">Limpar metas</button></div>
                    </div>
                  </div>
                  {metaStatus && <div className="rounded-lg border border-sky-800/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">{metaStatus}</div>}
                  <div className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-sky-200">Filtros exclusivos da análise de metas</h3><p className="text-[11px] text-slate-400">Por padrão, considera todo o faturamento da base e ignora os filtros laterais.</p></div><button type="button" onClick={() => { setMetaDataInicio(""); setMetaDataFim(""); setMetaTiposProduto([]); setMetaTiposVenda([]); setMetaRegioes([]); setMetaUfs([]); setMetaRepresentantes([]); setMetaClientes([]); }} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700">Usar toda a base</button></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><label className="text-xs text-slate-400">Data inicial<input type="date" value={metaDataInicio} onChange={(e) => setMetaDataInicio(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white" /></label><label className="text-xs text-slate-400">Data final<input type="date" value={metaDataFim} onChange={(e) => setMetaDataFim(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white" /></label><MetaCheckboxFilter label="Tipos de produto" values={opcoesFiltros.tiposProduto} selected={metaTiposProduto} onChange={setMetaTiposProduto} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                      <MetaCheckboxFilter label="Tipos de venda" values={opcoesFiltros.tiposVenda} selected={metaTiposVenda} onChange={setMetaTiposVenda} />
                      <MetaCheckboxFilter label="Regiões" values={opcoesFiltros.regioes} selected={metaRegioes} onChange={setMetaRegioes} />
                      <MetaCheckboxFilter label="UFs" values={opcoesFiltros.ufs} selected={metaUfs} onChange={setMetaUfs} />
                      <MetaCheckboxFilter label="Representantes" values={opcoesFiltros.representantes} selected={metaRepresentantes} onChange={setMetaRepresentantes} />
                      <MetaCheckboxFilter label="Clientes" values={opcoesFiltros.clientes} selected={metaClientes} onChange={setMetaClientes} />
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-xs font-bold text-amber-200">Formas de venda encontradas no período da meta</h4><p className="text-[10px] text-slate-500">Use esta lista para identificar o que está sendo considerado. Os botões removem a forma dos filtros gerais ou desta aba.</p></div><span className="text-[10px] text-slate-500">{formasVendaPeriodoMeta.length} forma(s)</span></div><div className="flex flex-wrap gap-2 mt-2">{formasVendaPeriodoMeta.map(([tipo, quantidade]) => <span key={tipo} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300"><span>{tipo} ({quantidade})</span><button type="button" title="Desmarcar nos filtros gerais" onClick={() => setFiltros((prev) => ({ ...prev, tiposVendaSelecionados: prev.tiposVendaSelecionados.filter((v) => v !== tipo) }))} className="text-red-300 hover:text-red-200">× geral</button><button type="button" title="Desmarcar nas metas" onClick={() => setMetaTiposVenda((prev) => prev.filter((v) => v !== tipo))} className="text-sky-300 hover:text-sky-200">× meta</button></span>)}</div></div>
                    <p className="text-[11px] text-slate-500">Registros considerados nesta análise: {dadosMetas.length.toLocaleString("pt-BR")} de {dados.length.toLocaleString("pt-BR")}.</p>
                  </div>
                  {(() => { const vigente = atingimentoMensal.find((r) => r.ano === hoje.getFullYear() && r.mes_num === hoje.getMonth() + 1); const realizadoAtual = dadosMetas.filter((d) => d.ano === hoje.getFullYear() && d.mes_num === hoje.getMonth() + 1).reduce((s, d) => s + d.faturamento, 0); const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(); const projecao = realizadoAtual / Math.max(hoje.getDate(), 1) * diasNoMes; return <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Meta vigente</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(vigente?.meta || 0)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Realizado no mês</span><div className="text-xl font-bold text-white">{formatarMoeda(realizadoAtual)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Atingimento atual</span><div className={`text-xl font-bold ${(vigente?.meta && realizadoAtual / vigente.meta >= 1) ? "text-green-400" : "text-amber-400"}`}>{vigente?.meta ? formatarPercentual(realizadoAtual / vigente.meta) : "Sem meta"}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Projeção do mês</span><div className="text-xl font-bold text-sky-400">{formatarMoeda(projecao)}</div></div></div>; })()}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4"><h3 className="text-sm font-bold text-white mb-3">Atingimento por mês</h3>{atingimentoMensal.length ? <DataTable exportName="atingimento_mensal" rows={atingimentoMensal.map((r) => ({ ...r, status_meta: r.atingimento >= 1 ? "Atingida" : r.ano === hoje.getFullYear() && r.mes_num === hoje.getMonth() + 1 ? "Em andamento" : "Não atingida" }))} columns={["ano_mes","realizado","meta","atingimento","diferenca_meta","status_meta","origem_meta"]} /> : <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Nenhuma meta cadastrada. Importe um CSV ou salve a meta do mês vigente.</div>}</div>
                  {(() => {
                    const tiposMix = ["Carreta", "Peça", "Conjunto", "Sucata", "Itens comprados", "Outros"];
                    const coresMix: Record<string, string> = { Carreta: "#F97316", Peça: "#38BDF8", Conjunto: "#A78BFA", Sucata: "#94A3B8", "Itens comprados": "#22C55E", Outros: "#F43F5E" };
                    const porMes = new Map<string, Record<string, any>>();
                    for (const item of dadosMetas) {
                      const atual = porMes.get(item.ano_mes) || { ano_mes: item.ano_mes, ano_mes_data: item.ano_mes_data, total: 0 };
                      const tipo = tiposMix.includes(item.tipo_produto) ? item.tipo_produto : "Outros";
                      atual[tipo] = (atual[tipo] || 0) + item.faturamento;
                      atual.total += item.faturamento;
                      porMes.set(item.ano_mes, atual);
                    }
                    const mixMensal = Array.from(porMes.values()).sort((a, b) => a.ano_mes_data.localeCompare(b.ano_mes_data)).map((row) => ({ ...row, ...Object.fromEntries(tiposMix.map((tipo) => [tipo, row.total ? (row[tipo] || 0) / row.total : 0])) }));
                    return <div className="space-y-4"><div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl"><div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h3 className="text-sm font-bold text-white">Mix mensal do faturamento por tipo de produto</h3><p className="text-xs text-slate-400">Visão completa da base ou dos filtros exclusivos definidos nesta aba.</p></div><span className="text-[11px] text-slate-500">Percentuais somam 100% por mês</span></div><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={mixMensal} stackOffset="expand" margin={{ top: 10, right: 20, left: 20, bottom: 38 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(mixMensal.length)} angle={mixMensal.length > 18 ? -28 : -18} textAnchor="end" height={mixMensal.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} stroke="#94A3B8" fontSize={11} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any, name: string) => [formatarPercentual(v), name]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />{tiposMix.map((tipo) => <Bar key={tipo} dataKey={tipo} stackId="mix" fill={coresMix[tipo]} />)}</BarChart></ResponsiveContainer></div></div><DataTable exportName="mix_mensal_tipo_produto" rows={mixMensal} columns={["ano_mes", ...tiposMix, "total"]} percentColumns={tiposMix} /></div>;
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 3: MODO APRESENTAÇÃO */}
              {/* ========================================================= */}
              {abaAtiva === "modo_apresentacao" && (
                <div
                  className={`p-6 rounded-2xl border transition-colors ${
                    temaApresentacao === "Claro"
                      ? "bg-[#F8FAFC] text-slate-900 border-slate-300"
                      : "bg-[#07111F] text-slate-100 border-[#20314B]"
                  }`}
                >
                  {/* Barra de controle da apresentação */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/40">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Tv className="w-6 h-6 text-orange-500" />
                        <span>Painel Executivo para Projeção</span>
                      </h2>
                      <p className="text-xs opacity-75">
                        Layout otimizado para reunião de diretoria, telões e apresentações.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg">
                        <button
                          onClick={() => setTemaApresentacao("Escuro")}
                          className={`px-3 py-1 rounded ${
                            temaApresentacao === "Escuro" ? "bg-orange-600 text-white" : "opacity-70"
                          }`}
                        >
                          Escuro
                        </button>
                        <button
                          onClick={() => setTemaApresentacao("Claro")}
                          className={`px-3 py-1 rounded ${
                            temaApresentacao === "Claro" ? "bg-orange-600 text-white" : "opacity-70"
                          }`}
                        >
                          Claro
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Métrica:</span>
                        <select
                          value={metricaApresentacao}
                          onChange={(e) => setMetricaApresentacao(e.target.value)}
                          className="bg-black/20 border border-current/20 rounded px-2.5 py-1"
                        >
                          <option value="Faturamento">Faturamento</option>
                          <option value="Quantidade">Quantidade</option>
                          <option value="Pedidos">Pedidos</option>
                          <option value="Clientes">Clientes</option>
                          <option value="Ticket unitário">Ticket unitário</option>
                          <option value="Valor médio por pedido">Valor médio por pedido</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Top itens:</span>
                        <input
                          type="range"
                          min={5}
                          max={12}
                          value={topNApresentacao}
                          onChange={(e) => setTopNApresentacao(parseInt(e.target.value, 10))}
                          className="w-20"
                        />
                        <span className="font-bold">{topNApresentacao}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cards Gigantes de Apresentação */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-orange-500">
                      <div className="text-xs opacity-70">Faturamento Total</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarMoeda(kpis.faturamento)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Visão geral do período</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-orange-400">
                      <div className="text-xs opacity-70">Quantidade</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.quantidade)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Carretas entregues</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-blue-400">
                      <div className="text-xs opacity-70">Pedidos / Notas</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.pedidos)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Operações únicas</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-sky-400">
                      <div className="text-xs opacity-70">Clientes Ativos</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.clientes)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Na carteira filtrada</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-green-500">
                      <div className="text-xs opacity-70">Ticket Médio</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarMoeda(kpis.ticketUnitario)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Por produto faturado</div>
                    </div>
                  </div>

                  {/* Gráfico de Linha Executivo */}
                  <div className="p-5 rounded-xl border border-current/20 bg-current/5 mb-6">
                    <h3 className="text-base font-bold mb-4">Evolução Mensal - {metricaApresentacao}</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosMensais} margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="ano_mes" fontSize={12} stroke="currentColor" />
                          <YAxis fontSize={12} stroke="currentColor" tickFormatter={(v) => resumirMetrica(v, metricaApresentacao)} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "#0F172A", color: "#FFF", borderRadius: "8px" }}
                            formatter={(v: any) => [formatarMetrica(v, metricaApresentacao), metricaApresentacao]}
                          />
                          <Line
                            type="monotone"
                            dataKey={campoMetrica(metricaApresentacao)}
                            stroke={temaApresentacao === "Claro" ? "#EA580C" : "#7DD3FC"}
                            strokeWidth={4}
                            dot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Dois Rankings Principais */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl border border-current/20 bg-current/5">
                      <h4 className="text-sm font-bold mb-3">Top {topNApresentacao} Carretas / Produtos</h4>
                      {(() => {
                        const topP = agregar(dadosFiltrados, ["produto"])
                          .sort((a, b) => valorMetrica(b, metricaApresentacao) - valorMetrica(a, metricaApresentacao))
                          .slice(0, topNApresentacao);
                        return (
                          <div className="space-y-2.5">
                            {topP.map((item, idx) => (
                              <div key={item.produto} className="flex items-center justify-between text-xs p-2 rounded bg-black/10">
                                <span className="font-bold flex items-center gap-2 truncate">
                                  <span className="opacity-50">#{idx + 1}</span>
                                  <span className="truncate">{item.produto}</span>
                                </span>
                                <span className="font-extrabold text-orange-400 ml-2">{formatarMetrica(valorMetrica(item, metricaApresentacao), metricaApresentacao)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="p-5 rounded-xl border border-current/20 bg-current/5">
                      <h4 className="text-sm font-bold mb-3">Top {topNApresentacao} Clientes</h4>
                      {(() => {
                        const topC = agregar(dadosFiltrados, ["cliente"])
                          .sort((a, b) => valorMetrica(b, metricaApresentacao) - valorMetrica(a, metricaApresentacao))
                          .slice(0, topNApresentacao);
                        return (
                          <div className="space-y-2.5">
                            {topC.map((item, idx) => (
                              <div key={item.cliente} className="flex items-center justify-between text-xs p-2 rounded bg-black/10">
                                <span className="font-bold flex items-center gap-2 truncate">
                                  <span className="opacity-50">#{idx + 1}</span>
                                  <span className="truncate">{item.cliente}</span>
                                </span>
                                <span className="font-extrabold text-sky-400 ml-2">{formatarMetrica(valorMetrica(item, metricaApresentacao), metricaApresentacao)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 3: ANO X ANO */}
              {/* ========================================================= */}
              {abaAtiva === "ano_ano" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Comparativo Ano x Ano (YoY)</h2>
                      <p className="text-xs text-slate-400">
                        Compare dois exercícios para avaliar crescimento real, meses equivalentes e produtos de maior tração.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Ano base:</span>
                        <select
                          value={anoBaseYoY}
                          onChange={(e) => setAnoBaseYoY(parseInt(e.target.value, 10))}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"
                        >
                          {anosDisponiveisYoY.map((ano) => (
                            <option key={ano} value={ano}>{ano}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Ano comparação:</span>
                        <select
                          value={anoCompYoY}
                          onChange={(e) => setAnoCompYoY(parseInt(e.target.value, 10))}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"
                        >
                          {anosDisponiveisYoY.map((ano) => (
                            <option key={ano} value={ano}>{ano}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Métrica:</span>
                        <select
                          value={metricaYoY}
                          onChange={(e) => setMetricaYoY(e.target.value as MetricaComparativoAnual)}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"
                        >
                          <option value="faturamento">Faturamento</option>
                          <option value="quantidade">Quantidade</option>
                          <option value="pedidos">Pedidos</option>
                          <option value="clientes">Clientes</option>
                          <option value="ticket_unitario">Ticket unitário</option>
                          <option value="valor_medio_pedido">Valor médio por pedido</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={yoyMesesEquiv}
                          onChange={(e) => setYoyMesesEquiv(e.target.checked)}
                          className="rounded text-orange-500"
                        />
                        <span className="text-slate-300">Somente meses equivalentes</span>
                      </label>
                    </div>
                  </div>

                  {/* Comparativo de todos os anos com seleção independente */}
                  {(() => {
                    const coresAnos = ["#38BDF8", "#F97316", "#A78BFA", "#22C55E", "#F43F5E", "#FACC15", "#14B8A6", "#FB7185", "#60A5FA", "#C084FC"];
                    const comparativoTodosAnos = gerarComparativoAnual(dadosFiltrados, anosSelecionadosYoY, metricaYoY);
                    const colunasAnos = anosSelecionadosYoY.map(String);

                    return (
                      <div className="space-y-4">
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div>
                              <h3 className="text-sm font-bold text-white">Todos os anos disponíveis — {ROTULOS_METRICA_YOY[metricaYoY]}</h3>
                              <p className="text-xs text-slate-400 mt-1">Selecione ou retire anos individualmente. O gráfico respeita os filtros gerais aplicados no painel lateral.</p>
                            </div>
                            <div className="flex gap-2 text-[11px]">
                              <button type="button" onClick={() => setAnosSelecionadosYoY(anosDisponiveisYoY)} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-200 hover:bg-slate-700">Selecionar todos</button>
                              <button type="button" onClick={() => setAnosSelecionadosYoY([])} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700">Limpar seleção</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-5">
                            {anosDisponiveisYoY.map((ano, index) => (
                              <label key={ano} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2 text-xs text-slate-200 cursor-pointer hover:border-slate-500">
                                <input type="checkbox" checked={anosSelecionadosYoY.includes(ano)} onChange={(event) => setAnosSelecionadosYoY((atuais) => event.target.checked ? [...atuais, ano].sort((a, b) => b - a) : atuais.filter((item) => item !== ano))} className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500" />
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: coresAnos[index % coresAnos.length] }} />
                                <span>{ano}</span>
                              </label>
                            ))}
                          </div>
                          <div className="h-80 w-full">
                            {anosSelecionadosYoY.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={comparativoTodosAnos} margin={{ top: 10, right: 24, left: 28, bottom: 12 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                  <XAxis dataKey="mes" stroke="#94A3B8" fontSize={10} />
                                  <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(value) => metricaYoY === "faturamento" || metricaYoY === "ticket_unitario" || metricaYoY === "valor_medio_pedido" ? valorResumido(value, true) : formatarInteiro(value)} />
                                  <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(value: any, name: string) => [formatarMetricaYoY(value, metricaYoY), `${ROTULOS_METRICA_YOY[metricaYoY]} ${name}`]} />
                                  <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                                  {anosSelecionadosYoY.map((ano, index) => <Line key={ano} type="monotone" dataKey={String(ano)} stroke={coresAnos[index % coresAnos.length]} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls />)}
                                </LineChart>
                              </ResponsiveContainer>
                            ) : <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">Selecione pelo menos um ano para visualizar o gráfico.</div>}
                          </div>
                        </div>
                        {anosSelecionadosYoY.length > 0 && <DataTable exportName="comparativo_todos_os_anos" rows={comparativoTodosAnos} columns={["mes", ...colunasAnos]} />}
                      </div>
                    );
                  })()}

                  {(() => {
                    const dadosAnoBase = dadosFiltrados.filter((d) => d.ano === anoBaseYoY);
                    const dadosAnoComp = dadosFiltrados.filter((d) => d.ano === anoCompYoY);

                    let mesesConsiderados = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                    if (yoyMesesEquiv) {
                      const mBase = new Set(dadosAnoBase.map((d) => d.mes_num));
                      const mComp = new Set(dadosAnoComp.map((d) => d.mes_num));
                      mesesConsiderados = Array.from(mBase).filter((m) => mComp.has(m)).sort((a, b) => a - b);
                    }

                    const baseFiltradaM = dadosAnoBase.filter((d) => mesesConsiderados.includes(d.mes_num));
                    const compFiltradaM = dadosAnoComp.filter((d) => mesesConsiderados.includes(d.mes_num));

                    const valorBase = calcularMetricaComparativo(baseFiltradaM, metricaYoY);
                    const valorComp = calcularMetricaComparativo(compFiltradaM, metricaYoY);
                    const varAbs = valorComp - valorBase;
                    const varPct = valorBase > 0 ? varAbs / valorBase : 0;

                    const comparativoMensal = mesesConsiderados.map((m) => {
                      const fBaseM = calcularMetricaComparativo(baseFiltradaM.filter((d) => d.mes_num === m), metricaYoY);
                      const fCompM = calcularMetricaComparativo(compFiltradaM.filter((d) => d.mes_num === m), metricaYoY);
                      return {
                        mes: MESES[m] || `M${m}`,
                        [String(anoBaseYoY)]: fBaseM,
                        [String(anoCompYoY)]: fCompM,
                      };
                    });

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">{ROTULOS_METRICA_YOY[metricaYoY]} {anoBaseYoY}</span>
                            <div className="text-xl font-bold text-white mt-1">{formatarMetricaYoY(valorBase, metricaYoY)}</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">{ROTULOS_METRICA_YOY[metricaYoY]} {anoCompYoY}</span>
                            <div className="text-xl font-bold text-orange-400 mt-1">{formatarMetricaYoY(valorComp, metricaYoY)}</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Variação no Período</span>
                            <div className={`text-xl font-bold mt-1 ${varAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {formatarMetricaYoY(varAbs, metricaYoY)} ({formatarPercentual(varPct)})
                            </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Meses comparados</span>
                            <div className="text-xl font-bold text-sky-400 mt-1">{mesesConsiderados.length} meses</div>
                          </div>
                        </div>

                        {/* Gráfico comparativo de barras lado a lado */}
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                          <h3 className="text-sm font-bold text-white mb-4">
                            Evolução mensal — {ROTULOS_METRICA_YOY[metricaYoY]} — {anoBaseYoY} vs {anoCompYoY}
                          </h3>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={comparativoMensal} margin={{ top: 10, right: 30, left: 30, bottom: 42 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => metricaYoY === "faturamento" || metricaYoY === "ticket_unitario" || metricaYoY === "valor_medio_pedido" ? valorResumido(v, true) : formatarInteiro(v)} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetricaYoY(v, metricaYoY), ROTULOS_METRICA_YOY[metricaYoY]]}
                                />
                                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                                <Bar dataKey={String(anoBaseYoY)} fill={CEMAG_BLUE} radius={[4, 4, 0, 0]} />
                                <Bar dataKey={String(anoCompYoY)} fill={CEMAG_ORANGE} radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 4: MÊS X MÊS */}
              {/* ========================================================= */}
              {abaAtiva === "mes_mes" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Evolução Mês a Mês (MoM)</h2>
                      <p className="text-xs text-slate-400">
                        Escolha dois ou mais meses para comparar a evolução, a variação entre o primeiro e o último e a contribuição por dimensão.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3 text-xs">
                      <SeletorMetrica value={metricaMoM} onChange={setMetricaMoM} />
                      <div className="min-w-[280px] max-w-[560px]"><div className="mb-1 flex items-center gap-2 text-slate-400"><span>Meses para comparar ({mesesComparativoSelecionados.length})</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setMesesComparativoSelecionados(mesesDisponiveisMoM.map((mes) => mes.value))}>Selecionar todos</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setMesesComparativoSelecionados(mesesDisponiveisMoM.slice(-4).map((mes) => mes.value))}>Últimos 4</button></div><div className="flex max-h-20 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-slate-700 bg-slate-800 p-2">{mesesDisponiveisMoM.map((mes) => <label key={mes.value} className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={mesesComparativoSelecionados.includes(mes.value)} onChange={(e) => setMesesComparativoSelecionados((atuais) => e.target.checked ? [...atuais, mes.value] : atuais.filter((item) => item !== mes.value))} />{mes.label}</label>)}</div></div>
                    </div>
                  </div>

                  {mesesComparativoOrdenados.length >= 2 ? <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Mês A · {mesComparativoA}</div><div className="mt-2 text-xl font-bold text-sky-300">{formatarMetrica(linhaComparativoMoM.valorA, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">{dadosMesComparativoA.length.toLocaleString("pt-BR")} linhas</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Mês B · {mesComparativoB}</div><div className="mt-2 text-xl font-bold text-orange-300">{formatarMetrica(linhaComparativoMoM.valorB, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">{dadosMesComparativoB.length.toLocaleString("pt-BR")} linhas</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Variação absoluta</div><div className={`mt-2 text-xl font-bold ${linhaComparativoMoM.delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatarMetrica(linhaComparativoMoM.delta, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">B − A</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">Variação percentual</div><div className={`mt-2 text-xl font-bold ${linhaComparativoMoM.variacao == null || linhaComparativoMoM.variacao >= 0 ? "text-emerald-300" : "text-red-300"}`}>{linhaComparativoMoM.variacao == null ? "-" : formatarPercentual(linhaComparativoMoM.variacao)}</div><div className="mt-1 text-[11px] text-slate-500">Base: Mês A</div></div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-4">Evolução dos meses selecionados — {metricaMoM}</h3>
                      <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serieComparativoMoM} margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis dataKey="periodo" stroke="#94A3B8" fontSize={11} />
                          <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => resumirMetrica(v, metricaMoM)} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any) => [formatarMetrica(v, metricaMoM), metricaMoM]} />
                          <Bar dataKey="valor" fill={CEMAG_ORANGE} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><div className="mb-3"><h3 className="text-sm font-bold text-white">Resumo auditável dos meses selecionados</h3><p className="text-[11px] text-slate-400">A tabela mostra todos os meses escolhidos; a variação usa o primeiro e o último mês.</p></div><DataTable exportName="comparativo_mom_resumo" rows={serieComparativoMoM.map((row, index) => ({ ...row, metrica: metricaMoM, ordem: index + 1, primeiro_mes: mesComparativoA, ultimo_mes: mesComparativoB, delta_primeiro_ultimo: index === serieComparativoMoM.length - 1 ? linhaComparativoMoM.delta : null, variacao_primeiro_ultimo: index === serieComparativoMoM.length - 1 ? linhaComparativoMoM.variacao : null }))} columns={["ordem", "metrica", "periodo", "valor", "linhas", "primeiro_mes", "ultimo_mes", "delta_primeiro_ultimo", "variacao_primeiro_ultimo"]} metricColumns={{ valor: metricaMoM, delta_primeiro_ultimo: metricaMoM }} percentColumns={["variacao_primeiro_ultimo"]} /></div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{detalhesComparativoMoM.map(({ dimensao, itens }) => <div key={dimensao} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-white">Detalhamento por {dimensao}</h3><p className="text-[11px] text-slate-400">Ordenado pela maior alteração absoluta.</p></div><span className="text-[10px] text-slate-500">{itens.length} itens</span></div><DataTable exportName={`comparativo_mom_${dimensao.toLowerCase().replaceAll(" ", "_")}`} rows={itens.slice(0, 100)} columns={["item", "valor_a", "valor_b", "delta", "variacao_pct"]} metricColumns={{ valor_a: metricaMoM, valor_b: metricaMoM, delta: metricaMoM }} percentColumns={["variacao_pct"]} /></div>)}</div>
                  </> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Selecione dois meses com dados para iniciar a comparação.</div>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 5: PRODUTOS E CARRETAS */}
              {/* ========================================================= */}
              {abaAtiva === "produtos" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Produtos, Carretas e Mix de Vendas</h2>
                      <p className="text-xs text-slate-400">
                        Análise de concentração, curva de Pareto e penetração dos modelos no faturamento global.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <SeletorMetrica value={metricaProd} onChange={setMetricaProd} />
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Agrupar por:</span>
                        <select
                          value={agrupamentoProd}
                          onChange={(e) => setAgrupamentoProd(e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1"
                        >
                          <option value="produto">Produto exato</option>
                          <option value="familia">Família</option>
                          <option value="grupo_modelo">Grupo / Modelo</option>
                          <option value="categoria_produto">Categoria</option>
                          <option value="descricao_generica">Descrição Genérica</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Top:</span>
                        <select
                          value={topNProd}
                          onChange={(e) => setTopNProd(parseInt(e.target.value, 10))}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tabela e Gráfico de Produtos */}
                  {(() => {
                    const prodAgg = agregar(dadosFiltrados, [agrupamentoProd])
                      .sort((a, b) => valorMetrica(b, metricaProd) - valorMetrica(a, metricaProd))
                      .slice(0, topNProd);

                    const totalFat = dadosFiltrados.reduce((s, d) => s + valorMetrica(d, metricaProd), 0);
                    let acum = 0;
                    const prodComPareto = prodAgg.map((p) => {
                      const pct = totalFat > 0 ? valorMetrica(p, metricaProd) / totalFat : 0;
                      acum += pct;
                      return {
                        ...p,
                        participacao: pct,
                        participacao_acumulada: acum,
                      };
                    });

                    return (
                      <>
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                          <h3 className="text-sm font-bold text-white mb-4">
                            Ranking de {agrupamentoProd} por {metricaProd} - Top {topNProd}
                          </h3>
                          <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={prodComPareto.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaProd)} fontSize={10} />
                                <YAxis dataKey={agrupamentoProd} type="category" stroke="#CBD5E1" fontSize={10} width={110} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaProd), metricaProd]}
                                />
                                <Bar dataKey={campoMetrica(metricaProd)} fill={CEMAG_ORANGE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Tabela de Produtos */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-white">Detalhamento de Itens</h4>
                            <button
                              onClick={() => exportarTabelaExcel(prodComPareto, "ranking_produtos.xlsx", "Produtos")}
                              className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                              <span>Baixar Excel</span>
                            </button>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                              <thead className="bg-slate-950/80 sticky top-0 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-4">Item</th>
                                  <th className="py-2.5 px-4 text-right">{metricaProd}</th>
                                  <th className="py-2.5 px-4 text-right">Participação</th>
                                  <th className="py-2.5 px-4 text-right">Acumulado</th>
                                  <th className="py-2.5 px-4 text-right">Quantidade</th>
                                  <th className="py-2.5 px-4 text-right">Preço Médio</th>
                                  <th className="py-2.5 px-4 text-right">Pedidos</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                {prodComPareto.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-800/40">
                                    <td className="py-2 px-4 font-sans font-medium text-white truncate max-w-xs">
                                      {(item as any)[agrupamentoProd]}
                                    </td>
                                    <td className="py-2 px-4 text-right font-bold text-orange-400">
                                      {formatarMoeda(item.faturamento)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-slate-300">
                                      {formatarPercentual(item.participacao)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-sky-400">
                                      {formatarPercentual(item.participacao_acumulada)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-slate-300">
                                      {formatarInteiro(item.quantidade)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-slate-300">
                                      {formatarMoeda(item.ticket_unitario_calc)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-slate-400">
                                      {formatarInteiro(item.pedidos)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 6: CLIENTES */}
              {/* ========================================================= */}
              {abaAtiva === "clientes" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Clientes & Gestão de Carteira</h2>
                      <p className="text-xs text-slate-400">
                        Curva ABC, retenção comercial, dias sem compra e classificação de risco da carteira.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <SeletorMetrica value={metricaCli} onChange={setMetricaCli} />
                      <div className="flex items-center gap-2">
                      <span className="text-slate-400">Visão:</span>
                      <select
                        value={agrupCliente}
                        onChange={(e) => setAgrupCliente(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1"
                      >
                        <option value="cliente">Cliente completo</option>
                        <option value="cliente_base">Cliente base unificado</option>
                      </select>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const abc = curvaAbc(dadosFiltrados, agrupCliente, campoMetrica(metricaCli));
                    const carteira = classificarCarteiraClientes(dadosFiltrados).sort((a, b) => valorMetrica(b, metricaCli) - valorMetrica(a, metricaCli));

                    const qtdA = abc.filter((c) => c.classe_abc === "A").length;
                    const qtdB = abc.filter((c) => c.classe_abc === "B").length;
                    const qtdC = abc.filter((c) => c.classe_abc === "C").length;

                    const statusAtivo = carteira.filter((c) => c.status === "Recorrente" || c.status === "Novo").length;
                    const statusAtencao = carteira.filter((c) => c.status === "Em atenção").length;
                    const statusInativo = carteira.filter((c) => c.status === "Inativo").length;

                    return (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Clientes Classe A (80%)</span>
                            <div className="text-xl font-bold text-orange-400 mt-1">{qtdA} clientes</div>
                            <span className="text-[10px] text-slate-500">Classe A por {metricaCli}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Clientes em Atenção</span>
                            <div className="text-xl font-bold text-amber-400 mt-1">{statusAtencao} clientes</div>
                            <span className="text-[10px] text-slate-500">Gaps de compra acima da média</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Clientes Inativos</span>
                            <div className="text-xl font-bold text-red-400 mt-1">{statusInativo} clientes</div>
                            <span className="text-[10px] text-slate-500">Mais de 90 dias sem comprar</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Concentração Top 10</span>
                            <div className="text-xl font-bold text-sky-400 mt-1">
                              {formatarPercentual(
                                abc.slice(0, 10).reduce((s, c) => s + valorMetrica(c, metricaCli), 0) /
                                  (valorMetrica(kpis, metricaCli) || 1)
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">Parcela dos 10 maiores</span>
                          </div>
                        </div>

                        {/* Tabela da Carteira de Clientes */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-white">Carteira de Clientes e RFM</h4>
                            <button
                              onClick={() => exportarTabelaExcel(carteira, "carteira_clientes.xlsx", "Clientes")}
                              className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                              <span>Baixar Excel</span>
                            </button>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                              <thead className="bg-slate-950/80 sticky top-0 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-4">Cliente</th>
                                  <th className="py-2.5 px-4">UF</th>
                                  <th className="py-2.5 px-4">Representante</th>
                                  <th className="py-2.5 px-4 text-right">{metricaCli}</th>
                                  <th className="py-2.5 px-4 text-right">Pedidos</th>
                                  <th className="py-2.5 px-4 text-right">Última Compra</th>
                                  <th className="py-2.5 px-4 text-right">Dias sem Comprar</th>
                                  <th className="py-2.5 px-4 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                {carteira.slice(0, 50).map((c, idx) => (
                                  <tr key={idx} className="hover:bg-slate-800/40">
                                    <td className="py-2 px-4 font-sans font-medium text-white truncate max-w-xs">{c.cliente}</td>
                                    <td className="py-2 px-4 text-slate-300">{c.uf}</td>
                                    <td className="py-2 px-4 text-slate-300">{c.representante}</td>
                                    <td className="py-2 px-4 text-right font-bold text-orange-400">{formatarMetrica(valorMetrica(c, metricaCli), metricaCli)}</td>
                                    <td className="py-2 px-4 text-right text-slate-300">{c.pedidos}</td>
                                    <td className="py-2 px-4 text-right text-slate-300">{c.ultima_compra}</td>
                                    <td className="py-2 px-4 text-right text-slate-300 font-bold">{c.dias_sem_compra} d</td>
                                    <td className="py-2 px-4 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          c.status === "Inativo"
                                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                            : c.status === "Em atenção"
                                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "bg-green-500/20 text-green-400 border border-green-500/30"
                                        }`}
                                      >
                                        {c.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 7: INTELIGÊNCIA COMERCIAL */}
              {/* ========================================================= */}
              {abaAtiva === "inteligencia" && (
                <div className="space-y-6">
                  {/* Seletor de Sub-Áreas */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    {[
                      { id: "comparador", label: "📊 Comparador & O que mudou" },
                      { id: "carteira_risco", label: "👥 Carteira & risco" },
                      { id: "abc", label: "📈 ABC, Pareto & concentração" },
                      { id: "mix", label: "🧩 Mix & venda cruzada" },
                      { id: "preco_dre", label: "💵 Preço, margem & DRE" },
                      { id: "calendario", label: "🗓️ Calendário & ritmo" },
                      { id: "rep_alertas", label: "🤝 Representantes & alertas" },
                      { id: "fechamento", label: "📌 Fechamento mensal" },
                    ].map((sub) => (
                      <button key={sub.id} onClick={() => setSubInteligencia(sub.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${subInteligencia === sub.id ? "bg-orange-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {subInteligencia === "comparador" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-base font-bold text-white">Comparador livre de períodos</h3><p className="text-xs text-slate-400">Explique a variação por cliente, família, produto, representante, região ou UF.</p></div>
                        <div className="flex items-center gap-2 text-xs"><span className="text-slate-400">Dimensão:</span><select value={intelCompDim} onChange={(e) => setIntelCompDim(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option value="cliente">Cliente</option><option value="familia">Família</option><option value="produto">Produto/carreta</option><option value="representante">Representante</option><option value="regiao">Região</option><option value="uf">UF</option></select></div>
                      </div>
                      {(() => { const sorted=[...dadosFiltrados].sort((a,b)=>a.data_emissao.getTime()-b.data_emissao.getTime()); const split=sorted[Math.floor(sorted.length/2)]?.data_emissao || new Date(); const ini=sorted[0]?.data_emissao || new Date(); const fim=sorted[sorted.length-1]?.data_emissao || new Date(); const r=compararPeriodos(sorted,ini,split,split,fim,intelCompDim,"faturamento"); return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Período A",r.resumo.valor_a], ["Período B",r.resumo.valor_b], ["Variação absoluta",r.resumo.variacao_abs], ["Variação %",r.resumo.variacao_pct]].map(([label,value]:any)=><div key={label} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{label}</span><div className={`text-base font-bold mt-1 ${label === "Variação %" || label === "Variação absoluta" ? (value >= 0 ? "text-green-400" : "text-red-400") : "text-white"}`}>{label === "Variação %" ? formatarPercentual(value) : formatarMoeda(value)}</div></div>)}</div><DataTable rows={r.detalhe} columns={[intelCompDim,"valor_a","valor_b","variacao_abs","variacao_pct","contribuicao_variacao"]} /></div>; })()}
                    </div>
                  )}

                  {subInteligencia === "carteira_risco" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div><h3 className="text-base font-bold text-white">Carteira & risco</h3><p className="text-xs text-slate-400">Status histórico por recência, frequência e faturamento relevante.</p></div>
                      {(() => { const c=classificarCarteiraClientes(dadosFiltrados); const cont=Object.fromEntries(["Novo","Recuperado","Recorrente","Compra única","Em atenção","Inativo"].map(x=>[x,c.filter(y=>y.status===x).length])); return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Ativos",c.filter(x=>!['Em atenção','Inativo'].includes(x.status)).length],['Em atenção',cont['Em atenção']],['Inativos',cont.Inativo],['Recuperados',cont.Recuperado]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-xl font-bold text-orange-400">{v}</div></div>)}</div><DataTable rows={c.filter(x=>['Em atenção','Inativo'].includes(x.status))} columns={["cliente","representante","uf","faturamento","pedidos","dias_sem_compra","status"]} /></>; })()}
                    </div>
                  )}

                  {subInteligencia === "abc" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-white">ABC, Pareto & concentração</h3><p className="text-xs text-slate-400">Curva 80/95% e participação dos Top 5, 10 e 20.</p></div><div className="flex gap-2 text-xs"><select id="abcDim" className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option value="cliente">Clientes</option><option value="produto">Produtos</option><option value="familia">Famílias</option><option value="representante">Representantes</option></select></div></div>
                      {(() => { const abc=curvaAbc(dadosFiltrados,"cliente","faturamento"); const conc=concentracaoTop(abc,"faturamento"); return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Classe A",abc.filter(x=>x.classe_abc==='A').length],["Top 5",conc.top_5],["Top 10",conc.top_10],["Top 20",conc.top_20]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-xl font-bold text-orange-400">{l==='Classe A'?v:formatarPercentual(v)}</div></div>)}</div><DataTable rows={abc} columns={["cliente","faturamento","participacao","participacao_acumulada","classe_abc"]} /></>; })()}
                    </div>
                  )}

                  {subInteligencia === "mix" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <h3 className="text-base font-bold text-white">Mix & venda cruzada</h3><p className="text-xs text-slate-400">Amplitude do mix, oportunidades ainda não compradas e pares no mesmo pedido.</p>
                      {(() => { const mix=mixClientes(dadosFiltrados); const cliente=mix[0]?.cliente || ""; const opp=oportunidadesCrossSell(dadosFiltrados,cliente,"familia",15); const pares=paresCompradosJuntos(dadosFiltrados,"familia",20); return <><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Famílias médias por cliente</span><div className="text-xl font-bold text-orange-400">{(mix.reduce((s,x)=>s+x.familias,0)/Math.max(mix.length,1)).toFixed(1).replace('.',',')}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Clientes com 1 família</span><div className="text-xl font-bold text-sky-400">{mix.filter(x=>x.familias===1).length}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Oportunidades do líder</span><div className="text-xl font-bold text-green-400">{opp.length}</div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={opp} columns={["item","clientes_compradores","penetracao_clientes","faturamento_global"]} /><DataTable rows={pares} columns={["item_a","item_b","pedidos_juntos","clientes_juntos"]} /></div></>; })()}
                    </div>
                  )}

                  {subInteligencia === "preco_dre" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <h3 className="text-base font-bold text-white">Preço, margem & DRE aproximada</h3>
                      {(() => { const dre=dreAproximada(dadosFiltrados)[0] || {}; const precos=precoMedioPorItem(dadosFiltrados,"produto"); const desvios=desviosPreco(dadosFiltrados,"produto","cliente",0.15); return <><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["Faturamento",dre.faturamento],["Receita líquida",dre.receita_liquida_aprox],["Custo",dre.custo],["Resultado",dre.resultado_aprox],["Margem",dre.margem_aprox_pct]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-base font-bold text-orange-400">{l==='Margem'?formatarPercentual(v):formatarMoeda(v)}</div></div>)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={precos} columns={["produto","preco_medio","quantidade","faturamento","clientes","pedidos"]} /><DataTable rows={desvios} columns={["produto","cliente","preco_medio_grupo","preco_medio_item","desvio_pct"]} /></div></>; })()}
                    </div>
                  )}

                  {subInteligencia === "calendario" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">Calendário & ritmo</h3><p className="text-xs text-slate-400">Resumo diário, dias úteis, média diária e melhores dias do período.</p>{(() => { const diario=resumoDiarioInteligencia(dadosFiltrados); const media=diario.length?diario.reduce((s,x)=>s+x.faturamento,0)/diario.length:0; const melhor=[...diario].sort((a,b)=>b.faturamento-a.faturamento)[0]; return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento médio/dia</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(media)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Dias com movimento</span><div className="text-xl font-bold text-sky-400">{diario.length}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Melhor dia</span><div className="text-xl font-bold text-green-400">{melhor?.data || '-'}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento do melhor dia</span><div className="text-xl font-bold text-green-400">{formatarMoeda(melhor?.faturamento || 0)}</div></div></div><DataTable rows={diario} columns={["data","dia_semana","faturamento","quantidade","pedidos","clientes"]} /></>; })()}</div>
                  )}

                  {subInteligencia === "rep_alertas" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">Representantes & alertas</h3>{(() => { const cart=classificarCarteiraClientes(dadosFiltrados); const reps=painelRepresentantesInteligencia(dadosFiltrados,cart); const alertas=gerarAlertasComerciais(dadosFiltrados); return <><DataTable rows={reps} columns={["representante","faturamento","pedidos","clientes","clientes_ativos","clientes_atencao","clientes_inativos","concentracao_top5_clientes"]} /><DataTable rows={alertas} columns={["nivel","tipo","mensagem","valor","referencia"]} /></>; })()}</div>
                  )}

                  {subInteligencia === "fechamento" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">Fechamento mensal automático</h3>{(() => { const p=dadosMensais[dadosMensais.length-1]?.ano_mes || ""; const [ano,mes]=p ? p.split('-').map(Number) : [new Date().getFullYear(),new Date().getMonth()+1]; const f=fechamentoMensalInteligencia(dadosFiltrados,ano,mes); const r=f.resumo as any; return <><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["Faturamento",r.faturamento||0],["Quantidade",r.quantidade||0],["Pedidos",r.pedidos||0],["Clientes",r.clientes||0],["Ticket",r.ticket_unitario||0]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-base font-bold text-orange-400">{['Faturamento','Ticket'].includes(l)?formatarMoeda(v):formatarInteiro(v)}</div></div>)}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Novos",f.movimentos.novos.length],["Recorrentes",f.movimentos.recorrentes.length],["Recuperados",f.movimentos.recuperados.length],["Perdidos",f.movimentos.perdidos.length]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Clientes {l}</span><div className="text-xl font-bold text-sky-400">{v}</div></div>)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={f.top_clientes} columns={["cliente","faturamento","pedidos","clientes"]} /><DataTable rows={f.top_produtos} columns={["produto","faturamento","quantidade","pedidos"]} /></div></>; })()}</div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 8: REGIÕES */}
              {/* ========================================================= */}
              {abaAtiva === "regioes" && (
                <div className="space-y-6">
                  <div className="flex justify-end"><SeletorMetrica value={metricaGeo} onChange={setMetricaGeo} /></div>
                  {/* Mapa do Brasil */}
                  <MapBrasil dadosUf={dadosPorUf} onSelectUf={setUfMapaSelecionada} />
                  <MapMunicipios dadosMunicipios={dadosMunicipios} selectedUf={ufMapaSelecionada} onClearSelection={() => setUfMapaSelecionada(null)} />

                  {/* Gráficos Regionais */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Faturamento por Macrorregião */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">{metricaGeo} por Macrorregião</h3>
                      {(() => {
                        const regAgg = agregar(
                          dadosFiltrados.filter((d) => d.regiao !== "Não identificado"),
                          ["regiao"]
                        ).sort((a, b) => valorMetrica(b, metricaGeo) - valorMetrica(a, metricaGeo));

                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={regAgg} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="regiao" stroke="#CBD5E1" fontSize={11} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => resumirMetrica(v, metricaGeo)} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaGeo), metricaGeo]}
                                />
                                <Bar dataKey={campoMetrica(metricaGeo)} fill={CEMAG_BLUE} radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Top Cidades */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">Top 8 Cidades por {metricaGeo}</h3>
                      {(() => {
                        const cidAgg = agregar(
                          dadosFiltrados.filter((d) => d.cidade !== "Não identificado"),
                          ["cidade", "uf"]
                        )
                          .sort((a, b) => valorMetrica(b, metricaGeo) - valorMetrica(a, metricaGeo))
                          .slice(0, 8);

                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={cidAgg} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaGeo)} fontSize={10} />
                                <YAxis dataKey="cidade" type="category" stroke="#CBD5E1" fontSize={10} width={90} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaGeo), metricaGeo]}
                                />
                                <Bar dataKey={campoMetrica(metricaGeo)} fill={CEMAG_ORANGE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 9: REPRESENTANTES */}
              {/* ========================================================= */}
              {abaAtiva === "representantes" && (
                <div className="space-y-6">
                  <div className="flex justify-end"><SeletorMetrica value={metricaRep} onChange={setMetricaRep} /></div>
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Representantes Comerciais</h2>
                      <p className="text-xs text-slate-400">
                        Desempenho por vendedor, evolução de vendas e carteira por região.
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const repAgg = agregar(dadosFiltrados, ["representante"]).sort((a, b) => valorMetrica(b, metricaRep) - valorMetrica(a, metricaRep));

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Ranking de Representantes */}
                          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                            <h3 className="text-sm font-bold text-white mb-3">{metricaRep} por Representante</h3>
                            <div className="h-72 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={repAgg} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                  <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaRep)} fontSize={10} />
                                  <YAxis dataKey="representante" type="category" stroke="#CBD5E1" fontSize={11} width={90} />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                    formatter={(v: any) => [formatarMetrica(v, metricaRep), metricaRep]}
                                  />
                                  <Bar dataKey={campoMetrica(metricaRep)} fill={CEMAG_ORANGE} radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Tabela de Representantes */}
                          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden p-4">
                            <h3 className="text-sm font-bold text-white mb-3">Detalhamento da Força de Vendas</h3>
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-xs text-left text-slate-300">
                                <thead className="bg-slate-950 uppercase text-[10px] text-slate-400">
                                  <tr>
                                    <th className="p-2">Representante</th>
                                    <th className="p-2 text-right">{metricaRep}</th>
                                    <th className="p-2 text-right">Qtd</th>
                                    <th className="p-2 text-right">Pedidos</th>
                                    <th className="p-2 text-right">Ticket</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                  {repAgg.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/40">
                                      <td className="p-2 font-sans font-medium text-white">{r.representante}</td>
                                      <td className="p-2 text-right font-bold text-orange-400">{formatarMetrica(valorMetrica(r, metricaRep), metricaRep)}</td>
                                      <td className="p-2 text-right">{formatarInteiro(r.quantidade)}</td>
                                      <td className="p-2 text-right text-slate-400">{r.pedidos}</td>
                                      <td className="p-2 text-right text-sky-400">{formatarMoeda(r.ticket_unitario_calc)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 10: TIPOS E CATEGORIAS */}
              {/* ========================================================= */}
              {abaAtiva === "tipos" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-end mb-3"><SeletorMetrica value={metricaVisao} onChange={setMetricaVisao} /></div>
                    <h2 className="text-lg font-bold text-white">Formas de Venda e Categorias de Produtos</h2>
                    <p className="text-xs text-slate-400">
                      Mix por natureza de operação e distribuição de faturamento por recurso.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Formas de Venda */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">{metricaVisao} por Forma de Venda</h3>
                      {(() => {
                        const tiposAgg = agregar(dadosFiltrados, ["tipo_venda"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao));
                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={tiposAgg} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaVisao)} fontSize={10} />
                                <YAxis dataKey="tipo_venda" type="category" stroke="#CBD5E1" fontSize={10} width={130} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaVisao), metricaVisao]}
                                />
                                <Bar dataKey={campoMetrica(metricaVisao)} fill={CEMAG_ORANGE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Categorias */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">{metricaVisao} por Categoria de Produto</h3>
                      {(() => {
                        const catAgg = agregar(dadosFiltrados, ["categoria_produto"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao));
                        return (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={catAgg} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => resumirMetrica(v, metricaVisao)} fontSize={10} />
                                <YAxis dataKey="categoria_produto" type="category" stroke="#CBD5E1" fontSize={10} width={100} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }}
                                  formatter={(v: any) => [formatarMetrica(v, metricaVisao), metricaVisao]}
                                />
                                <Bar dataKey={campoMetrica(metricaVisao)} fill={CEMAG_BLUE} radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: PREVISÕES */}
              {/* ========================================================= */}
              {abaAtiva === "previsoes" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-orange-900/70 bg-orange-950/20 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><h2 className="text-lg font-bold text-white">Parâmetros exclusivos da previsão</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">Esses controles alteram somente a previsão. Os filtros gerais continuam definindo a carteira comercial, mas o período abaixo é independente do período da barra lateral.</p></div>
                      <button type="button" onClick={() => { setPrevisaoDataInicio(meta?.data_min ? (meta.data_min.toISOString().slice(0, 10) > "2022-01-01" ? meta.data_min.toISOString().slice(0, 10) : "2022-01-01") : "2022-01-01"); setPrevisaoDataFim(meta?.data_max?.toISOString().slice(0, 10) || ""); setIncluirMesVigentePrevisao(true); setMetricaPrevisao("Faturamento"); setHorizontePrevisao(6); }} className="rounded-lg border border-orange-700/70 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10">Restaurar padrão</button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Data inicial do histórico</span><input type="date" value={previsaoDataInicio} onChange={(e) => setPrevisaoDataInicio(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] leading-4 text-slate-500">Primeiro dia usado para treinar o modelo.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Data final do histórico</span><input type="date" value={previsaoDataFim} onChange={(e) => setPrevisaoDataFim(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] leading-4 text-slate-500">Último dia considerado antes da projeção.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">O que projetar</span><select value={metricaPrevisao} onChange={(e) => setMetricaPrevisao(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">{METRICAS_PAINEL.map((metrica) => <option key={metrica} value={metrica}>{metrica}</option>)}</select><span className="text-[10px] leading-4 text-slate-500">Escolha faturamento, quantidade, pedidos ou clientes.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Meses à frente</span><select value={horizontePrevisao} onChange={(e) => setHorizontePrevisao(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select><span className="text-[10px] leading-4 text-slate-500">Quantidade de meses futuros após o último mês do histórico.</span></label>
                      <label className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300"><input type="checkbox" checked={incluirMesVigentePrevisao} onChange={(e) => setIncluirMesVigentePrevisao(e.target.checked)} className="mt-0.5 accent-orange-500" /><span><strong className="block text-white">Incluir mês vigente</strong><span className="mt-1 block text-[10px] leading-4 text-slate-500">Ligado: estima o fechamento do mês atual mesmo incompleto. Desligado: usa somente meses até a data final.</span></span></label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 text-[11px] leading-5"><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-orange-300">Histórico</strong><p className="text-slate-400">São necessários pelo menos 6 meses com registros. Até 24 meses recentes pesam mais na tendência.</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-sky-300">Retroativo</strong><p className="text-slate-400">Meses passados são recalculados usando apenas os meses anteriores, para medir o erro do modelo.</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-emerald-300">Futuro</strong><p className="text-slate-400">A previsão combina tendência linear e sazonalidade do mesmo mês em anos anteriores.</p></div></div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><h3 className="text-sm font-bold text-white">Fatores externos: histórico e futuro</h3><p className="text-xs text-slate-400 mt-1">Cruza a métrica selecionada com chuva e Selic históricas e também mostra previsões futuras. Associação não prova causalidade.</p></div>
                      <div className="flex flex-wrap items-end gap-3 text-xs text-slate-300">
                        <label className="flex flex-col gap-1">Abrangência<select value={abrangenciaFatores} onChange={(e) => setAbrangenciaFatores(e.target.value)} className="min-w-[190px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"><option value="cidade">Município individual</option><option value="clientes">Cidades dos clientes</option><option value="uf">Estados selecionados</option><option value="regiao">Região</option><option value="brasil">Todo o Brasil</option></select></label>
                        {abrangenciaFatores === "cidade" && <label className="flex flex-col gap-1">Município<select value={cidadeFatoresExternos} onChange={(e) => setCidadeFatoresExternos(e.target.value)} className="min-w-[190px] max-w-[240px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"><option value="">Selecione</option>{cidadesFatoresExternos.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}</select></label>}
                        {abrangenciaFatores === "regiao" && <label className="flex flex-col gap-1">Região<select value={regiaoFatores} onChange={(e) => setRegiaoFatores(e.target.value)} className="min-w-[150px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5">{REGIOES_BRASIL.map((regiao) => <option key={regiao} value={regiao}>{regiao}</option>)}</select></label>}
                        {abrangenciaFatores === "uf" && <div className="max-w-[360px]"><div className="mb-1 flex items-center gap-2"><span>Estados</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setUfsFatores(opcoesFiltros.ufs)}>Selecionar todos</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setUfsFatores([])}>Limpar</button></div><div className="flex max-h-20 flex-wrap gap-x-2 gap-y-1 overflow-y-auto">{opcoesFiltros.ufs.map((uf) => <label key={uf} className="flex items-center gap-1"><input type="checkbox" checked={ufsFatores.includes(uf)} onChange={(e) => setUfsFatores((atuais) => e.target.checked ? [...atuais, uf] : atuais.filter((item) => item !== uf))} />{uf}</label>)}</div></div>}
                        {abrangenciaFatores === "clientes" && <div className="max-w-[420px]"><div className="mb-1 flex items-center gap-2"><span>Cidades dos clientes</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setCidadesSelecionadasFatores(cidadesClientesFatores.slice(0, 40).map((item) => `${item.cidade}|${item.uf}`))}>Selecionar até 40</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setCidadesSelecionadasFatores([])}>Limpar</button></div><div className="flex max-h-20 flex-wrap gap-x-2 gap-y-1 overflow-y-auto">{cidadesClientesFatores.slice(0, 40).map((item) => { const key = `${item.cidade}|${item.uf}`; return <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={cidadesSelecionadasFatores.includes(key)} onChange={(e) => setCidadesSelecionadasFatores((atuais) => e.target.checked ? [...atuais, key].slice(0, 40) : atuais.filter((value) => value !== key))} />{item.cidade}/{item.uf}</label>; })}</div></div>}
                      </div>
                    </div>
                    {fatoresExternosQuery.isFetching && <p className="mt-3 text-xs text-sky-300">Consultando fontes oficiais e meteorológicas...</p>}
                    {fatoresExternosQuery.error && <p className="mt-3 text-xs text-amber-300">Não foi possível consultar os fatores externos agora. A previsão histórica continua disponível.</p>}
                    {fatoresExternosQuery.data?.avisos.map((aviso) => <p key={aviso} className="mt-2 text-xs text-amber-300">{aviso}</p>)}
                    {serieFatoresExternos.length > 0 && <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={serieFatoresExternos} margin={{ top: 10, right: 24, left: 20, bottom: 34 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(serieFatoresExternos.length)} angle={serieFatoresExternos.length > 18 ? -28 : -18} textAnchor="end" height={serieFatoresExternos.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis yAxisId="vendas" stroke={CEMAG_BLUE} fontSize={10} tickFormatter={(v) => formatarMetrica(v, metricaPrevisao)} /><YAxis yAxisId="fatores" orientation="right" stroke="#34D399" fontSize={10} tickFormatter={(v) => `${Number(v).toFixed(0)}`} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(value: any, name: any) => name === "Chuva (mm)" ? [`${Number(value).toFixed(1)} mm`, name] : name === "Selic média" ? [`${Number(value).toFixed(2)}%`, name] : [formatarMetrica(value, metricaPrevisao), metricaPrevisao]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} /><Line yAxisId="vendas" type="monotone" dataKey="vendas" name={metricaPrevisao} stroke={CEMAG_BLUE} strokeWidth={2.5} dot={false} connectNulls={false} /><Line yAxisId="fatores" type="monotone" dataKey="chuva_mm" name="Chuva (mm)" stroke="#34D399" strokeWidth={1.8} dot={false} connectNulls={false} /><Line yAxisId="fatores" type="monotone" dataKey="selic_media_pct" name="Selic média" stroke="#FBBF24" strokeWidth={1.8} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 space-y-3"><DataTable rows={fatoresExternosQuery.data.meses} exportName="fatores_externos_mensais" columns={["ano_mes", "selic_media_pct", "chuva_mm"]} percentColumns={[]} /><div className="text-[10px] leading-5 text-slate-500">Referência geográfica: {fatoresExternosQuery.data.localidade || cidadeFatoresExternos}{fatoresExternosQuery.data.latitude != null ? ` (${fatoresExternosQuery.data.latitude.toFixed(3)}, ${fatoresExternosQuery.data.longitude?.toFixed(3)})` : ""}. Fontes: {fatoresExternosQuery.data.fontes.join("; ") || "nenhuma resposta disponível"}.</div></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-orange-900/60 bg-orange-950/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-orange-300">Indicadores agrícolas consumidos automaticamente</h4><p className="mt-1 text-[11px] text-slate-400">Dados de contexto para avaliar capacidade de investimento e atividade agrícola. Eles não alteram a previsão principal sem validação histórica.</p></div><span className="text-[10px] text-slate-500">IBGE {fatoresExternosQuery.data.indicadores_agro.ano_referencia || "-"}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">PTAX média</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.ptax_media_brl == null ? "-" : `R$ ${fatoresExternosQuery.data.indicadores_agro.ptax_media_brl.toFixed(2)}`}</div><div className="text-[10px] text-slate-500">BCB · período consultado</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">Produção de café</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_producao_t == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_producao_t.toLocaleString("pt-BR")} t`}</div><div className="text-[10px] text-slate-500">IBGE · último ano disponível</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">Área colhida de café</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha.toLocaleString("pt-BR")} ha`}</div><div className="text-[10px] text-slate-500">IBGE · PAM</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">Crédito de investimento</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl == null ? "-" : `R$ ${fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl.toLocaleString("pt-BR")}`}</div><div className="text-[10px] text-slate-500">SICOR/MDCR · {fatoresExternosQuery.data.indicadores_agro.credito_status === "indisponivel" ? "indisponível" : fatoresExternosQuery.data.indicadores_agro.credito_status === "consultado" ? "consultado" : "aguardando escopo"}</div></div></div></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-violet-900/60 bg-violet-950/20 p-4"><h4 className="text-sm font-semibold text-violet-300">Preços agrícolas de mercado</h4><p className="mt-1 text-[11px] text-slate-400">Contratos futuros internacionais em USD, usados como sinal de mercado e não como preço de venda nacional.</p><DataTable rows={fatoresExternosQuery.data.indicadores_agro.precos_agro} exportName="precos_agricolas_mercado" columns={["produto", "ticker", "valor_usd", "atualizado_em"]} /></div>}
                    {fatoresExternosQuery.data && <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4"><h4 className="text-sm font-semibold text-emerald-300">Previsão de chuva — próximos {previsaoChuvaFutura.length || 16} dias</h4><p className="mt-1 text-[11px] text-slate-400">Previsão meteorológica diária do Open-Meteo. Não é usada para inventar meses além do horizonte meteorológico disponível.</p><DataTable rows={previsaoChuvaFutura} exportName="previsao_chuva_futura" columns={["data", "chuva_mm", "probabilidade_chuva_pct"]} percentColumns={["probabilidade_chuva_pct"]} /></div>
                      <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4"><h4 className="text-sm font-semibold text-amber-300">Expectativa de Selic — Boletim Focus</h4><p className="mt-1 text-[11px] text-slate-400">Medianas/médias de mercado por reunião futura. São expectativas do mercado, não uma decisão garantida do Banco Central.</p><DataTable rows={expectativasSelicFuturas} exportName="expectativas_selic_focus" columns={["data_consulta", "reuniao", "media_pct", "mediana_pct", "respondentes"]} percentColumns={[]} /></div>
                    </div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/20 p-4"><h4 className="text-sm font-semibold text-sky-300">Previsão climática sazonal — próximos trimestres</h4><p className="mt-1 text-[11px] text-slate-400">CPTEC/INPE BAM-1.2. É uma previsão probabilística regional de três meses, não uma promessa de chuva exata no município.</p><DataTable rows={previsaoSazonal} exportName="previsao_sazonal_cptec" columns={["modelo", "temporada", "periodo", "chuva_total_mm", "sinal_tercil", "valor_sinal", "atualizado_em"]} /></div>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Métrica</div><div className="text-sm font-semibold text-orange-300 mt-2">{metricaPrevisao}</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Meses históricos</div><div className="text-xl font-bold text-white mt-2">{previsaoMensal.historicoMeses}</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Horizonte</div><div className="text-xl font-bold text-orange-300 mt-2">{horizontePrevisao} meses</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Cenários</div><div className="text-sm font-semibold text-sky-300 mt-2">Conservador · Provável · Otimista</div><div className="text-[10px] text-slate-500 mt-1">Faixa pelo erro histórico</div></div><div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Validação histórica</div><div className="text-xl font-bold text-emerald-300 mt-2">{validacaoPrevisao.mape == null ? "-" : `${validacaoPrevisao.mape.toFixed(1)}%`}</div><div className="text-[10px] text-slate-500 mt-1">MAPE em {validacaoPrevisao.pontos} mês(es) testado(s)</div></div><div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Erro médio absoluto</div><div className="text-xl font-bold text-sky-300 mt-2">{validacaoPrevisao.mae == null ? "-" : formatarMetrica(validacaoPrevisao.mae, metricaPrevisao)}</div><div className="text-[10px] text-slate-500 mt-1">Diferença média entre previsto e realizado</div></div>
                  </div>
                  {previsaoMensal.serie.length ? <>
                    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-2">Histórico e próximos {horizontePrevisao} meses — {metricaPrevisao}</h3>
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px]"><span className="mr-1 text-slate-500">Exibir:</span>{Object.entries(ROTULOS_SERIE_PREVISAO).map(([chave, rotulo]) => <label key={chave} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 transition ${seriesPrevisaoVisiveis[chave] ? "border-orange-500/60 bg-orange-500/10 text-orange-200" : "border-slate-700 bg-slate-950/40 text-slate-500"}`}><input type="checkbox" className="accent-orange-500" checked={seriesPrevisaoVisiveis[chave] ?? false} onChange={(event) => setSeriesPrevisaoVisiveis((atuais) => ({ ...atuais, [chave]: event.target.checked }))} />{rotulo}</label>)}</div>
                      {ultimoMesParcial && <p className="mb-3 text-[11px] text-amber-300">Mês vigente incluído: {ultimoMesParcial.ano_mes}. Realizado parcial: {formatarMetrica(ultimoMesParcial.parcial || 0, metricaPrevisao)} em {ultimoMesParcial.dias_decorridos || 0}/{ultimoMesParcial.dias_periodo || 0} dias. Fechamento estimado pelo ritmo diário: {formatarMetrica(ultimoMesParcial.fechamento || 0, metricaPrevisao)}{ultimoMesParcial.referencia_historica_mes != null ? ` · média do mesmo mês em anos anteriores: ${formatarMetrica(ultimoMesParcial.referencia_historica_mes, metricaPrevisao)}` : ""}. Os meses seguintes usam tendência e sazonalidade.</p>}
                      <div className="mx-auto h-80 w-full max-w-[1500px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={previsaoMensal.serie} margin={{ top: 10, right: 20, left: 20, bottom: 34 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(previsaoMensal.serie.length)} angle={previsaoMensal.serie.length > 18 ? -28 : -18} textAnchor="end" height={previsaoMensal.serie.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => formatarMetrica(v, metricaPrevisao)} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any, name: any) => [formatarMetrica(v, metricaPrevisao), rotuloSeriePrevisao(name)]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />{seriesPrevisaoVisiveis.realizado && <Line type="monotone" dataKey="realizado" name="Realizado" stroke={CEMAG_BLUE} strokeWidth={2.5} dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.previsao_retroativa && <Line type="monotone" dataKey="previsao_retroativa" name="Provável retroativo" stroke="#A78BFA" strokeWidth={1.8} strokeDasharray="2 3" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.conservador_retroativo && <Line type="monotone" dataKey="conservador_retroativo" name="Conservador retroativo" stroke="#F87171" strokeWidth={1.2} strokeDasharray="2 4" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.otimista_retroativo && <Line type="monotone" dataKey="otimista_retroativo" name="Otimista retroativo" stroke="#34D399" strokeWidth={1.2} strokeDasharray="2 4" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.previsao && <Line type="monotone" dataKey="previsao" name="Provável / fechamento" stroke={CEMAG_ORANGE} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />}{seriesPrevisaoVisiveis.conservador && <Line type="monotone" dataKey="conservador" name="Conservador" stroke="#F87171" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.otimista && <Line type="monotone" dataKey="otimista" name="Otimista" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />}</LineChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-2">Explicação de cada previsão — {metricaPrevisao}</h3><p className="text-xs text-slate-400 mb-3">O cenário <strong className="text-orange-300">Provável</strong> é a estimativa principal do modelo. O <strong className="text-red-300">Conservador</strong> reduz esse valor e o <strong className="text-emerald-300">Otimista</strong> aumenta esse valor usando uma margem baseada no erro histórico.</p><DataTable rows={explicacaoPrevisoes} exportName="explicacao_previsoes" columns={["mes", "metrica", "conservador", "provavel", "otimista", "margem_pct", "explicacao"]} percentColumns={["margem_pct"]} metricColumns={{ conservador: metricaPrevisao, provavel: metricaPrevisao, otimista: metricaPrevisao }} /></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-3">Valores previstos e retroativos — {metricaPrevisao}</h3><DataTable rows={previsaoMensal.serie.filter((x) => x.previsao != null || x.previsao_retroativa != null)} columns={["ano_mes", "realizado", "conservador_retroativo", "previsao_retroativa", "otimista_retroativo", "erro_retroativo", "conservador", "previsao", "otimista", "tipo"]} percentColumns={["erro_retroativo"]} metricColumns={{ realizado: metricaPrevisao, conservador_retroativo: metricaPrevisao, previsao_retroativa: metricaPrevisao, otimista_retroativo: metricaPrevisao, conservador: metricaPrevisao, previsao: metricaPrevisao, otimista: metricaPrevisao }} /></div>
                  </> : <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-5 text-sm">Histórico insuficiente após os filtros atuais. São necessários pelo menos seis meses com registros.</div>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: PREVISÕES AGRO */}
              {/* ========================================================= */}
              {abaAtiva === "previsoes_agro" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-emerald-900/60"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Previsões Agro e fatores externos</h2><p className="text-xs text-slate-400 mt-1">Painel separado para clima, juros, produção agrícola, crédito rural e preços de commodities. Os indicadores não alteram a previsão comercial sem validação histórica.</p></div><div className="flex flex-wrap items-end justify-end gap-3"><div className="text-right text-[11px] text-slate-500">{descricaoAbrangenciaFatores}</div><button type="button" onClick={() => void fatoresExternosQuery.refetch()} disabled={fatoresExternosQuery.isFetching || localidadesFatoresSelecionadas.length === 0} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">{fatoresExternosQuery.isFetching ? "Atualizando..." : "Atualizar APIs"}</button></div></div></div>
                  {fatoresExternosQuery.isFetching && <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4 text-sm text-sky-300">Consultando APIs oficiais e fontes de mercado...</div>}
                  {fatoresExternosQuery.error && <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">As fontes externas não responderam completamente. O painel preserva os dados disponíveis e tentará novamente.</div>}
                  {fatoresExternosQuery.data && <>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">Status das fontes</h3><p className="mt-1 text-[11px] text-slate-500">Última consulta: {new Date(fatoresExternosQuery.data.atualizado_em).toLocaleString("pt-BR")}</p></div><div className="flex flex-wrap gap-2">{statusFontesExternas.map((fonte) => <span key={fonte.nome} className={`rounded-full border px-2.5 py-1 text-[10px] ${fonte.status === "ok" ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : fonte.status === "aviso" ? "border-amber-700/60 bg-amber-950/30 text-amber-300" : "border-slate-700 bg-slate-950/40 text-slate-400"}`}><span className="mr-1">{fonte.status === "ok" ? "●" : fonte.status === "aviso" ? "!" : "–"}</span>{fonte.nome}: {fonte.status}</span>)}</div></div></div>
                    {indiceAgro && <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-orange-300">Índice de Ambiente Agropecuário</h3><p className="mt-1 text-[11px] text-slate-400">Indicador de contexto de 0 a 100. Não é probabilidade de venda e não altera automaticamente a previsão comercial.</p></div><div className={`rounded-full px-4 py-2 text-lg font-black ${indiceAgro.score >= 65 ? "bg-emerald-500/20 text-emerald-300" : indiceAgro.score <= 35 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>{indiceAgro.score}/100 · {indiceAgro.classe}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{indiceAgro.componentes.map((item) => <div key={item.nome} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[10px] uppercase text-slate-500">{item.nome}</div><div className={`mt-1 text-lg font-bold ${item.valor > 0 ? "text-emerald-300" : item.valor < 0 ? "text-red-300" : "text-slate-300"}`}>{item.valor > 0 ? "+" : ""}{item.valor} pts</div><div className="text-[10px] leading-4 text-slate-500">{item.explicacao}</div></div>)}</div>{indiceAgro.alertas.length > 0 && <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-200"><strong>Alertas:</strong> {indiceAgro.alertas.join(" ")}</div>}</div>}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Chuva futura</div><div className="mt-2 text-2xl font-bold text-emerald-300">{previsaoChuvaFutura.length} dias</div><div className="text-[11px] text-slate-400">Open-Meteo</div></div><div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Selic futura</div><div className="mt-2 text-2xl font-bold text-amber-300">{expectativasSelicFuturas.length} reuniões</div><div className="text-[11px] text-slate-400">Focus / Banco Central</div></div><div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Clima sazonal</div><div className="mt-2 text-2xl font-bold text-sky-300">{previsaoSazonal.length} períodos</div><div className="text-[11px] text-slate-400">CPTEC/INPE</div></div><div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Commodities</div><div className="mt-2 text-2xl font-bold text-violet-300">{fatoresExternosQuery.data.indicadores_agro.precos_agro.filter((item) => item.valor_usd != null).length}/3</div><div className="text-[11px] text-slate-400">Café, milho e soja</div></div></div>
                    <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Clima futuro e sazonal</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">A previsão diária é curta; a sazonal é probabilística.</p><DataTable rows={previsaoChuvaFutura} exportName="agro_chuva_futura" columns={["data", "chuva_mm", "probabilidade_chuva_pct"]} percentColumns={["probabilidade_chuva_pct"]} /><div className="mt-4"><DataTable rows={previsaoSazonal} exportName="agro_clima_sazonal" columns={["modelo", "periodo", "chuva_total_mm", "sinal_tercil", "valor_sinal"]} /></div></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Selic e crédito rural</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">Expectativas de mercado e status da consulta SICOR/MDCR.</p><DataTable rows={expectativasSelicFuturas} exportName="agro_selic_focus" columns={["data_consulta", "reuniao", "media_pct", "mediana_pct", "respondentes"]} /><div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[10px] uppercase text-slate-500">Crédito de investimento</div><div className="mt-1 text-xl font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl == null ? "Não disponível" : `R$ ${fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl.toLocaleString("pt-BR")}`}</div><div className="mt-1 text-[11px] text-slate-500">Status: {fatoresExternosQuery.data.indicadores_agro.credito_status}</div></div></div></div>
                    <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-4"><h3 className="text-sm font-bold text-orange-300">Produção agrícola — IBGE/SIDRA</h3><div className="mt-3 grid grid-cols-2 gap-3"><div><div className="text-[10px] uppercase text-slate-500">Produção de café</div><div className="text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_producao_t == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_producao_t.toLocaleString("pt-BR")} t`}</div></div><div><div className="text-[10px] uppercase text-slate-500">Área colhida</div><div className="text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha.toLocaleString("pt-BR")} ha`}</div></div></div><p className="mt-3 text-[11px] text-slate-500">Último ano: {fatoresExternosQuery.data.indicadores_agro.ano_referencia || "-"}.</p></div><div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4"><h3 className="text-sm font-bold text-violet-300">Preços agrícolas de mercado</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">Futuros internacionais em USD; são sinais de mercado, não preços nacionais.</p><DataTable rows={fatoresExternosQuery.data.indicadores_agro.precos_agro} exportName="agro_precos_commodities" columns={["produto", "ticker", "valor_usd", "atualizado_em"]} /></div></div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Fontes e avisos</h3><div className="mt-3 space-y-2 text-[11px] text-slate-400">{fatoresExternosQuery.data.avisos.map((aviso) => <div key={aviso} className="text-amber-300">Aviso: {aviso}</div>)}<div>Fontes: {fatoresExternosQuery.data.fontes.join("; ") || "nenhuma"}</div><div>Consulta: {new Date(fatoresExternosQuery.data.atualizado_em).toLocaleString("pt-BR")}</div></div></div>
                  </>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: DIAGNÓSTICO DA BASE */}
              {/* ========================================================= */}
              {abaAtiva === "diagnostico" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h2 className="text-lg font-bold text-white">Diagnóstico da Base</h2>
                    <p className="text-xs text-slate-400 mt-1">Cobertura temporal, consistência dos dados e faturamento anual da base completa, sem os filtros comerciais.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {[
                      ["Registros originais", meta?.linhas_originais || 0, "text-slate-200"],
                      ["Registros válidos", meta?.linhas_validas || 0, "text-emerald-300"],
                      ["Sem data", meta?.linhas_sem_data_removidas || 0, "text-amber-300"],
                      ["Meses esperados", diagnosticoBase.mesesEsperados.length, "text-sky-300"],
                      ["Meses sem venda", diagnosticoBase.mesesSemVenda.length, diagnosticoBase.mesesSemVenda.length ? "text-amber-300" : "text-emerald-300"],
                      ["UFs não identificadas", diagnosticoBase.ufNaoIdentificada, diagnosticoBase.ufNaoIdentificada ? "text-amber-300" : "text-emerald-300"],
                    ].map(([label, value, color]) => (
                      <div key={String(label)} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                        <div className={`text-xl font-bold mt-2 ${color}`}>{Number(value).toLocaleString("pt-BR")}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4">Faturamento anual</h3>
                      <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={diagnosticoBase.anual} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano" stroke="#94A3B8" fontSize={11} /><YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => valorResumido(v, true)} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any) => [formatarMoeda(v), "Faturamento"]} /><Bar dataKey="faturamento" fill={CEMAG_ORANGE} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4">Indicadores de qualidade</h3>
                      <div className="space-y-2 text-xs">
                        {[["Quantidade não positiva", diagnosticoBase.qtdNaoPositiva], ["Faturamento não positivo", diagnosticoBase.faturamentoNaoPositivo], ["Cidade não identificada", diagnosticoBase.cidadeNaoIdentificada], ["Produto não informado", diagnosticoBase.produtoNaoInformado], ["Cliente não informado", diagnosticoBase.clienteNaoInformado]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b border-slate-800 py-2"><span className="text-slate-400">{label}</span><strong className={Number(value) ? "text-amber-300" : "text-emerald-300"}>{Number(value).toLocaleString("pt-BR")}</strong></div>)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-orange-500/30 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-orange-300">Como os números foram classificados</h3>
                        <p className="text-xs text-slate-400 mt-1">Esta tabela acompanha os filtros ativos, inclusive início e fim do período. A quantidade abaixo é a soma das linhas filtradas, e não o número de registros.</p>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">{dadosFiltrados.length.toLocaleString("pt-BR")} linhas no filtro atual</div>
                    </div>
                    <DataTable
                      rows={classificacaoFiltrada}
                      exportName="classificacao_por_tipo_filtrada"
                      columns={["tipo_produto", "criterio", "linhas", "quantidade", "participacao_quantidade", "faturamento", "participacao_faturamento", "pedidos", "clientes", "produtos_distintos", "exemplos_produtos", "categorias_origem"]}
                      percentColumns={["participacao_quantidade", "participacao_faturamento"]}
                    />
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-white mb-3">Meses sem registros</h3>
                    {diagnosticoBase.mesesSemVenda.length ? <div className="flex flex-wrap gap-2">{diagnosticoBase.mesesSemVenda.map((mes) => <span key={mes} className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">{mes}</span>)}</div> : <p className="text-xs text-emerald-300">Todos os meses do intervalo possuem pelo menos um registro.</p>}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 11: BASE TRATADA */}
              {/* ========================================================= */}
              {abaAtiva === "base_tratada" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">Base Tratada</h2>
                      <p className="text-xs text-slate-400">
                        {dadosFiltrados.length.toLocaleString("pt-BR")} linhas ativas com tratamento de UF, moedas e correções.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportarTabelaExcel(dadosFiltrados, "base_tratada_completa.xlsx", "Base Tratada")}
                        className="text-xs flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold px-3 py-1.5 rounded transition-colors shadow-sm"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Exportar Excel</span>
                      </button>
                      <button
                        onClick={() => exportarTabelaCsv(dadosFiltrados, "base_tratada_completa.csv")}
                        className="text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Dados */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="max-h-[550px] overflow-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 sticky top-0 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-800 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Pedido</th>
                            <th className="py-2.5 px-3">Emissão</th>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Cidade</th>
                            <th className="py-2.5 px-3">UF</th>
                            <th className="py-2.5 px-3">Representante</th>
                            <th className="py-2.5 px-3">Produto</th>
                            <th className="py-2.5 px-3">Família</th>
                            <th className="py-2.5 px-3 text-right">Qtd</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3">Tipo Venda</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {dadosFiltrados.slice(0, 300).map((d) => (
                            <tr key={d.id} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-slate-400">{d.pedido}</td>
                              <td className="py-2 px-3 text-slate-300">{d.data_str}</td>
                              <td className="py-2 px-3 font-sans font-medium text-white truncate max-w-xs">{d.cliente}</td>
                              <td className="py-2 px-3 font-sans text-slate-300">{d.cidade}</td>
                              <td className="py-2 px-3 font-bold text-amber-400">{d.uf}</td>
                              <td className="py-2 px-3 font-sans text-slate-300">{d.representante}</td>
                              <td className="py-2 px-3 font-sans text-white truncate max-w-xs">{d.produto}</td>
                              <td className="py-2 px-3 font-sans text-slate-400">{d.familia}</td>
                              <td className="py-2 px-3 text-right text-slate-300">{formatarInteiro(d.quantidade)}</td>
                              <td className="py-2 px-3 text-right font-bold text-orange-400">{formatarMoeda(d.faturamento)}</td>
                              <td className="py-2 px-3 font-sans text-slate-400 truncate max-w-xs">{d.tipo_venda}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {dadosFiltrados.length > 300 && (
                      <div className="p-2.5 bg-slate-950 text-center text-xs text-slate-400 border-t border-slate-800">
                        Exibindo as primeiras 300 de {dadosFiltrados.length.toLocaleString("pt-BR")} linhas. A exportação completa contém todos os registros.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 13: CENTRAL DE EXPORTAÇÕES */}
              {/* ========================================================= */}
              {abaAtiva === "exportacoes" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Download className="w-5 h-5 text-orange-500" /><span>Central de exportações</span></h2><p className="text-xs text-slate-400">Recorte adicional por anos e meses, tabelas prontas, gerador personalizado e base completa.</p></div>
                  {(() => {
                    const quantidadeAuditada = dadosFiltrados.reduce((s, d) => s + Number(d.quantidade || 0), 0);
                    const faturamentoAuditado = dadosFiltrados.reduce((s, d) => s + Number(d.faturamento || 0), 0);
                    const pedidosAuditados = new Set(dadosFiltrados.map((d) => d.pedido)).size;
                    const clientesAuditados = new Set(dadosFiltrados.map((d) => d.cliente)).size;
                    const resumoAuditoria = [
                      { indicador: "Linhas consideradas pelo filtro", valor: dadosFiltrados.length },
                      { indicador: "Quantidade total", valor: quantidadeAuditada },
                      { indicador: "Faturamento total", valor: faturamentoAuditado },
                      { indicador: "Pedidos únicos", valor: pedidosAuditados },
                      { indicador: "Clientes únicos", valor: clientesAuditados },
                      { indicador: "Período exibido", valor: periodoBaseTexto },
                      { indicador: "Data usada nos cálculos", valor: "BAI_MOVIMENTAC (com fallback para BAI_EMISSAO)" },
                    ];
                    return <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-orange-300">Auditoria dos números exibidos</h3>
                          <p className="mt-1 max-w-3xl text-xs text-slate-300">Exporta exatamente as linhas atualmente filtradas e uma aba de resumo com os indicadores usados pelo painel. Use este arquivo para conferir números como as 145 linhas e a quantidade 222 mostradas na tela.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => exportarAuditoriaExcel(dadosFiltrados, resumoAuditoria, "auditoria_periodo_filtrado.xlsx")} className="inline-flex items-center gap-2 rounded bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500"><FileSpreadsheet className="h-4 w-4" /> Exportar auditoria Excel</button>
                          <button onClick={() => exportarTabelaCsv(dadosFiltrados, "linhas_filtradas_auditoria.csv")} className="inline-flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"><Download className="h-4 w-4" /> Exportar linhas CSV</button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                        <div className="rounded bg-slate-950/70 p-2"><span className="text-slate-500">Linhas</span><strong className="block text-white">{dadosFiltrados.length.toLocaleString("pt-BR")}</strong></div>
                        <div className="rounded bg-slate-950/70 p-2"><span className="text-slate-500">Quantidade</span><strong className="block text-orange-300">{formatarInteiro(quantidadeAuditada)}</strong></div>
                        <div className="rounded bg-slate-950/70 p-2"><span className="text-slate-500">Faturamento</span><strong className="block text-orange-300">{formatarMoeda(faturamentoAuditado)}</strong></div>
                        <div className="rounded bg-slate-950/70 p-2"><span className="text-slate-500">Pedidos</span><strong className="block text-sky-300">{pedidosAuditados.toLocaleString("pt-BR")}</strong></div>
                        <div className="rounded bg-slate-950/70 p-2"><span className="text-slate-500">Clientes</span><strong className="block text-sky-300">{clientesAuditados.toLocaleString("pt-BR")}</strong></div>
                      </div>
                    </div>;
                  })()}
                  {(() => { const anos=Array.from(new Set(dadosFiltrados.map(d=>d.ano))).sort(); const meses=Array.from(new Set(dadosFiltrados.map(d=>d.mes_num))).sort((a,b)=>a-b); const tipo=exportTipo; const modo=exportModo; const baseExport=dadosFiltrados; const tabela=modo==='prontas'?tabelaExportacaoPronta(baseExport,tipo):gerarExportacaoPersonalizada(baseExport,exportGranularidade,exportMetrica,exportDimensao==='Nenhum'?undefined:exportDimensao,false); return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Linhas</span><div className="text-xl font-bold text-white">{baseExport.length.toLocaleString('pt-BR')}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(baseExport.reduce((s,d)=>s+d.faturamento,0))}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Quantidade</span><div className="text-xl font-bold text-sky-400">{formatarInteiro(baseExport.reduce((s,d)=>s+d.quantidade,0))}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Pedidos</span><div className="text-xl font-bold text-green-400">{new Set(baseExport.map(d=>d.pedido)).size}</div></div></div><div className="flex flex-wrap gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800"><button onClick={()=>setExportModo('prontas')} className={`px-3 py-1.5 rounded text-xs ${modo==='prontas'?'bg-orange-600 text-white':'text-slate-300'}`}>⚡ Tabelas prontas</button><button onClick={()=>setExportModo('personalizada')} className={`px-3 py-1.5 rounded text-xs ${modo==='personalizada'?'bg-orange-600 text-white':'text-slate-300'}`}>🧩 Gerador personalizado</button><button onClick={()=>setExportModo('base')} className={`px-3 py-1.5 rounded text-xs ${modo==='base'?'bg-orange-600 text-white':'text-slate-300'}`}>🗂️ Base completa</button></div>{modo==='prontas'&&<div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-slate-400">Tabela pronta:</span><select value={exportTipo} onChange={e=>setExportTipo(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{["Faturamento diário","Resumo mensal","Resumo trimestral","Resumo anual","Por família","Por produto/carreta","Por cliente","Por representante","Por região / UF / cidade","Por forma de venda","Por lista de preço"].map(x=><option key={x}>{x}</option>)}</select></div>}{modo==='personalizada'&&<div className="flex flex-wrap items-center gap-3 text-xs"><select value={exportGranularidade} onChange={e=>setExportGranularidade(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{['Diário','Semanal','Mensal','Trimestral','Anual'].map(x=><option key={x}>{x}</option>)}</select><select value={exportMetrica} onChange={e=>setExportMetrica(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{['Faturamento','Quantidade','Pedidos','Clientes','Ticket unitário','Valor médio por pedido'].map(x=><option key={x}>{x}</option>)}</select><select value={exportDimensao} onChange={e=>setExportDimensao(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option>Nenhum</option>{['familia','produto','cliente','cliente_base','representante','regiao','uf','cidade','tipo_venda','categoria_produto','descricao_generica','lista_preco_uf'].map(x=><option key={x}>{x}</option>)}</select></div>}{modo==='base'?<DataTable rows={baseExport.slice(0,300)} columns={["data_str","cliente","produto","uf","quantidade","faturamento","pedido","tipo_venda"]} />:<DataTable rows={tabela} columns={Object.keys(tabela[0]||{}).slice(0,10)} />}{modo!=='base'&&<div className="flex gap-2"><button onClick={()=>exportarTabelaCsv(tabela,`exportacao_${modo}.csv`)} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-2"><Download className="w-4 h-4"/> Baixar CSV</button><button onClick={()=>exportarTabelaExcel(tabela,`exportacao_${modo}.xlsx`,tipo.slice(0,31))} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Baixar Excel</button></div>}{modo==='base'&&<div className="flex gap-2"><button onClick={()=>exportarTabelaCsv(baseExport,'base_faturamento_filtrada.csv')} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">Baixar base filtrada em CSV</button><button onClick={()=>exportarTabelaExcel(baseExport,'base_faturamento_filtrada.xlsx','Base filtrada')} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs">Baixar base filtrada em Excel</button></div>}</div>; })()}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {relatorioAberto && (
        <div className="relatorio-modal fixed inset-0 z-[80] overflow-y-auto bg-black/80 p-4 md:p-8">
          <div className="mx-auto max-w-6xl rounded-2xl bg-white text-slate-900 shadow-2xl">
            <div className="report-config flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div><h2 className="text-lg font-bold">Gerar relatório para impressão</h2><p className="text-xs text-slate-500">O relatório usa os filtros atuais e não altera os dados do dashboard.</p></div>
              <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-slate-600">De <input type="date" value={relatorioDataInicio} onChange={(event) => setRelatorioDataInicio(event.target.value)} className="ml-1 rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Até <input type="date" value={relatorioDataFim} onChange={(event) => setRelatorioDataFim(event.target.value)} className="ml-1 rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label><select value={tipoRelatorio} onChange={(event) => setTipoRelatorio(event.target.value as typeof tipoRelatorio)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="executivo">Relatório executivo</option><option value="mensal">Relatório mensal detalhado</option><option value="produtos">Produtos e famílias</option><option value="clientes">Clientes e concentração</option><option value="territorial">Regiões, estados e cidades</option><option value="metas">Metas e atingimento</option><option value="previsoes">Previsões e cenários</option><option value="auditoria">Relatório de auditoria</option></select><button type="button" onClick={imprimirRelatorio} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500"><Printer className="h-4 w-4" /> Imprimir relatório</button><button type="button" onClick={() => setRelatorioAberto(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Fechar</button></div>
            </div>
            <article className="relatorio-gerado p-6 md:p-10">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-orange-500 pb-4"><div><div className="text-2xl font-black tracking-tight text-orange-600">cemag</div><h1 className="mt-1 text-2xl font-bold">{tipoRelatorio === "executivo" ? "Relatório Executivo Comercial" : tipoRelatorio === "mensal" ? "Relatório Mensal Detalhado" : tipoRelatorio === "produtos" ? "Relatório de Produtos e Famílias" : tipoRelatorio === "clientes" ? "Relatório de Clientes e Concentração" : tipoRelatorio === "territorial" ? "Relatório Territorial" : tipoRelatorio === "metas" ? "Relatório de Metas e Atingimento" : tipoRelatorio === "previsoes" ? "Relatório de Previsões e Cenários" : "Relatório de Auditoria da Base"}</h1><p className="mt-1 text-sm text-slate-500">Inteligência Comercial · Período: {relatorioDataInicio || "início"} a {relatorioDataFim || "fim"}</p></div><div className="text-right text-xs text-slate-500">Gerado em {hoje.toLocaleString("pt-BR")}<br />Aba de origem: {abaAtiva}</div></div>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">{[["Faturamento", formatarMoeda(dadosRelatorio.totalFaturamento)], ["Quantidade", formatarInteiro(dadosRelatorio.totalQuantidade)], ["Pedidos", dadosRelatorio.pedidos.toLocaleString("pt-BR")], ["Clientes", dadosRelatorio.clientes.toLocaleString("pt-BR")], ["Linhas", dadosRelatorio.linhas.toLocaleString("pt-BR")]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-1 block text-lg text-slate-900">{value}</strong></div>)}</div>
              {tipoRelatorio === "executivo" && <div className="space-y-6"><section><h2 className="mb-3 text-lg font-bold">Resumo executivo</h2><p className="text-sm leading-6 text-slate-700">O período analisado registrou <strong>{formatarMoeda(dadosRelatorio.totalFaturamento)}</strong> em faturamento, distribuído em <strong>{dadosRelatorio.pedidos.toLocaleString("pt-BR")}</strong> pedidos e <strong>{dadosRelatorio.clientes.toLocaleString("pt-BR")}</strong> clientes. Este relatório considera exatamente as linhas resultantes dos filtros aplicados no dashboard.</p></section><div className="grid gap-6 md:grid-cols-3">{[["Top clientes", dadosRelatorio.topClientes], ["Top produtos", dadosRelatorio.topProdutos], ["Top regiões", dadosRelatorio.topRegioes]].map(([titulo, lista]) => <section key={titulo as string}><h2 className="mb-2 text-sm font-bold">{titulo as string}</h2><table className="w-full text-xs"><tbody>{(lista as typeof dadosRelatorio.topClientes).slice(0, 5).map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="py-2 pr-2">{item.nome}</td><td className="py-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td></tr>)}</tbody></table></section>)}</div></div>}
              {tipoRelatorio === "mensal" && <section><h2 className="mb-3 text-lg font-bold">Evolução mensal detalhada</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Mês</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Pedidos</th><th className="p-2 text-right">Clientes</th></tr></thead><tbody>{dadosRelatorio.meses.map((item) => <tr key={item.mes} className="border-b border-slate-200"><td className="p-2">{item.mes}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td><td className="p-2 text-right">{item.pedidos}</td><td className="p-2 text-right">{item.clientes}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "produtos" && <section><h2 className="mb-3 text-lg font-bold">Ranking de produtos</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Produto</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{dadosRelatorio.topProdutos.map((item, index) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{index + 1}. {item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "clientes" && <section><h2 className="mb-3 text-lg font-bold">Clientes e concentração de faturamento</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Cliente</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Participação</th></tr></thead><tbody>{dadosRelatorio.topClientes.map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{dadosRelatorio.totalFaturamento ? formatarPercentual(item.faturamento / dadosRelatorio.totalFaturamento) : "—"}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "territorial" && <section><h2 className="mb-3 text-lg font-bold">Desempenho por região</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Região</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{dadosRelatorio.topRegioes.map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "metas" && <section><h2 className="mb-3 text-lg font-bold">Metas e atingimento disponíveis</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Mês</th><th className="p-2 text-right">Realizado</th><th className="p-2 text-right">Meta</th><th className="p-2 text-right">Atingimento</th></tr></thead><tbody>{atingimentoMensal.filter((item) => `${item.ano}-${String(item.mes_num).padStart(2, "0")}` >= relatorioDataInicio.slice(0, 7) && `${item.ano}-${String(item.mes_num).padStart(2, "0")}` <= relatorioDataFim.slice(0, 7)).map((item) => <tr key={`${item.ano}-${item.mes_num}`} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2 text-right">{formatarMoeda(item.realizado)}</td><td className="p-2 text-right">{formatarMoeda(item.meta)}</td><td className="p-2 text-right font-semibold">{formatarPercentual(item.atingimento)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "previsoes" && <section><h2 className="mb-3 text-lg font-bold">Previsões e cenários — {metricaPrevisao}</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Mês</th><th className="p-2 text-right">Conservador</th><th className="p-2 text-right">Provável</th><th className="p-2 text-right">Otimista</th></tr></thead><tbody>{previsaoMensal.serie.filter((item: any) => item.tipo === "Previsão").slice(0, 12).map((item: any) => <tr key={item.ano_mes} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2 text-right">{formatarMetrica(item.conservador, metricaPrevisao)}</td><td className="p-2 text-right font-semibold">{formatarMetrica(item.previsao, metricaPrevisao)}</td><td className="p-2 text-right">{formatarMetrica(item.otimista, metricaPrevisao)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "auditoria" && <section className="space-y-4"><h2 className="text-lg font-bold">Memória de cálculo e auditoria</h2><div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6"><p><strong>Linhas consideradas:</strong> {dadosRelatorio.linhas.toLocaleString("pt-BR")}</p><p><strong>Período aplicado:</strong> {relatorioDataInicio || "início"} a {relatorioDataFim || "fim"}</p><p><strong>Data utilizada:</strong> movimentação, com fallback para emissão</p><p><strong>Filtros:</strong> todos os filtros gerais ativos no momento da geração</p></div><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Indicador</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{[["Faturamento total", formatarMoeda(dadosRelatorio.totalFaturamento)], ["Quantidade total", formatarInteiro(dadosRelatorio.totalQuantidade)], ["Pedidos únicos", dadosRelatorio.pedidos.toLocaleString("pt-BR")], ["Clientes únicos", dadosRelatorio.clientes.toLocaleString("pt-BR")], ["Linhas filtradas", dadosRelatorio.linhas.toLocaleString("pt-BR")]].map(([label, value]) => <tr key={label} className="border-b border-slate-200"><td className="p-2">{label}</td><td className="p-2 text-right font-semibold">{value}</td></tr>)}</tbody></table></section>}
              <footer className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-500">Documento gerado pelo painel CEMAG · Os valores refletem os filtros selecionados no momento da geração.</footer>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
