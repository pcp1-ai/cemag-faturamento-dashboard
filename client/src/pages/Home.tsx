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
import { AIChatBox, type Message } from "../components/AIChatBox";
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
  MessageCircle,
  X,
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

const CAPITAIS_ESTADOS: Record<string, string> = { AC: "Rio Branco", AL: "MaceiÃ³", AP: "MacapÃ¡", AM: "Manaus", BA: "Salvador", CE: "Fortaleza", DF: "BrasÃ­lia", ES: "VitÃ³ria", GO: "GoiÃ¢nia", MA: "SÃ£o LuÃ­s", MT: "CuiabÃ¡", MS: "Campo Grande", MG: "Belo Horizonte", PA: "BelÃ©m", PB: "JoÃ£o Pessoa", PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho", RR: "Boa Vista", SC: "FlorianÃ³polis", SP: "SÃ£o Paulo", SE: "Aracaju", TO: "Palmas" };
const REGIOES_BRASIL = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const ROTULOS_METRICA_YOY: Record<MetricaComparativoAnual, string> = {
  faturamento: "Faturamento",
  quantidade: "Quantidade",
  pedidos: "Pedidos",
  clientes: "Clientes",
  ticket_unitario: "Ticket unitÃ¡rio",
  valor_medio_pedido: "Valor mÃ©dio por pedido",
};

function formatarMetricaYoY(valor: number, metrica: MetricaComparativoAnual) {
  return metrica === "faturamento" || metrica === "ticket_unitario" || metrica === "valor_medio_pedido"
    ? formatarMoeda(valor)
    : formatarInteiro(valor);
}

const metricKey = (label: string): string => ({
  "Faturamento": "faturamento",
  "Quantidade": "quantidade",
  "Pedidos": "pedidos",
  "Clientes": "clientes",
  "Ticket unitÃ¡rio": "ticket_unitario_calc",
  "Valor mÃ©dio por pedido": "valor_medio_pedido",
}[label] || "faturamento");

const metricFormat = (value: number, label: string) =>
  ["Faturamento", "Ticket unitÃ¡rio", "Valor mÃ©dio por pedido"].includes(label) ? formatarMoeda(value) : formatarInteiro(value);

const METRICAS_PAINEL = ["Faturamento", "Quantidade", "Pedidos", "Clientes", "Ticket unitÃ¡rio", "Valor mÃ©dio por pedido"] as const;
const CAMPO_METRICA: Record<string, string> = { Faturamento: "faturamento", Quantidade: "quantidade", Pedidos: "pedidos", Clientes: "clientes", "Ticket unitÃ¡rio": "ticket_unitario_calc", "Valor mÃ©dio por pedido": "valor_medio_pedido" };
const campoMetrica = (metrica: string) => CAMPO_METRICA[metrica] || "faturamento";
const valorMetrica = (row: any, metrica: string) => {
  const campo = campoMetrica(metrica);
  const fallback = campo === "ticket_unitario_calc" ? "ticketUnitario" : campo === "valor_medio_pedido" ? "valorMedioPedido" : campo;
  return Number(row?.[campo] ?? row?.[fallback] ?? 0);
};
const formatarMetrica = (valor: number, metrica: string) => ["Faturamento", "Ticket unitÃ¡rio", "Valor mÃ©dio por pedido"].includes(metrica) ? formatarMoeda(valor) : formatarInteiro(valor);
const resumirMetrica = (valor: number, metrica: string) => ["Faturamento", "Ticket unitÃ¡rio", "Valor mÃ©dio por pedido"].includes(metrica) ? valorResumido(valor, true) : formatarInteiro(valor);
const intervaloEixoMensal = (total: number) => Math.max(0, Math.ceil(total / 12) - 1);
const ROTULOS_SERIE_PREVISAO: Record<string, string> = {
  realizado: "Realizado",
  previsao_retroativa: "ProvÃ¡vel retroativo",
  conservador_retroativo: "Conservador retroativo",
  otimista_retroativo: "Otimista retroativo",
  previsao: "ProvÃ¡vel / fechamento",
  conservador: "Conservador",
  otimista: "Otimista",
};
const rotuloSeriePrevisao = (nome: unknown) => ROTULOS_SERIE_PREVISAO[String(nome)] || String(nome || "SÃ©rie");

const SeletorMetrica: React.FC<{ value: string; onChange: (value: string) => void; label?: string }> = ({ value, onChange, label = "MÃ©trica" }) => (
  <label className="flex items-center gap-2 text-xs text-slate-400">
    <span>{label}:</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1">
      {METRICAS_PAINEL.map((metrica) => <option key={metrica} value={metrica}>{metrica}</option>)}
    </select>
  </label>
);

const GRUPOS_ABAS = [
  { id: "resumo", label: "Resumo", icon: "ðŸ ", abas: [{ id: "visao_geral", label: "VisÃ£o geral" }, { id: "metas", label: "Metas mensais" }, { id: "modo_apresentacao", label: "Modo apresentaÃ§Ã£o" }] },
  { id: "analises", label: "AnÃ¡lises comerciais", icon: "ðŸ“Š", abas: [{ id: "ano_ano", label: "Ano x ano" }, { id: "mes_mes", label: "MÃªs x mÃªs" }, { id: "produtos", label: "Produtos e carretas" }, { id: "clientes", label: "Clientes" }, { id: "regioes", label: "RegiÃµes" }, { id: "representantes", label: "Representantes" }, { id: "tipos", label: "Tipos e categorias" }, { id: "inteligencia", label: "InteligÃªncia comercial" }] },
  { id: "previsoes", label: "PrevisÃµes", icon: "ðŸ“ˆ", abas: [{ id: "previsoes", label: "PrevisÃµes" }, { id: "analise_historica", label: "AnÃ¡lise histÃ³rica" }, { id: "previsoes_agro", label: "PrevisÃµes Agro e fatores externos" }, { id: "central_externa", label: "Central de dados / ANFAVEA" }] },
  { id: "dados", label: "Dados e relatÃ³rios", icon: "ðŸ“", abas: [{ id: "diagnostico", label: "DiagnÃ³stico da base" }, { id: "base_tratada", label: "Base tratada" }, { id: "exportacoes", label: "ExportaÃ§Ãµes" }] },
] as const;
const INFO_ABAS: Record<string, { titulo: string; descricao: string }> = {
  visao_geral: { titulo: "VisÃ£o geral", descricao: "Resumo executivo para entender rapidamente o desempenho comercial." },
  metas: { titulo: "Metas mensais", descricao: "Acompanhe realizado, meta, projeÃ§Ã£o e atingimento por mÃªs." },
  modo_apresentacao: { titulo: "Modo apresentaÃ§Ã£o", descricao: "VisualizaÃ§Ã£o limpa para reuniÃµes e apresentaÃ§Ãµes executivas." },
  ano_ano: { titulo: "Ano x ano", descricao: "Compare o desempenho dos anos disponÃ­veis com filtros independentes." },
  mes_mes: { titulo: "MÃªs x mÃªs", descricao: "Compare meses especÃ­ficos e identifique os principais movimentos." },
  produtos: { titulo: "Produtos e carretas", descricao: "Analise mix, famÃ­lias, categorias e participaÃ§Ã£o dos produtos." },
  clientes: { titulo: "Clientes", descricao: "Acompanhe carteira, concentraÃ§Ã£o, recorrÃªncia e oportunidades." },
  regioes: { titulo: "RegiÃµes", descricao: "Explore faturamento por regiÃ£o, estado e municÃ­pio." },
  representantes: { titulo: "Representantes", descricao: "Compare desempenho e participaÃ§Ã£o da equipe comercial." },
  tipos: { titulo: "Tipos e categorias", descricao: "Entenda a composiÃ§Ã£o das vendas por tipo e categoria." },
  inteligencia: { titulo: "InteligÃªncia comercial", descricao: "Investigue mudanÃ§as, oportunidades, concentraÃ§Ã£o e comportamento da carteira." },
  previsoes: { titulo: "PrevisÃµes", descricao: "Projete os prÃ³ximos meses com cenÃ¡rios e validaÃ§Ã£o histÃ³rica." },
  analise_historica: { titulo: "AnÃ¡lise histÃ³rica", descricao: "Veja possÃ­veis explicaÃ§Ãµes, curiosidades e contribuiÃ§Ãµes dos meses anteriores." },
  previsoes_agro: { titulo: "PrevisÃµes Agro", descricao: "Relacione o contexto agrÃ­cola externo com a leitura comercial." },
  central_externa: { titulo: "Central de dados", descricao: "Consulte clima, juros, produÃ§Ã£o, crÃ©dito e commodities." },
  diagnostico: { titulo: "DiagnÃ³stico da base", descricao: "Verifique qualidade, cobertura e consistÃªncia dos dados carregados." },
  base_tratada: { titulo: "Base tratada", descricao: "Consulte os registros depois das regras de tratamento CEMAG." },
  exportacoes: { titulo: "ExportaÃ§Ãµes", descricao: "Monte e baixe tabelas completas em CSV ou Excel." },
};

const DataTable: React.FC<{ rows: any[]; columns: string[]; exportName?: string; percentColumns?: string[]; percentPointColumns?: string[]; metricColumns?: Record<string, string> }> = ({ rows, columns, exportName = "tabela_dashboard", percentColumns = [], percentPointColumns = [], metricColumns = {} }) => (
  <div className="border border-slate-800 rounded-lg">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 border-b border-slate-800">
      <span className="text-[10px] text-slate-500">{rows.length.toLocaleString("pt-BR")} linha(s) disponÃ­veis</span>
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
              const isPercentPoint = percentPointColumns.includes(c);
              const isPercent = normalized.includes("pct") || normalized.includes("participacao") || percentColumns.includes(c);
              const isMoney = normalized.includes("faturamento") || normalized.includes("preco") || normalized.includes("resultado") || normalized.includes("receita") || normalized.includes("valor");
              const display = isNumber ? (metricColumns[c] ? formatarMetrica(value, metricColumns[c]) : isPercentPoint ? formatarPercentual(value / 100) : isPercent ? formatarPercentual(value) : isMoney ? formatarMoeda(value) : formatarInteiro(value)) : String(value ?? "-");
              return <td key={c} className="p-2 max-w-[220px] truncate">{display}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length > 300 && <div className="p-2 text-[10px] text-slate-500 text-center">PrÃ©via com 300 de {rows.length} linhas. Os botÃµes acima exportam tudo.</div>}
    </div>
  </div>
);

const MetaCheckboxFilter: React.FC<{ label: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }> = ({ label, values, selected, onChange }) => {
  const [busca, setBusca] = useState("");
  const filtrados = values.filter((value) => value.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()));
  const alternar = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-400">
    <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{label} <span className="text-[10px] text-slate-500">({selected.length ? `${selected.length} selecionado(s)` : "todos"})</span></span><span className="flex gap-1"><button type="button" onClick={() => onChange([...values])} className="text-[10px] text-sky-400 hover:text-sky-300 whitespace-nowrap">Selecionar tudo</button><button type="button" onClick={() => onChange([])} className="text-[10px] text-orange-400 hover:text-orange-300 whitespace-nowrap">Limpar seleÃ§Ã£o</button></span></div>
    {values.length > 5 && <div className="relative mt-1"><Search className="absolute left-2 top-2 h-3 w-3 text-slate-500" /><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}...`} className="w-full rounded bg-slate-900 border border-slate-700 py-1 pl-7 pr-2 text-[11px] text-slate-200" /></div>}
    <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded border border-slate-800 bg-slate-900 p-1">{filtrados.map((value) => <label key={value} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-[11px] text-slate-300 hover:bg-slate-800"><input type="checkbox" checked={selected.includes(value)} onChange={() => alternar(value)} className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500" /><span className="truncate">{value}</span></label>)}{!filtrados.length && <span className="block p-1 text-[10px] text-slate-500">Nenhuma opÃ§Ã£o encontrada</span>}</div>
  </div>;
};

export default function Home({ onLogout, emailAutenticado, isAdmin = false }: { onLogout?: () => void; emailAutenticado?: string; isAdmin?: boolean }) {
  const trpcUtils = trpc.useUtils();
  const enviarLoteBase = trpc.cemag.uploadBaseChunk.useMutation();
  const publicarBase = trpc.cemag.publishSharedBase.useMutation();
  const descartarEnvioBase = trpc.cemag.discardSharedBaseUpload.useMutation();
  const [loading, setLoading] = useState<boolean>(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [mensagemUpload, setMensagemUpload] = useState<{ tipo: "sucesso" | "aviso" | "erro"; texto: string } | null>(null);
  const [baseOriginal, setBaseOriginal] = useState<any[]>([]);
  const [nomeArquivoBase, setNomeArquivoBase] = useState<string>("data/tabelaFaturamento.csv");
  const [abaAtiva, setAbaAtiva] = useState<string>("visao_geral");
  const [grupoAbaAtivo, setGrupoAbaAtivo] = useState<string>("resumo");
  const [ufMapaSelecionada, setUfMapaSelecionada] = useState<string | null>(null);
  const [sidebarOculta, setSidebarOculta] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("cemag_sidebar_oculta");
    return saved === null ? true : saved === "true";
  });
  const [visualizacaoExpandida, setVisualizacaoExpandida] = useState<boolean>(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [chatMensagens, setChatMensagens] = useState<Message[]>([]);
  const chatMutation = trpc.ai.chat.useMutation();

  const navegarParaAba = (id: string) => {
    setAbaAtiva(id);
    const grupo = GRUPOS_ABAS.find((item) => item.abas.some((aba) => aba.id === id));
    if (grupo) setGrupoAbaAtivo(grupo.id);
  };

  useEffect(() => {
    window.localStorage.setItem("cemag_sidebar_oculta", String(sidebarOculta));
  }, [sidebarOculta]);

  useEffect(() => {
    if (sidebarOculta) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOculta(true);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOculta]);

  // Filtros Globais
  const [filtros, setFiltros] = useState<FiltrosState>({
    dataInicio: "2022-01-01",
    dataFim: "",
    considerarTodasFormas: false,
    tiposVendaSelecionados: ["V ProdPrÃ³pria p Consumo"],
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
    cores: [],
    buscaProduto: "",
  });

  // A base publicada no servidor Ã© a fonte compartilhada para todas as contas.
  useEffect(() => {
    async function carregarBaseInicial() {
      try {
        setLoading(true);
        const baseCompartilhada = await trpcUtils.cemag.sharedBase.fetch();
        if (baseCompartilhada?.rowCount) {
          const rows: any[] = [];
          const tamanhoLote = 1000;
          for (let offset = 0; offset < baseCompartilhada.rowCount; offset += tamanhoLote) {
            const lote = await trpcUtils.cemag.sharedBaseRows.fetch({ version: baseCompartilhada.version, offset, limit: tamanhoLote });
            rows.push(...lote.map((item) => JSON.parse(item.payload)));
          }
          setBaseOriginal(rows);
          setNomeArquivoBase(baseCompartilhada.fileName);
          return;
        }
        const resp = await fetch("/data/tabelaFaturamento.csv");
        if (!resp.ok) throw new Error("NÃ£o foi possÃ­vel carregar a base padrÃ£o /data/tabelaFaturamento.csv");
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
  }, [trpcUtils]);

  // Preparar os dados tratados com as regras CEMAG
  const { dados, meta } = useMemo(() => {
    if (!baseOriginal.length) return { dados: [], meta: { linhas_validas: 0 } };
    return prepararDados(baseOriginal, CLIENTE_INFO_OVERRIDE);
  }, [baseOriginal]);

  useEffect(() => {
    if (!meta?.data_min || !meta?.data_max) return;
    try {
      localStorage.setItem("cemag_base_periodo", JSON.stringify({
        dataInicio: meta.data_min.toISOString().slice(0, 10),
        dataFim: meta.data_max.toISOString().slice(0, 10),
        anoInicio: meta.data_min.getFullYear(),
        anoFim: meta.data_max.getFullYear(),
      }));
    } catch {
      // A visualizaÃ§Ã£o continua funcionando mesmo se o armazenamento local estiver indisponÃ­vel.
    }
  }, [meta?.data_min, meta?.data_max]);

  // Inicializar datas de perÃ­odo quando a base for carregada
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

  // OpÃ§Ãµes para a barra lateral
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
        cores: [],
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
      cores: setOf("cor") as string[],
    };
  }, [dados]);

  // AplicaÃ§Ã£o estrita de todos os filtros
  const dadosFiltrados = useMemo(() => {
    if (!dados.length) return [];

    return dados.filter((d) => {
      // PerÃ­odo
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

      // ExclusÃµes de famÃ­lias
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
      if (filtros.cores.length > 0 && !filtros.cores.includes(d.cor)) return false;

      // Busca textual
      if (filtros.buscaProduto.trim()) {
        const termo = filtros.buscaProduto.trim().toLowerCase();
        if (!d.produto.toLowerCase().includes(termo)) return false;
      }

      return true;
    });
  }, [dados, filtros]);

  // A previsÃ£o mantÃ©m os filtros comerciais ativos, mas usa o perÃ­odo configurado nesta aba.
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
      if (filtros.cores.length > 0 && !filtros.cores.includes(d.cor)) return false;
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
    if (!isAdmin) {
      setMensagemUpload({ tipo: "aviso", texto: "Somente a conta administradora pode publicar uma nova base." });
      return;
    }
    const nome = file.name.toLowerCase();
    const reader = new FileReader();
    setMensagemUpload({ tipo: "aviso", texto: `Lendo ${file.name}...` });

    const concluirUpload = async (linhas: any[]) => {
      if (!linhas.length) {
        setMensagemUpload({ tipo: "erro", texto: "A planilha nÃ£o contÃ©m registros vÃ¡lidos." });
        return;
      }
      const versao = crypto.randomUUID();
      const tamanhoLote = 500;
      try {
        for (let inicio = 0; inicio < linhas.length; inicio += tamanhoLote) {
          const lote = linhas.slice(inicio, inicio + tamanhoLote).map((linha, indice) => ({ rowNumber: inicio + indice + 1, payload: JSON.stringify(linha) }));
          await enviarLoteBase.mutateAsync({ version: versao, rows: lote });
          setMensagemUpload({ tipo: "aviso", texto: `Enviando base compartilhada: ${Math.min(inicio + lote.length, linhas.length).toLocaleString("pt-BR")} de ${linhas.length.toLocaleString("pt-BR")} registros...` });
        }
        await publicarBase.mutateAsync({ version: versao, fileName: file.name, rowCount: linhas.length, dimensions: Object.keys(linhas[0] || {}).slice(0, 250) });
        setBaseOriginal(linhas);
        setNomeArquivoBase(file.name);
        setMensagemUpload({ tipo: "sucesso", texto: `${file.name} publicada para todos os usuÃ¡rios (${linhas.length.toLocaleString("pt-BR")} registros).` });
        await trpcUtils.cemag.sharedBase.invalidate();
      } catch (error: any) {
        try { await descartarEnvioBase.mutateAsync({ version: versao }); } catch { /* o envio pode jÃ¡ ter sido publicado */ }
        setMensagemUpload({ tipo: "erro", texto: `NÃ£o foi possÃ­vel publicar a base compartilhada: ${error?.message || "erro no servidor"}. A base anterior continua disponÃ­vel.` });
      }
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
            concluirUpload(json);
          } else setMensagemUpload({ tipo: "erro", texto: "O arquivo Excel nÃ£o contÃ©m registros vÃ¡lidos." });
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
            concluirUpload(parsed.data);
          } else setMensagemUpload({ tipo: "erro", texto: "O arquivo CSV nÃ£o contÃ©m registros vÃ¡lidos." });
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
        tiposVendaSelecionados: ["V ProdPrÃ³pria p Consumo"],
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
        cores: [],
        buscaProduto: "",
      });
    }
  };

  // --------------------------------------------------------------------------
  // ESTADOS ESPECÃFICOS DE ABAS
  // --------------------------------------------------------------------------

  // VisÃ£o Geral: mÃ©trica escolhida
  const [metricaVisao, setMetricaVisao] = useState<string>("Faturamento");

  // Modo ApresentaÃ§Ã£o: tema, mÃ©trica, topN
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

  // MÃªs x MÃªs
  const [metricaMoM, setMetricaMoM] = useState<string>("Faturamento");
  const [mesesComparativoSelecionados, setMesesComparativoSelecionados] = useState<string[]>([]);
  const [temaDashboard, setTemaDashboard] = useState<"claro" | "black">(() => (localStorage.getItem("cemag_tema_dashboard") as "claro" | "black") || "black");
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState<"executivo" | "mensal" | "auditoria" | "produtos" | "clientes" | "territorial" | "metas" | "previsoes" | "tabelas">("executivo");
  const [relatorioDataInicio, setRelatorioDataInicio] = useState(() => filtros.dataInicio || "2022-01-01");
  const [relatorioDataFim, setRelatorioDataFim] = useState(() => filtros.dataFim || new Date().toISOString().slice(0, 10));
  const [produtoAnfaveaSelecionado, setProdutoAnfaveaSelecionado] = useState("TRATORES DE RODAS");

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

  // InteligÃªncia Comercial: sub-Ã¡rea
  const [subInteligencia, setSubInteligencia] = useState<string>("comparador");
  const [intelCompDim, setIntelCompDim] = useState<string>("cliente");
  const [intelCompMet, setIntelCompMet] = useState<string>("faturamento");
  const [intelDreDim, setIntelDreDim] = useState<string>("familia");
  const [intelCrossCliente, setIntelCrossCliente] = useState<string>("");

  // RegiÃµes
  const [metricaGeo, setMetricaGeo] = useState<string>("Faturamento");

  // Representantes
  const [metricaRep, setMetricaRep] = useState<string>("Faturamento");
  const [metricaPrevisao, setMetricaPrevisao] = useState<string>("Faturamento");
  const [horizontePrevisao, setHorizontePrevisao] = useState<number>(6);
  const [previsaoDataInicio, setPrevisaoDataInicio] = useState<string>("2022-01-01");
  const [previsaoDataFim, setPrevisaoDataFim] = useState<string>("");
  const [previsaoVisualizacaoInicio, setPrevisaoVisualizacaoInicio] = useState<string>("");
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
  const [cidadeFatoresExternos, setCidadeFatoresExternos] = useState<string>("Fortaleza");
  const [centralDataInicio, setCentralDataInicio] = useState<string>("2022-01-01");
  const [centralDataFim, setCentralDataFim] = useState<string>("");
  const [repEscolhido, setRepEscolhido] = useState<string>("");

  useEffect(() => {
    if (!meta?.data_min || !meta?.data_max) return;
    const minBase = meta.data_min.toISOString().slice(0, 10);
    const maxBase = meta.data_max.toISOString().slice(0, 10);
    if (previsaoDataInicio === "2022-01-01" && minBase > previsaoDataInicio) setPrevisaoDataInicio(minBase);
    if (!previsaoDataFim) setPrevisaoDataFim(maxBase);
    if (centralDataInicio === "2022-01-01" && minBase > centralDataInicio) setCentralDataInicio(minBase);
    if (!centralDataFim) setCentralDataFim(maxBase);
  }, [centralDataFim, centralDataInicio, meta, previsaoDataFim, previsaoDataInicio]);

  // Base tratada: colunas visÃ­veis
  const [colunasBaseTratada, setColunasBaseTratada] = useState<string[]>([
    "pedido", "data_str", "cliente", "cidade", "uf", "representante",
    "produto", "familia", "quantidade", "faturamento", "tipo_venda"
  ]);

  // ExportaÃ§Ãµes
  const [exportGranularidade, setExportGranularidade] = useState<string>("Mensal");
  const [exportMetrica, setExportMetrica] = useState<string>("Faturamento");
  const [exportDimensao, setExportDimensao] = useState<string>("Nenhum");
  const [exportModo, setExportModo] = useState<string>("prontas");
  const [exportTipo, setExportTipo] = useState<string>("Resumo mensal");

  // Metas mensais: CSV histÃ³rico + meta manual do mÃªs vigente
  type MetaMensal = { ano: number; mes: number; meta: number; origem?: string };
  const hoje = new Date();
  const [metasImportadas, setMetasImportadas] = useState<MetaMensal[]>([]);
  const [metaManualAno, setMetaManualAno] = useState<number>(hoje.getFullYear());
  const [metaManualMes, setMetaManualMes] = useState<number>(hoje.getMonth() + 1);
  const [metaManualValor, setMetaManualValor] = useState<string>("");
  const [metaManualSalva, setMetaManualSalva] = useState<MetaMensal | null>(null);
  const [metaStatus, setMetaStatus] = useState<string>("");
  // Filtros exclusivos da anÃ¡lise de metas. Vazios significam toda a base.
  const [metaDataInicio, setMetaDataInicio] = useState<string>("");
  const [metaDataFim, setMetaDataFim] = useState<string>("");
  const [metaTiposProduto, setMetaTiposProduto] = useState<string[]>([]);
  const [metaTiposVenda, setMetaTiposVenda] = useState<string[]>([]);
  const [metaRegioes, setMetaRegioes] = useState<string[]>([]);
  const [metaUfs, setMetaUfs] = useState<string[]>([]);
  const [metaRepresentantes, setMetaRepresentantes] = useState<string[]>([]);
  const [metaClientes, setMetaClientes] = useState<string[]>([]);

  useEffect(() => {
    const carregarMetas = async () => {
      try {
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
  }, []);

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
        setMetaStatus(`${unicas.length} meta(s) importada(s) e salva(s) neste navegador.`);
      } catch (err: any) { setMetaStatus(`Erro ao ler metas: ${err.message || "arquivo invÃ¡lido"}`); }
    };
    reader.readAsText(file);
  };

  const salvarMetaManual = () => {
    if (!isAdmin) { setMetaStatus("Somente a conta administradora pode atualizar a meta central."); return; }
    const valor = Number(String(metaManualValor).replace(/\./g, "").replace(",", "."));
    if (!valor || valor < 0 || !metaManualAno || !metaManualMes) { setMetaStatus("Informe ano, mÃªs e uma meta vÃ¡lida."); return; }
    const meta: MetaMensal = { ano: metaManualAno, mes: metaManualMes, meta: valor, origem: "Manual â€” mÃªs vigente" };
    setMetaManualSalva(meta); localStorage.setItem("cemag_meta_manual_vigente", JSON.stringify(meta)); setMetaStatus("Meta manual salva neste navegador.");
  };

  const limparMetas = () => {
    if (!isAdmin) { setMetaStatus("Somente a conta administradora pode limpar as metas centrais."); return; }
    setMetasImportadas([]); setMetaManualSalva(null); setMetaManualValor(""); localStorage.removeItem("cemag_metas_mensais"); localStorage.removeItem("cemag_meta_manual_vigente"); setMetaStatus("Metas removidas deste navegador.");
  };

  // --------------------------------------------------------------------------
  // CÃLCULOS DERIVADOS POR ABA
  // --------------------------------------------------------------------------

  // Dados agregados por mÃªs para grÃ¡ficos de linha
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
      ["RegiÃµes", "regiao"],
      ["Representantes", "representante"],
      ["Tipos de venda", "tipo_venda"],
      ["Tipos de produto", "tipo_produto"],
    ] as const;
    return dimensoes.map(([dimensao, chave]) => {
      const a = new Map(agregar(dadosMesComparativoA, [chave]).map((row: any) => [String(row[chave] || "NÃ£o informado"), valorMetrica(row, metricaMoM)]));
      const b = new Map(agregar(dadosMesComparativoB, [chave]).map((row: any) => [String(row[chave] || "NÃ£o informado"), valorMetrica(row, metricaMoM)]));
      const itens = Array.from(new Set([...a.keys(), ...b.keys()])).map((item) => {
        const valorA = a.get(item) || 0;
        const valorB = b.get(item) || 0;
        const variacao = calcularVariacaoComparativo(valorA, valorB);
        return { dimensao, item, valor_a: valorA, valor_b: valorB, delta: variacao.delta, variacao_pct: variacao.percentual };
      }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
      return { dimensao, itens };
    });
  }, [dadosMesComparativoA, dadosMesComparativoB, metricaMoM]);

  // A anÃ¡lise de metas mostra todo o histÃ³rico disponÃ­vel, sem obedecer ao perÃ­odo global.
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

  const cidadesFatoresExternos = opcoesFiltros.cidades.length ? opcoesFiltros.cidades : ["Fortaleza"];
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
    const uf = dados.find((item) => item.cidade === cidadeFatoresExternos)?.uf || (cidadeFatoresExternos === "Fortaleza" ? "CE" : undefined);
    return cidadeFatoresExternos ? [{ cidade: cidadeFatoresExternos, uf }] : [];
  }, [abrangenciaFatores, cidadesSelecionadasFatores, cidadeFatoresExternos, dados, regiaoFatores, ufsFatores]);
  const descricaoAbrangenciaFatores = abrangenciaFatores === "brasil" ? "Brasil â€” capitais dos 27 estados" : abrangenciaFatores === "regiao" ? `${regiaoFatores} â€” capitais dos estados com clientes` : abrangenciaFatores === "uf" ? `Estados selecionados â€” ${ufsFatores.join(", ") || "nenhum estado"}` : abrangenciaFatores === "clientes" ? `Cidades dos clientes â€” ${localidadesFatoresSelecionadas.length} localidades` : cidadeFatoresExternos || "Fortaleza/CE (padrÃ£o)";
  const fatoresExternosInput = useMemo(() => ({
    dataInicio: abaAtiva === "central_externa" ? centralDataInicio : filtros.dataInicio || meta?.data_min?.toISOString().slice(0, 10) || "2022-01-01",
    dataFim: abaAtiva === "central_externa" ? centralDataFim : filtros.dataFim || meta?.data_max?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10),
    cidade: abrangenciaFatores === "cidade" ? cidadeFatoresExternos : "Brasil",
    uf: abrangenciaFatores === "cidade" ? localidadesFatoresSelecionadas[0]?.uf : undefined,
    localidades: abrangenciaFatores === "cidade" ? undefined : localidadesFatoresSelecionadas,
    descricaoAbrangencia: descricaoAbrangenciaFatores,
  }), [abrangenciaFatores, centralDataFim, centralDataInicio, cidadeFatoresExternos, descricaoAbrangenciaFatores, filtros.dataInicio, filtros.dataFim, localidadesFatoresSelecionadas, meta?.data_min, meta?.data_max, abaAtiva]);
  const fatoresExternosQuery = trpc.cemag.fatoresExternos.useQuery(fatoresExternosInput, {
    enabled: (abaAtiva === "previsoes" || abaAtiva === "previsoes_agro" || abaAtiva === "central_externa") && localidadesFatoresSelecionadas.length > 0,
    retry: false,
    staleTime: 15 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const statusFontesExternas = useMemo(() => {
    const resultado = fatoresExternosQuery.data;
    const fontes = resultado?.fontes || [];
    const avisos = resultado?.avisos || [];
    const verificar = (nome: string, palavras: string[]) => {
      const ok = fontes.some((fonte) => palavras.some((palavra) => fonte.toLowerCase().includes(palavra.toLowerCase())));
      const aviso = avisos.some((item) => palavras.some((palavra) => item.toLowerCase().includes(palavra.toLowerCase())));
      return ok ? "ok" : aviso ? "aviso" : "nÃ£o consultada";
    };
    return [
      { nome: "Selic / BCB", status: verificar("Selic", ["selic", "Banco Central"]) },
      { nome: "Chuva / NASA", status: verificar("NASA", ["NASA", "Chuva"]) },
      { nome: "PrevisÃ£o / Open-Meteo", status: verificar("Open-Meteo", ["Open-Meteo", "Chuva"]) },
      { nome: "Sazonal / CPTEC", status: verificar("CPTEC", ["CPTEC", "sazonal"]) },
      { nome: "ProduÃ§Ã£o / IBGE", status: verificar("IBGE", ["IBGE", "produÃ§Ã£o"]) },
      { nome: "Commodities", status: verificar("commodities", ["Yahoo Finance", "commodities"]) },
      { nome: "MÃ¡quinas / ANFAVEA", status: resultado?.mercado_maquinas_anfavea.status === "consultado" ? "ok" : resultado?.mercado_maquinas_anfavea.status === "indisponivel" ? "aviso" : "nÃ£o consultada" },
      { nome: "CrÃ©dito / SICOR", status: resultado?.indicadores_agro.credito_status === "consultado" ? "ok" : resultado?.indicadores_agro.credito_status === "indisponivel" ? "aviso" : "nÃ£o consultada" },
    ] as Array<{ nome: string; status: "ok" | "aviso" | "nÃ£o consultada" }>;
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
  const mercadoMaquinasAnfavea = fatoresExternosQuery.data?.mercado_maquinas_anfavea;
  const resumoAnfaveaPorAno = useMemo(() => {
    const porAno = new Map<string, { ano: string; maquina: string; unidades: number }>();
    for (const item of mercadoMaquinasAnfavea?.series || []) {
      const ano = item.ano_mes.slice(0, 4);
      const chave = `${ano}|${item.maquina}`;
      const atual = porAno.get(chave) || { ano, maquina: item.maquina, unidades: 0 };
      atual.unidades += Number(item.unidades || 0);
      porAno.set(chave, atual);
    }
    return Array.from(porAno.values()).sort((a, b) => a.ano.localeCompare(b.ano) || a.maquina.localeCompare(b.maquina));
  }, [mercadoMaquinasAnfavea?.series]);
  const periodoAnfavea = useMemo(() => {
    const periodos = (mercadoMaquinasAnfavea?.series || []).map((item) => item.ano_mes).sort();
    return periodos.length ? `${periodos[0]} a ${periodos.at(-1)}` : "ainda nÃ£o disponÃ­vel";
  }, [mercadoMaquinasAnfavea?.series]);
  const produtosAnfavea = useMemo(() => Array.from(new Set((mercadoMaquinasAnfavea?.series || []).map((item) => item.maquina))).sort((a, b) => a.localeCompare(b)), [mercadoMaquinasAnfavea?.series]);
  const rotuloProdutoAnfavea = (produto: string) => produto === "TOTAL AGRICOLAS" ? "Total â€” mÃ¡quinas agrÃ­colas" : produto === "TOTAL RODOVIARIAS" ? "Total â€” mÃ¡quinas rodoviÃ¡rias" : produto === "TOTAL" ? "Total â€” categoria informada pela ANFAVEA" : produto;
  useEffect(() => {
    setProdutoAnfaveaSelecionado((atual) => atual && produtosAnfavea.includes(atual) ? atual : (produtosAnfavea[0] || ""));
  }, [produtosAnfavea]);
  const serieAnfaveaFiltrada = useMemo(() => (mercadoMaquinasAnfavea?.series || []).filter((item) => item.maquina === produtoAnfaveaSelecionado), [mercadoMaquinasAnfavea?.series, produtoAnfaveaSelecionado]);
  const resumoAnfaveaFiltrado = useMemo(() => resumoAnfaveaPorAno.filter((item) => item.maquina === produtoAnfaveaSelecionado), [resumoAnfaveaPorAno, produtoAnfaveaSelecionado]);
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
      componentes.push({ nome: "Chuva de curto prazo", valor: ajuste, explicacao: `${mediaChuva.toFixed(1)} mm/dia em mÃ©dia nos dias consultados` });
    }
    const selicHistorica = dadosExternos.meses.map((item) => Number(item.selic_media_pct)).filter(Number.isFinite).at(-1);
    const selicFutura = expectativasSelicFuturas.map((item) => Number(item.mediana_pct ?? item.media_pct)).filter(Number.isFinite);
    if (selicHistorica != null && selicFutura.length) {
      const mediaFutura = selicFutura.reduce((sum, value) => sum + value, 0) / selicFutura.length;
      const ajuste = mediaFutura <= selicHistorica - 0.5 ? 8 : mediaFutura >= selicHistorica + 0.5 ? -8 : 0;
      pontuacao += ajuste;
      componentes.push({ nome: "Juros futuros", valor: ajuste, explicacao: `Focus ${mediaFutura.toFixed(2)}% versus Selic histÃ³rica ${selicHistorica.toFixed(2)}%` });
    }
    const sinais = previsaoSazonal.map((item) => Number(item.valor_sinal)).filter(Number.isFinite);
    if (sinais.length) {
      const sinal = sinais.reduce((sum, value) => sum + value, 0) / sinais.length;
      const ajuste = sinal > 0.15 ? 6 : sinal < -0.15 ? -6 : 0;
      pontuacao += ajuste;
      componentes.push({ nome: "Sinal climÃ¡tico sazonal", valor: ajuste, explicacao: sinal > 0.15 ? "predominÃ¢ncia acima do normal" : sinal < -0.15 ? "predominÃ¢ncia abaixo do normal" : "sem sinal predominante" });
    }
    const credito = dadosExternos.indicadores_agro.credito_status;
    if (credito === "consultado") pontuacao += 5;
    if (credito === "indisponivel") pontuacao -= 5;
    componentes.push({ nome: "CrÃ©dito rural", valor: credito === "consultado" ? 5 : credito === "indisponivel" ? -5 : 0, explicacao: `status ${credito}` });
    const score = Math.max(0, Math.min(100, Math.round(pontuacao)));
    const classe = score >= 65 ? "favorÃ¡vel" : score <= 35 ? "atenÃ§Ã£o" : "neutro";
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
    // Pedidos e clientes Ãºnicos por UF
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
  const seriePrevisaoVisivel = useMemo(() => {
    if (!previsaoVisualizacaoInicio) return previsaoMensal.serie;
    return previsaoMensal.serie.filter((item) => item.ano_mes >= previsaoVisualizacaoInicio.slice(0, 7));
  }, [previsaoMensal.serie, previsaoVisualizacaoInicio]);
  const explicacaoPrevisoes = useMemo(() => seriePrevisaoVisivel.filter((item) => item.tipo === "Previsão").map((item) => {
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
      explicacao: `ProvÃ¡vel = tendÃªncia + sazonalidade; Conservador = provÃ¡vel - ${(margem * 100).toFixed(1)}%; Otimista = provÃ¡vel + ${(margem * 100).toFixed(1)}%. Faixa baseada no erro histÃ³rico.`,
    };
  }), [seriePrevisaoVisivel, metricaPrevisao]);
  const explicacoesHistorico = useMemo(() => {
    const mesesExternos = fatoresExternosQuery.data?.meses || [];
    const chuvas = mesesExternos.map((item) => Number(item.chuva_mm)).filter(Number.isFinite);
    const selics = mesesExternos.map((item) => Number(item.selic_media_pct)).filter(Number.isFinite);
    const mediaChuva = chuvas.length ? chuvas.reduce((sum, value) => sum + value, 0) / chuvas.length : null;
    const mediaSelic = selics.length ? selics.reduce((sum, value) => sum + value, 0) / selics.length : null;
    const porMes = new Map<string, { faturamento: number; quantidade: number; pedidos: number; clientes: number }>();
    for (const row of dadosPrevisao) {
      const atual = porMes.get(row.ano_mes) || { faturamento: 0, quantidade: 0, pedidos: 0, clientes: 0 };
      atual.faturamento += Number(row.faturamento || 0);
      atual.quantidade += Number(row.quantidade || 0);
      porMes.set(row.ano_mes, atual);
    }
    for (const [mes, linhas] of new Map(Array.from(porMes.keys()).map((mes) => [mes, dadosPrevisao.filter((row) => row.ano_mes === mes)]))) {
      const atual = porMes.get(mes)!;
      atual.pedidos = new Set(linhas.map((row) => row.pedido)).size;
      atual.clientes = new Set(linhas.map((row) => row.cliente)).size;
    }
    const metricValue = (row: { faturamento: number; quantidade: number; pedidos: number; clientes: number } | undefined) => {
      if (!row) return null;
      if (metricaPrevisao === "Quantidade") return row.quantidade;
      if (metricaPrevisao === "Pedidos") return row.pedidos;
      if (metricaPrevisao === "Clientes") return row.clientes;
      return row.faturamento;
    };
    const metricRows = (rows: TransacaoTratada[], dimension: "tipo_produto" | "cliente" | "representante") => {
      const grupos = new Map<string, TransacaoTratada[]>();
      rows.forEach((row) => { const chave = row[dimension] || "NÃ£o informado"; grupos.set(chave, [...(grupos.get(chave) || []), row]); });
      return Array.from(grupos.entries()).map(([chave, itens]) => ({ chave, valor: metricValue({ faturamento: itens.reduce((s, r) => s + Number(r.faturamento || 0), 0), quantidade: itens.reduce((s, r) => s + Number(r.quantidade || 0), 0), pedidos: new Set(itens.map((r) => r.pedido)).size, clientes: new Set(itens.map((r) => r.cliente)).size }) || 0 }));
    };
    const topContribuicoes = (rowsAtual: TransacaoTratada[], rowsAnterior: TransacaoTratada[], dimension: "tipo_produto" | "cliente" | "representante") => {
      const atual = new Map(metricRows(rowsAtual, dimension).map((item) => [item.chave, item.valor]));
      const anterior = new Map(metricRows(rowsAnterior, dimension).map((item) => [item.chave, item.valor]));
      return Array.from(new Set([...atual.keys(), ...anterior.keys()])).map((chave) => ({ chave, delta: (atual.get(chave) || 0) - (anterior.get(chave) || 0) })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3).map((item) => `${item.chave}: ${item.delta >= 0 ? "+" : ""}${formatarMetrica(item.delta, metricaPrevisao)}`).join(" | ");
    };
    const chaves = Array.from(porMes.keys()).sort();
    return seriePrevisaoVisivel.filter((item) => item.realizado != null && item.previsao_retroativa != null).map((item) => {
      const realizado = Number(item.realizado || 0);
      const previsto = Number(item.previsao_retroativa || 0);
      const variacao = previsto ? ((realizado - previsto) / previsto) * 100 : null;
      const indice = chaves.indexOf(item.ano_mes);
      const mesAnterior = indice > 0 ? metricValue(porMes.get(chaves[indice - 1])) : null;
      const variacaoAnterior = mesAnterior != null && mesAnterior !== 0 ? ((realizado - mesAnterior) / mesAnterior) * 100 : null;
      const mesNumero = Number(item.ano_mes.split("-")[1]);
      const mesmosMeses = chaves.filter((chave) => Number(chave.split("-")[1]) === mesNumero && chave !== item.ano_mes).map((chave) => metricValue(porMes.get(chave))).filter((value): value is number => value != null && Number.isFinite(value));
      const mediaMesmoMes = mesmosMeses.length ? mesmosMeses.reduce((sum, value) => sum + value, 0) / mesmosMeses.length : null;
      const variacaoMesmoMes = mediaMesmoMes != null && mediaMesmoMes !== 0 ? ((realizado - mediaMesmoMes) / mediaMesmoMes) * 100 : null;
      const comercial = porMes.get(item.ano_mes);
      const linhasMes = dadosPrevisao.filter((row) => row.ano_mes === item.ano_mes);
      const linhasAnterior = indice > 0 ? dadosPrevisao.filter((row) => row.ano_mes === chaves[indice - 1]) : [];
      const externo = mesesExternos.find((mes) => mes.ano_mes === item.ano_mes);
      const chuva = externo && Number.isFinite(Number(externo.chuva_mm)) ? Number(externo.chuva_mm) : null;
      const selic = externo && Number.isFinite(Number(externo.selic_media_pct)) ? Number(externo.selic_media_pct) : null;
      const sinais: string[] = [];
      if (variacao != null) sinais.push(variacao >= 10 ? "ficou acima do esperado pelo modelo" : variacao <= -10 ? "ficou abaixo do esperado pelo modelo" : "ficou prÃ³ximo do esperado pelo modelo");
      if (variacaoAnterior != null && Math.abs(variacaoAnterior) >= 10) sinais.push(`${variacaoAnterior >= 0 ? "crescimento" : "queda"} de ${Math.abs(variacaoAnterior).toFixed(1)}% contra o mÃªs anterior`);
      if (variacaoMesmoMes != null && Math.abs(variacaoMesmoMes) >= 10) sinais.push(`${variacaoMesmoMes >= 0 ? "desempenho acima" : "desempenho abaixo"} da mÃ©dia do mesmo mÃªs em anos anteriores`);
      if (comercial && metricaPrevisao === "Faturamento" && comercial.quantidade > 0) sinais.push(`ticket mÃ©dio aproximado de ${formatarMoeda(comercial.faturamento / comercial.quantidade)}`);
      if (chuva != null && mediaChuva != null) sinais.push(chuva >= mediaChuva * 1.2 ? "chuva acima da mÃ©dia consultada" : chuva <= mediaChuva * 0.8 ? "chuva abaixo da mÃ©dia consultada" : "chuva prÃ³xima da mÃ©dia consultada");
      if (selic != null && mediaSelic != null) sinais.push(selic >= mediaSelic + 0.5 ? "Selic acima da mÃ©dia consultada" : selic <= mediaSelic - 0.5 ? "Selic abaixo da mÃ©dia consultada" : "Selic prÃ³xima da mÃ©dia consultada");
      const confianca = linhasMes.length >= 5 && (variacaoAnterior != null || variacaoMesmoMes != null) ? (chuva != null || selic != null ? "MÃ©dia" : "Alta") : "Baixa";
      return { mes: item.ano_mes, realizado, previsto_retroativo: previsto, variacao_vs_previsto_pct: variacao, variacao_vs_mes_anterior_pct: variacaoAnterior, variacao_vs_media_mes_historico_pct: variacaoMesmoMes, quantidade: comercial?.quantidade ?? null, pedidos: comercial?.pedidos ?? null, clientes: comercial?.clientes ?? null, chuva_mm: chuva, selic_media_pct: selic, principais_tipos: topContribuicoes(linhasMes, linhasAnterior, "tipo_produto"), principais_clientes: topContribuicoes(linhasMes, linhasAnterior, "cliente"), principais_representantes: topContribuicoes(linhasMes, linhasAnterior, "representante"), confianca_explicacao: confianca, leitura: sinais.length ? sinais.join("; ") + "." : "Sem sinais comerciais ou fatores externos suficientes para sugerir uma explicaÃ§Ã£o." };
    });
  }, [dadosPrevisao, fatoresExternosQuery.data?.meses, metricaPrevisao, seriePrevisaoVisivel]);
  const ultimoMesParcial = useMemo(() => {
    const vigente = previsaoMensal.serie.find((item) => item.mes_vigente);
    return vigente ? { ano_mes: vigente.ano_mes, parcial: vigente.realizado_parcial, fechamento: vigente.estimativa_fechamento, referencia_historica_mes: vigente.referencia_historica_mes, dias_decorridos: vigente.dias_decorridos, dias_periodo: vigente.dias_periodo } : null;
  }, [previsaoMensal]);

  const diagnosticoBase = useMemo(() => {
    const { dataMin, dataMax } = dadosFiltrados.reduce<{ dataMin?: Date; dataMax?: Date }>((range, item) => {
      const date = item.data_emissao;
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return range;
      if (!range.dataMin || date < range.dataMin) range.dataMin = date;
      if (!range.dataMax || date > range.dataMax) range.dataMax = date;
      return range;
    }, {});
    const mesesEsperados: string[] = [];
    if (dataMin && dataMax) {
      const cursor = new Date(dataMin.getFullYear(), dataMin.getMonth(), 1);
      const fim = new Date(dataMax.getFullYear(), dataMax.getMonth(), 1);
      while (cursor <= fim) {
        mesesEsperados.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const mesesComVenda = new Set(dadosFiltrados.map((d) => d.ano_mes));
    const mesesSemVenda = mesesEsperados.filter((mes) => !mesesComVenda.has(mes));
    const anual = agregar(dadosFiltrados, ["ano"]).sort((a, b) => a.ano - b.ano);
    return {
      mesesEsperados,
      mesesSemVenda,
      anual,
      qtdNaoPositiva: dadosFiltrados.filter((d) => d.quantidade <= 0).length,
      faturamentoNaoPositivo: dadosFiltrados.filter((d) => d.faturamento <= 0).length,
      ufNaoIdentificada: dadosFiltrados.filter((d) => !d.uf || d.uf === "NÃ£o identificado").length,
      cidadeNaoIdentificada: dadosFiltrados.filter((d) => !d.cidade || d.cidade === "NÃ£o identificado").length,
      produtoNaoInformado: dadosFiltrados.filter((d) => !d.produto || d.produto === "NÃ£o informado").length,
      clienteNaoInformado: dadosFiltrados.filter((d) => !d.cliente || d.cliente === "NÃ£o informado").length,
    };
  }, [dadosFiltrados]);

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
      Conjunto: "Texto contÃ©m CONJUNTO ou KIT",
      Peça: "DescriÃ§Ã£o contÃ©m peÃ§a, eixo, roda, pneu, motor, acessÃ³rio e termos similares",
      Sucata: "CÃ³digo 00000 ou texto contÃ©m sucata/salvado",
      "Itens comprados": "CÃ³digo do produto comeÃ§a com 2",
      Outros: "NÃ£o atendeu Ã s regras especÃ­ficas anteriores",
    };
    return Array.from(mapa.values()).map((item) => ({
      tipo_produto: item.tipo_produto,
      criterio: criterio[item.tipo_produto] || "Regra de classificaÃ§Ã£o aplicada",
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

  // Formas de venda texto para exibiÃ§Ã£o
  const formasVendaTexto = filtros.considerarTodasFormas
    ? "Todas"
    : filtros.tiposVendaSelecionados.join(", ") || "Nenhuma";
  const familiasExcluidasTexto = filtros.familiasExcluidas.length
    ? filtros.familiasExcluidas.join(", ")
    : "Nenhuma";

  const formatarDataResumo = (valor: Date | string | undefined) => {
    if (!valor) return "â€”";
    const data = valor instanceof Date ? valor : new Date(`${valor}T00:00:00`);
    return Number.isNaN(data.getTime()) ? "â€”" : data.toLocaleDateString("pt-BR");
  };
  const periodoBaseTexto = `${formatarDataResumo(meta?.data_min)} a ${formatarDataResumo(meta?.data_max)}`;
  const periodoFiltroTexto = `${formatarDataResumo(filtros.dataInicio)} a ${formatarDataResumo(filtros.dataFim)}`;
  const periodoEfetivo = useMemo(() => {
    if (!dadosFiltrados.length) return "Nenhum registro";
    const datas = dadosFiltrados.map((d) => d.data_emissao).filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
    return `${formatarDataResumo(datas[0])} a ${formatarDataResumo(datas[datas.length - 1])}`;
  }, [dadosFiltrados]);

  const enviarMensagemChat = (content: string) => {
    if (chatMutation.isPending || !content.trim()) return;
    const novasMensagens: Message[] = [...chatMensagens, { role: "user", content: content.trim() }];
    setChatMensagens(novasMensagens);
    const mensagensParaServidor = novasMensagens
      .filter((item): item is { role: "user" | "assistant"; content: string } => item.role !== "system")
      .slice(-16)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    chatMutation.mutate({ messages: mensagensParaServidor }, {
      onSuccess: (resposta) => setChatMensagens((atual) => [...atual, { role: "assistant", content: resposta.content, suggestions: resposta.suggestions }]),
      onError: () => setChatMensagens((atual) => [...atual, { role: "assistant", content: "NÃ£o consegui consultar o assistente agora. Verifique a conexÃ£o e tente novamente.", suggestions: [] }]),
    });
  };
  // Resumo rÃ¡pido para decisÃµes: usa o Ãºltimo mÃªs disponÃ­vel no filtro e compara
  // automaticamente com o mesmo mÃªs do ano anterior.
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
      for (const item of registrosAtual) { const nome = String(item[campo] || "NÃ£o informado"); mapa.set(nome, (mapa.get(nome) || 0) + item.faturamento); }
      return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])[0] || ["â€”", 0] as [string, number];
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
    const agruparTodos = (campo: keyof TransacaoTratada) => {
      const mapa = new Map<string, { nome: string; faturamento: number; quantidade: number; pedidos: number; clientes: number }>();
      linhasRelatorio.forEach((item) => {
        const nome = String(item[campo] || "NÃ£o informado");
        const atual = mapa.get(nome) || { nome, faturamento: 0, quantidade: 0, pedidos: 0, clientes: 0 };
        atual.faturamento += Number(item.faturamento || 0);
        atual.quantidade += Number(item.quantidade || 0);
        mapa.set(nome, atual);
      });
      return Array.from(mapa.values()).map((item) => ({ ...item, pedidos: new Set(linhasRelatorio.filter((row) => String(row[campo] || "NÃ£o informado") === item.nome).map((row) => row.pedido)).size, clientes: new Set(linhasRelatorio.filter((row) => String(row[campo] || "NÃ£o informado") === item.nome).map((row) => row.cliente)).size })).sort((a, b) => b.faturamento - a.faturamento);
    };
    const agrupar = (campo: keyof TransacaoTratada) => agruparTodos(campo).slice(0, 10);
    return {
      totalFaturamento,
      totalQuantidade,
      pedidos: new Set(linhasRelatorio.map((item) => item.pedido).filter(Boolean)).size,
      clientes: new Set(linhasRelatorio.map((item) => item.cliente).filter(Boolean)).size,
      linhas: linhasRelatorio.length,
      topClientes: agrupar("cliente"),
      topProdutos: agrupar("produto"),
      topRegioes: agrupar("regiao"),
      todasTabelas: { produtos: agruparTodos("produto"), familias: agruparTodos("familia"), clientes: agruparTodos("cliente"), representantes: agruparTodos("representante"), regioes: agruparTodos("regiao"), ufs: agruparTodos("uf"), cidades: agruparTodos("cidade"), tipos: agruparTodos("tipo_produto"), formasVenda: agruparTodos("tipo_venda"), listasPreco: agruparTodos("lista_preco_uf"), cores: agruparTodos("cor"), gruposModelo: agruparTodos("grupo_modelo") },
      meses: Array.from(new Set(linhasRelatorio.map((item) => item.ano_mes))).sort().map((mes) => { const registros = linhasRelatorio.filter((item) => item.ano_mes === mes); return { mes, faturamento: registros.reduce((sum, item) => sum + item.faturamento, 0), quantidade: registros.reduce((sum, item) => sum + item.quantidade, 0), pedidos: new Set(registros.map((item) => item.pedido)).size, clientes: new Set(registros.map((item) => item.cliente)).size }; }).slice(-24),
    };
  }, [linhasRelatorio]);

  const infoAba = INFO_ABAS[abaAtiva] || { titulo: "Painel CEMAG", descricao: "AnÃ¡lise de inteligÃªncia comercial." };
  const sugestoesChat = useMemo(() => {
    const tipo = filtros.tiposProduto.length === 1 ? filtros.tiposProduto[0] : "produtos";
    return [
      "Qual cidade teve maior faturamento na base?",
      `Quais ${tipo.toLocaleLowerCase("pt-BR")} ou modelos foram mais vendidos na base?`,
      "Qual família de produtos lidera a base?",
      "Quais vendedores mais contribuíram para o faturamento da base?",
    ];
  }, [filtros.tiposProduto]);


  const filtrosVisiveis = useMemo(() => {
    const selections: Array<[string, string[]]> = [
      ["PerÃ­odo", [`${filtros.dataInicio ? new Date(`${filtros.dataInicio}T12:00:00`).toLocaleDateString("pt-BR") : "inÃ­cio"} â€“ ${filtros.dataFim ? new Date(`${filtros.dataFim}T12:00:00`).toLocaleDateString("pt-BR") : "hoje"}`]],
      ["Forma de venda", filtros.considerarTodasFormas ? ["Todas"] : filtros.tiposVendaSelecionados.length ? filtros.tiposVendaSelecionados : ["Nenhuma selecionada"]],
      ["FamÃ­lias excluÃ­das", filtros.familiasExcluidas],
      ["Ano", filtros.anos.map(String)],
      ["RegiÃ£o", filtros.regioes],
      ["UF", filtros.ufs],
      ["Cidade", filtros.cidades],
      ["Representante", filtros.representantes],
      ["Cliente", filtros.clientes],
      ["Cliente na base", filtros.clientesBase],
      ["Categoria", filtros.categorias],
      ["DescriÃ§Ã£o", filtros.descricoesGenericas],
      ["Grupo de modelo", filtros.gruposModelo],
      ["FamÃ­lia", filtros.familias],
      ["Tipo de produto", filtros.tiposProduto],
      ["Cor", filtros.cores],
      ["Lista de preÃ§o", filtros.listasPreco],
    ];
    const chips = selections.flatMap(([label, values]) => {
      if (!values.length) return [];
      const visible = values.slice(0, 2).join(", ");
      const extra = values.length > 2 ? ` +${values.length - 2}` : "";
      return [{ label, value: `${visible}${extra}` }];
    });
    if (filtros.buscaProduto.trim()) chips.push({ label: "Produto", value: filtros.buscaProduto.trim() });
    return chips;
  }, [filtros]);

  const percentualRegistrosFiltrados = meta?.linhas_validas
    ? Math.min(100, (dadosFiltrados.length / meta.linhas_validas) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Carregando painel analÃ­tico...</h2>
        <p className="text-sm text-slate-400 mt-2">Processando regras de faturamento, regiÃµes e clientes.</p>
      </div>
    );
  }

  return (
    <div className={`cemag-dashboard ${temaDashboard === "black" ? "tema-black" : ""} min-h-screen bg-[#f4f4f2] text-[#222222] flex flex-col font-sans`}>
      {!chatAberto && <button type="button" onClick={() => setChatAberto(true)} className="no-print fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-orange-500" title="Perguntar ao assistente CEMAG"><MessageCircle className="h-5 w-5" /> <span className="hidden sm:inline">Perguntar ao CEMAG</span></button>}
      {chatAberto && <div className="no-print fixed bottom-5 right-5 z-50 flex w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><MessageCircle className="h-4 w-4 text-orange-400" /> Assistente CEMAG</div><p className="mt-0.5 text-[10px] text-slate-400">Consulta a base completa; os filtros servem apenas como referÃªncia visual.</p></div><button type="button" onClick={() => setChatAberto(false)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" title="Fechar chat"><X className="h-4 w-4" /></button></div>
        <AIChatBox messages={chatMensagens} onSendMessage={enviarMensagemChat} isLoading={chatMutation.isPending} height={"min(68vh, 560px)"} emptyStateMessage="Pergunte sobre faturamento, clientes, produtos, metas ou regiÃµes." suggestedPrompts={sugestoesChat} placeholder="Ex.: qual regiÃ£o mais cresceu?" />
      </div>}
      {/* Top Header CEMAG */}
      <header className="cemag-topbar bg-[#111827] border-b border-slate-800 px-3 py-2.5 md:px-4 md:py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-2 md:gap-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <div className="cemag-brand-lockup flex min-w-0 items-center gap-2 md:gap-3">
              <div className="cemag-brand-mark rounded-lg bg-white px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm"><img src="/cemag-logo.svg" alt="CEMAG â€” Transportes AgrÃ­colas" className="h-7 w-auto max-w-[4.25rem] object-contain sm:h-8 sm:max-w-[9rem] md:h-9" /></div>
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="hidden sm:inline">InteligÃªncia Comercial</span>
                  <span className="sm:hidden">CEMAG Comercial</span>
                  <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    CEMAG Carretas AgrÃ­colas
                  </span>
                  {emailAutenticado && <span className={`hidden lg:inline-flex items-center rounded border px-2 py-0.5 text-[10px] ${isAdmin ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300"}`} title={emailAutenticado}>{isAdmin ? "Administrador" : "Consulta"}</span>}
                </h1>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Painel de inteligÃªncia de faturamento, clientes, regiÃµes e mix de carretas
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            {emailAutenticado && <span className="hidden xl:inline max-w-[220px] truncate text-[11px] text-slate-400" title={emailAutenticado}>{emailAutenticado}</span>}
            <button type="button" onClick={() => setSidebarOculta(false)} className="no-print flex min-h-10 items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 sm:px-3 py-2 rounded-lg border border-slate-700 transition-colors shadow-sm" aria-expanded={!sidebarOculta} aria-controls="cemag-filter-drawer">
              <Sliders className="w-4 h-4 text-orange-300" /><span className="hidden sm:inline">Filtros</span>
            </button>
            <button type="button" onClick={() => navegarParaAba("exportacoes")} aria-label="Exportar dados" title="Exportar dados" className="no-print flex min-h-10 items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white font-semibold px-2.5 sm:px-3.5 py-2 rounded-lg transition-colors shadow-sm">
              <Download className="w-4 h-4" /><span className="hidden sm:inline">Exportar</span>
            </button>
            <details className="no-print relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 sm:px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400" aria-label="Mais aÃ§Ãµes"><span className="hidden sm:inline">Mais</span><ChevronDown className="h-3.5 w-3.5" /></summary>
              <div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
                <button type="button" onClick={(event) => { setTemaDashboard((tema) => tema === "claro" ? "black" : "claro"); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"><span className="h-3 w-3 rounded-full border border-orange-300 bg-orange-500" />{temaDashboard === "black" ? "Alternar para tema claro" : "Alternar para modo escuro"}</button>
                <button type="button" onClick={(event) => { setVisualizacaoExpandida((v) => !v); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800">{visualizacaoExpandida ? <Eye className="h-4 w-4 text-orange-300" /> : <Tv className="h-4 w-4 text-orange-300" />}{visualizacaoExpandida ? "Sair da visualizaÃ§Ã£o ampliada" : "Expandir visualizaÃ§Ãµes"}</button>
                <button type="button" onClick={(event) => { handleResetFiltros(); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"><RefreshCw className="h-4 w-4 text-orange-400" />Restaurar padrÃµes</button>
                <button type="button" onClick={(event) => { setRelatorioAberto(true); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"><Printer className="h-4 w-4 text-orange-400" />Gerar relatÃ³rio</button>
                {onLogout && <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-200 hover:bg-red-950/50"><LogOut className="h-4 w-4" />Sair da conta</button>}
              </div>
            </details>
          </div>
        </div>

        {/* Resumo compacto de filtros ativos */}
        <div className="hidden sm:flex max-w-[1700px] mx-auto mt-2 pt-2 border-t border-slate-800/80 flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Fonte: <strong className="text-slate-200">{nomeArquivoBase}</strong></span>
            <span>â€¢</span>
            <span>Formas de venda: <strong className="text-amber-400">{formasVendaTexto}</strong></span>
            <span>â€¢</span>
            <span>FamÃ­lias excluÃ­das: <strong className="text-slate-200">{familiasExcluidasTexto}</strong></span>
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

      {/* ConteÃºdo com Sidebar fixa na esquerda */}
      <div className="relative flex flex-1 max-w-[1700px] w-full mx-auto">
        <SidebarFilters
          filtros={filtros}
          setFiltros={setFiltros}
          opcoesFiltros={opcoesFiltros}
          nomeArquivoBase={nomeArquivoBase}
          onUploadArquivo={handleUploadArquivo}
          isAdmin={isAdmin}
          onResetFiltros={handleResetFiltros}
          linhasFiltradas={dadosFiltrados.length}
          totalLinhasValidas={meta?.linhas_validas || 0}
          isOpenMobile={!sidebarOculta}
          onCloseMobile={() => setSidebarOculta(true)}
        />

        {/* Ãrea Central Principal */}
        <main className={`printable-content min-w-0 ${visualizacaoExpandida ? "visualizacao-ampliada fixed inset-0 z-50 bg-[#0E1117] overflow-y-auto" : "flex-1"} px-3 py-4 sm:p-4 md:p-6 overflow-x-hidden`}>
          {visualizacaoExpandida && <div className="sticky top-0 z-20 flex justify-end pb-3"><button type="button" onClick={() => setVisualizacaoExpandida(false)} className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-slate-900 px-3 py-2 text-xs font-semibold text-orange-300 shadow-lg hover:bg-slate-800"><Eye className="h-4 w-4" /> Sair da visualizaÃ§Ã£o ampliada</button></div>}
          {/* NavegaÃ§Ã£o agrupada: reduz a poluiÃ§Ã£o sem esconder nenhuma funcionalidade. */}
          <div className="no-print mb-5 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 scrollbar-thin">
              {GRUPOS_ABAS.map((grupo) => <button key={grupo.id} type="button" onClick={() => { setGrupoAbaAtivo(grupo.id); navegarParaAba(grupo.abas[0].id); }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all ${grupoAbaAtivo === grupo.id ? "bg-orange-500 text-white shadow-md" : "text-slate-300 hover:bg-slate-800/80 hover:text-white"}`}>{grupo.icon} {grupo.label}</button>)}
            </div>
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/50 px-2 py-1.5 scrollbar-thin">
              {GRUPOS_ABAS.find((grupo) => grupo.id === grupoAbaAtivo)?.abas.map((aba) => <button key={aba.id} type="button" onClick={() => navegarParaAba(aba.id)} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${abaAtiva === aba.id ? "bg-orange-500/20 text-orange-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{aba.label}</button>)}
            </div>
          </div>
          <section className="cemag-command-center mb-5 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 shadow-sm transition-colors duration-200">
          <div className="cemag-command-intro">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300"><span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_#ff5a1f]" /> InteligÃªncia comercial <span className="text-slate-600">/</span> {GRUPOS_ABAS.find((grupo) => grupo.id === grupoAbaAtivo)?.label}</div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-white md:text-2xl">{infoAba.titulo}</h2></div><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{infoAba.descricao}</p></div>
              <div className="flex min-w-[210px] flex-col gap-1.5 text-[10px] text-slate-400 sm:items-end">
                <div className="flex w-full items-center justify-between gap-3 sm:justify-end"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />AtualizaÃ§Ã£o ao vivo</span><span><strong className="text-white">{dadosFiltrados.length.toLocaleString("pt-BR")}</strong> de {(meta?.linhas_validas || 0).toLocaleString("pt-BR")} linhas</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800 sm:max-w-64"><div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-[width] duration-200 ease-out" style={{ width: `${percentualRegistrosFiltrados}%` }} /></div>
                <span>Base: {periodoBaseTexto} Â· perÃ­odo filtrado: {periodoEfetivo}</span>
              </div>
            </div>
            {filtrosVisiveis.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-3" aria-live="polite" aria-label="Filtros aplicados em tempo real"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">VisÃ£o atual</span>{filtrosVisiveis.map((filtro) => <span key={filtro.label} className="max-w-full truncate rounded-full border border-slate-700/80 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-300"><strong className="text-orange-300">{filtro.label}:</strong> {filtro.value}</span>)}</div>}
          </div>

          {/* Cards Executivos de Topo (visÃ­veis em todas as abas, exceto Modo ApresentaÃ§Ã£o que tem cards prÃ³prios) */}
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
          </section>

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
                Restaurar Filtros PadrÃ£o
              </button>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* ABA 1: VISÃƒO GERAL */}
              {/* ========================================================= */}
              {abaAtiva === "visao_geral" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">VisÃ£o Geral</h2>
                      <p className="text-xs text-slate-400">
                        Resumo executivo do perÃ­odo filtrado com foco nos principais movimentos comerciais.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">MÃ©trica principal:</span>
                      <select
                        value={metricaVisao}
                        onChange={(e) => setMetricaVisao(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="Faturamento">Faturamento</option>
                        <option value="Quantidade">Quantidade</option>
                        <option value="Pedidos">Pedidos</option>
                        <option value="Clientes">Clientes</option>
                        <option value="Ticket unitÃ¡rio">Ticket unitÃ¡rio</option>
                        <option value="Valor mÃ©dio por pedido">Valor mÃ©dio por pedido</option>
                      </select>
                    </div>
                  </div>

                  {/* Painel Agora: nÃºmeros essenciais sem navegar pelas demais abas. */}
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white">Painel Agora</h3>
                        <p className="text-xs text-slate-400">Leitura rÃ¡pida de {painelAgora.mesAtual || periodoEfetivo}, meta, ritmo e principais destaques.</p>
                      </div>
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300">Resumo executivo</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Faturamento</span><strong className="mt-1 block text-base text-white">{formatarMoeda(painelAgora.atual.faturamento)}</strong><span className={`text-[10px] font-semibold ${painelAgora.variacao !== null && painelAgora.variacao >= 0 ? "text-emerald-400" : "text-red-400"}`}>{painelAgora.variacao === null ? "Sem comparaÃ§Ã£o" : `${painelAgora.variacao >= 0 ? "â–²" : "â–¼"} ${Math.abs(painelAgora.variacao).toFixed(1)}% vs ano anterior`}</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Pedidos</span><strong className="mt-1 block text-base text-white">{formatarInteiro(painelAgora.atual.pedidos)}</strong><span className="text-[10px] text-slate-400">no perÃ­odo atual</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Clientes</span><strong className="mt-1 block text-base text-white">{formatarInteiro(painelAgora.atual.clientes)}</strong><span className="text-[10px] text-slate-400">compradores ativos</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Meta</span><strong className="mt-1 block text-base text-white">{painelAgora.meta ? formatarPercentual(painelAgora.atingimento || 0) : "â€”"}</strong><span className="text-[10px] text-slate-400">{painelAgora.meta ? `${formatarMoeda(painelAgora.meta)} definida` : "cadastre uma meta"}</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">ProjeÃ§Ã£o</span><strong className="mt-1 block text-base text-white">{formatarMoeda(painelAgora.projecao)}</strong><span className="text-[10px] text-slate-400">fechamento estimado</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Falta para meta</span><strong className="mt-1 block text-base text-white">{painelAgora.meta ? formatarMoeda(Math.max(0, painelAgora.meta - painelAgora.atual.faturamento)) : "â€”"}</strong><span className="text-[10px] text-slate-400">valor restante</span></div>
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-400">Ritmo diÃ¡rio</span><strong className="mt-1 block text-base text-white">{painelAgora.necessarioDia ? formatarMoeda(painelAgora.necessarioDia) : "â€”"}</strong><span className="text-[10px] text-slate-400">{painelAgora.diasRestantes ? `${painelAgora.diasRestantes} dias restantes` : "perÃ­odo fechado"}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">Cliente lÃ­der: </span><strong className="text-orange-300">{painelAgora.topCliente[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topCliente[1])}</span></div>
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">Produto lÃ­der: </span><strong className="text-orange-300">{painelAgora.topProduto[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topProduto[1])}</span></div>
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"><span className="text-slate-400">RegiÃ£o lÃ­der: </span><strong className="text-orange-300">{painelAgora.topRegiao[0]}</strong><span className="ml-1 text-slate-400">{formatarMoeda(painelAgora.topRegiao[1])}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
                      {(() => {
                        const percentual = painelAgora.atingimento || 0;
                        const projecaoAtingimento = painelAgora.meta ? painelAgora.projecao / painelAgora.meta : 0;
                        const verde = painelAgora.meta > 0 && (percentual >= 1 || projecaoAtingimento >= 1);
                        const amarelo = painelAgora.meta > 0 && !verde && (percentual >= 0.75 || projecaoAtingimento >= 0.9);
                        const estilo = verde ? { borda: "border-emerald-500/30", fundo: "bg-emerald-500/10", texto: "text-emerald-300", ponto: "bg-emerald-400", trilho: "bg-emerald-950/60", suave: "text-emerald-200" } : amarelo ? { borda: "border-amber-500/30", fundo: "bg-amber-500/10", texto: "text-amber-300", ponto: "bg-amber-400", trilho: "bg-amber-950/60", suave: "text-amber-200" } : { borda: "border-red-500/30", fundo: "bg-red-500/10", texto: "text-red-300", ponto: "bg-red-400", trilho: "bg-red-950/60", suave: "text-red-200" };
                        const titulo = !painelAgora.meta ? "Meta nÃ£o cadastrada" : verde ? "No ritmo para atingir a meta" : amarelo ? "Meta exige atenÃ§Ã£o" : "Ritmo abaixo do esperado";
                        return <div className={`rounded-lg border ${estilo.borda} ${estilo.fundo} p-3`}><div className="flex items-center justify-between gap-2"><span className={`text-xs font-bold ${estilo.texto}`}>{titulo}</span><span className={`h-2.5 w-2.5 rounded-full ${estilo.ponto}`} /></div><div className={`mt-2 h-2 overflow-hidden rounded-full ${estilo.trilho}`}><div className={`h-full rounded-full ${estilo.ponto}`} style={{ width: `${Math.min(100, Math.max(0, Math.round((painelAgora.meta ? Math.max(percentual, projecaoAtingimento) : 0) * 100)))}%` }} /></div><p className={`mt-2 text-[10px] ${estilo.suave}`}>{painelAgora.meta ? `Realizado ${formatarPercentual(percentual)} Â· projeÃ§Ã£o ${formatarPercentual(projecaoAtingimento)}` : "Informe uma meta mensal para ativar o semÃ¡foro."}</p></div>;
                      })()}
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"><div className="mb-2 text-xs font-bold text-white">O que mudou?</div><div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-300 sm:grid-cols-3"><span><b className="text-orange-300">{painelAgora.variacao === null ? "â€”" : `${painelAgora.variacao >= 0 ? "+" : ""}${painelAgora.variacao.toFixed(1)}%`}</b> vs mesmo mÃªs do ano anterior</span><span><b className="text-orange-300">{formatarMoeda(painelAgora.topProduto[1])}</b> no produto lÃ­der</span><span><b className="text-orange-300">{formatarMoeda(painelAgora.topCliente[1])}</b> no cliente lÃ­der</span></div></div>
                    </div>
                  </div>

                  {/* 4 Destaques LÃ­deres */}
                  {(() => {
                    const topCli = agregar(dadosFiltrados, ["cliente"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topProd = agregar(dadosFiltrados, ["produto"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topReg = agregar(dadosFiltrados, ["regiao"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];
                    const topRep = agregar(dadosFiltrados, ["representante"]).sort((a, b) => valorMetrica(b, metricaVisao) - valorMetrica(a, metricaVisao))[0];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Cliente lÃ­der</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topCli?.cliente || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topCli, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Produto lÃ­der</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topProd?.produto || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topProd, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">RegiÃ£o lÃ­der</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topReg?.regiao || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topReg, metricaVisao), metricaVisao)}</div>
                        </div>
                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                          <span className="text-xs text-slate-400">Representante lÃ­der</span>
                          <div className="text-sm font-bold text-white truncate mt-1">{topRep?.representante || "-"}</div>
                          <div className="text-xs font-semibold text-orange-400 mt-0.5">{formatarMetrica(valorMetrica(topRep, metricaVisao), metricaVisao)}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* GrÃ¡fico de EvoluÃ§Ã£o Mensal */}
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-lg">
                    <h3 className="text-sm font-bold text-white mb-3">
                      EvoluÃ§Ã£o mensal - {metricaVisao}
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
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">ðŸŽ¯ Metas mensais de faturamento</h2>
                    <p className="text-xs text-slate-400 mt-1">Importe metas histÃ³ricas por CSV e informe manualmente a meta do mÃªs vigente. A meta manual tem prioridade para o mesmo mÃªs.</p>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-orange-400">Importar metas histÃ³ricas por CSV</h3>
                      <p className="text-xs text-slate-400">Colunas aceitas: <code className="text-slate-200">mes;ano;meta</code>. TambÃ©m aceita vÃ­rgula, nome do mÃªs e valores no formato brasileiro.</p>
                      {isAdmin ? <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleUploadMetas(e.target.files[0])} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-500" /> : <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">Modo consulta: as metas sÃ£o carregadas da versÃ£o central publicada pela administradora.</div>}
                      <button onClick={() => exportarTabelaCsv([{ mes: 1, ano: hoje.getFullYear(), meta: 1000000 }], "modelo_metas_mensais.csv")} className="text-xs text-sky-400 hover:text-sky-300">Baixar modelo CSV</button>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-green-400">Meta manual do mÃªs vigente</h3>
                      <p className="text-xs text-slate-400">{isAdmin ? "Atualize a meta do mÃªs atual. A alteraÃ§Ã£o serÃ¡ publicada para todos os usuÃ¡rios." : "A meta manual Ã© exibida a partir da versÃ£o central publicada pela administradora."}</p>
                      <div className="grid grid-cols-3 gap-2"><label className="text-xs text-slate-400">Ano<input disabled={!isAdmin} type="number" value={metaManualAno} onChange={(e) => setMetaManualAno(Number(e.target.value))} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label><label className="text-xs text-slate-400">MÃªs<input disabled={!isAdmin} type="number" min="1" max="12" value={metaManualMes} onChange={(e) => setMetaManualMes(Number(e.target.value))} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label><label className="text-xs text-slate-400">Meta (R$)<input disabled={!isAdmin} type="text" placeholder="1.500.000,00" value={metaManualValor} onChange={(e) => setMetaManualValor(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" /></label></div>
                      <div className="flex gap-2"><button disabled={!isAdmin} onClick={salvarMetaManual} className="rounded bg-green-600 hover:bg-green-500 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Salvar meta vigente</button><button disabled={!isAdmin} onClick={limparMetas} className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-50">Limpar metas</button></div>
                    </div>
                  </div>
                  {metaStatus && <div className="rounded-lg border border-sky-800/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">{metaStatus}</div>}
                  <div className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-sky-200">Filtros exclusivos da anÃ¡lise de metas</h3><p className="text-[11px] text-slate-400">Por padrÃ£o, considera todo o faturamento da base e ignora os filtros laterais.</p></div><button type="button" onClick={() => { setMetaDataInicio(""); setMetaDataFim(""); setMetaTiposProduto([]); setMetaTiposVenda([]); setMetaRegioes([]); setMetaUfs([]); setMetaRepresentantes([]); setMetaClientes([]); }} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700">Usar toda a base</button></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><label className="text-xs text-slate-400">Data inicial<input type="date" value={metaDataInicio} onChange={(e) => setMetaDataInicio(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white" /></label><label className="text-xs text-slate-400">Data final<input type="date" value={metaDataFim} onChange={(e) => setMetaDataFim(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-2 py-2 text-white" /></label><MetaCheckboxFilter label="Tipos de produto" values={opcoesFiltros.tiposProduto} selected={metaTiposProduto} onChange={setMetaTiposProduto} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                      <MetaCheckboxFilter label="Tipos de venda" values={opcoesFiltros.tiposVenda} selected={metaTiposVenda} onChange={setMetaTiposVenda} />
                      <MetaCheckboxFilter label="RegiÃµes" values={opcoesFiltros.regioes} selected={metaRegioes} onChange={setMetaRegioes} />
                      <MetaCheckboxFilter label="UFs" values={opcoesFiltros.ufs} selected={metaUfs} onChange={setMetaUfs} />
                      <MetaCheckboxFilter label="Representantes" values={opcoesFiltros.representantes} selected={metaRepresentantes} onChange={setMetaRepresentantes} />
                      <MetaCheckboxFilter label="Clientes" values={opcoesFiltros.clientes} selected={metaClientes} onChange={setMetaClientes} />
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-xs font-bold text-amber-200">Formas de venda encontradas no perÃ­odo da meta</h4><p className="text-[10px] text-slate-500">Use esta lista para identificar o que estÃ¡ sendo considerado. Os botÃµes removem a forma dos filtros gerais ou desta aba.</p></div><span className="text-[10px] text-slate-500">{formasVendaPeriodoMeta.length} forma(s)</span></div><div className="flex flex-wrap gap-2 mt-2">{formasVendaPeriodoMeta.map(([tipo, quantidade]) => <span key={tipo} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300"><span>{tipo} ({quantidade})</span><button type="button" title="Desmarcar nos filtros gerais" onClick={() => setFiltros((prev) => ({ ...prev, tiposVendaSelecionados: prev.tiposVendaSelecionados.filter((v) => v !== tipo) }))} className="text-red-300 hover:text-red-200">Ã— geral</button><button type="button" title="Desmarcar nas metas" onClick={() => setMetaTiposVenda((prev) => prev.filter((v) => v !== tipo))} className="text-sky-300 hover:text-sky-200">Ã— meta</button></span>)}</div></div>
                    <p className="text-[11px] text-slate-500">Registros considerados nesta anÃ¡lise: {dadosMetas.length.toLocaleString("pt-BR")} de {dados.length.toLocaleString("pt-BR")}.</p>
                  </div>
                  {(() => { const vigente = atingimentoMensal.find((r) => r.ano === hoje.getFullYear() && r.mes_num === hoje.getMonth() + 1); const realizadoAtual = dadosMetas.filter((d) => d.ano === hoje.getFullYear() && d.mes_num === hoje.getMonth() + 1).reduce((s, d) => s + d.faturamento, 0); const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(); const projecao = realizadoAtual / Math.max(hoje.getDate(), 1) * diasNoMes; return <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Meta vigente</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(vigente?.meta || 0)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Realizado no mÃªs</span><div className="text-xl font-bold text-white">{formatarMoeda(realizadoAtual)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Atingimento atual</span><div className={`text-xl font-bold ${(vigente?.meta && realizadoAtual / vigente.meta >= 1) ? "text-green-400" : "text-amber-400"}`}>{vigente?.meta ? formatarPercentual(realizadoAtual / vigente.meta) : "Sem meta"}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">ProjeÃ§Ã£o do mÃªs</span><div className="text-xl font-bold text-sky-400">{formatarMoeda(projecao)}</div></div></div>; })()}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4"><h3 className="text-sm font-bold text-white mb-3">Atingimento por mÃªs</h3>{atingimentoMensal.length ? <DataTable exportName="atingimento_mensal" rows={atingimentoMensal.map((r) => ({ ...r, status_meta: r.atingimento >= 1 ? "Atingida" : r.ano === hoje.getFullYear() && r.mes_num === hoje.getMonth() + 1 ? "Em andamento" : "NÃ£o atingida" }))} columns={["ano_mes","realizado","meta","atingimento","diferenca_meta","status_meta","origem_meta"]} /> : <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Nenhuma meta cadastrada. Importe um CSV ou salve a meta do mÃªs vigente.</div>}</div>
                  {(() => {
                    const tiposMix = ["Carreta", "PeÃ§a", "Conjunto", "Sucata", "Itens comprados", "Outros"];
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
                    return <div className="space-y-4"><div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl"><div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h3 className="text-sm font-bold text-white">Mix mensal do faturamento por tipo de produto</h3><p className="text-xs text-slate-400">VisÃ£o completa da base ou dos filtros exclusivos definidos nesta aba.</p></div><span className="text-[11px] text-slate-500">Percentuais somam 100% por mÃªs</span></div><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={mixMensal} stackOffset="expand" margin={{ top: 10, right: 20, left: 20, bottom: 38 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(mixMensal.length)} angle={mixMensal.length > 18 ? -28 : -18} textAnchor="end" height={mixMensal.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} stroke="#94A3B8" fontSize={11} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any, name: string) => [formatarPercentual(v), name]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />{tiposMix.map((tipo) => <Bar key={tipo} dataKey={tipo} stackId="mix" fill={coresMix[tipo]} />)}</BarChart></ResponsiveContainer></div></div><DataTable exportName="mix_mensal_tipo_produto" rows={mixMensal} columns={["ano_mes", ...tiposMix, "total"]} percentColumns={tiposMix} /></div>;
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 3: MODO APRESENTAÃ‡ÃƒO */}
              {/* ========================================================= */}
              {abaAtiva === "modo_apresentacao" && (
                <div
                  className={`p-6 rounded-2xl border transition-colors ${
                    temaApresentacao === "Claro"
                      ? "bg-[#F8FAFC] text-slate-900 border-slate-300"
                      : "bg-[#07111F] text-slate-100 border-[#20314B]"
                  }`}
                >
                  {/* Barra de controle da apresentaÃ§Ã£o */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/40">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Tv className="w-6 h-6 text-orange-500" />
                        <span>Painel Executivo para ProjeÃ§Ã£o</span>
                      </h2>
                      <p className="text-xs opacity-75">
                        Layout otimizado para reuniÃ£o de diretoria, telÃµes e apresentaÃ§Ãµes.
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
                        <span>MÃ©trica:</span>
                        <select
                          value={metricaApresentacao}
                          onChange={(e) => setMetricaApresentacao(e.target.value)}
                          className="bg-black/20 border border-current/20 rounded px-2.5 py-1"
                        >
                          <option value="Faturamento">Faturamento</option>
                          <option value="Quantidade">Quantidade</option>
                          <option value="Pedidos">Pedidos</option>
                          <option value="Clientes">Clientes</option>
                          <option value="Ticket unitÃ¡rio">Ticket unitÃ¡rio</option>
                          <option value="Valor mÃ©dio por pedido">Valor mÃ©dio por pedido</option>
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

                  {/* Cards Gigantes de ApresentaÃ§Ã£o */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-orange-500">
                      <div className="text-xs opacity-70">Faturamento Total</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarMoeda(kpis.faturamento)}</div>
                      <div className="text-[10px] opacity-60 mt-1">VisÃ£o geral do perÃ­odo</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-orange-400">
                      <div className="text-xs opacity-70">Quantidade</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.quantidade)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Carretas entregues</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-blue-400">
                      <div className="text-xs opacity-70">Pedidos / Notas</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.pedidos)}</div>
                      <div className="text-[10px] opacity-60 mt-1">OperaÃ§Ãµes Ãºnicas</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-sky-400">
                      <div className="text-xs opacity-70">Clientes Ativos</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarInteiro(kpis.clientes)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Na carteira filtrada</div>
                    </div>
                    <div className="p-4 rounded-xl border border-current/20 bg-current/5 border-l-4 border-l-green-500">
                      <div className="text-xs opacity-70">Ticket MÃ©dio</div>
                      <div className="text-2xl lg:text-3xl font-extrabold mt-1">{formatarMoeda(kpis.ticketUnitario)}</div>
                      <div className="text-[10px] opacity-60 mt-1">Por produto faturado</div>
                    </div>
                  </div>

                  {/* GrÃ¡fico de Linha Executivo */}
                  <div className="p-5 rounded-xl border border-current/20 bg-current/5 mb-6">
                    <h3 className="text-base font-bold mb-4">EvoluÃ§Ã£o Mensal - {metricaApresentacao}</h3>
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
                        Compare dois exercÃ­cios para avaliar crescimento real, meses equivalentes e produtos de maior traÃ§Ã£o.
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
                        <span className="text-slate-400">Ano comparaÃ§Ã£o:</span>
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
                        <span className="text-slate-400">MÃ©trica:</span>
                        <select
                          value={metricaYoY}
                          onChange={(e) => setMetricaYoY(e.target.value as MetricaComparativoAnual)}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"
                        >
                          <option value="faturamento">Faturamento</option>
                          <option value="quantidade">Quantidade</option>
                          <option value="pedidos">Pedidos</option>
                          <option value="clientes">Clientes</option>
                          <option value="ticket_unitario">Ticket unitÃ¡rio</option>
                          <option value="valor_medio_pedido">Valor mÃ©dio por pedido</option>
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

                  {/* Comparativo de todos os anos com seleÃ§Ã£o independente */}
                  {(() => {
                    const coresAnos = ["#38BDF8", "#F97316", "#A78BFA", "#22C55E", "#F43F5E", "#FACC15", "#14B8A6", "#FB7185", "#60A5FA", "#C084FC"];
                    const comparativoTodosAnos = gerarComparativoAnual(dadosFiltrados, anosSelecionadosYoY, metricaYoY);
                    const colunasAnos = anosSelecionadosYoY.map(String);

                    return (
                      <div className="space-y-4">
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div>
                              <h3 className="text-sm font-bold text-white">Todos os anos disponÃ­veis â€” {ROTULOS_METRICA_YOY[metricaYoY]}</h3>
                              <p className="text-xs text-slate-400 mt-1">Selecione ou retire anos individualmente. O grÃ¡fico respeita os filtros gerais aplicados no painel lateral.</p>
                            </div>
                            <div className="flex gap-2 text-[11px]">
                              <button type="button" onClick={() => setAnosSelecionadosYoY(anosDisponiveisYoY)} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-200 hover:bg-slate-700">Selecionar todos</button>
                              <button type="button" onClick={() => setAnosSelecionadosYoY([])} className="rounded bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700">Limpar seleÃ§Ã£o</button>
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
                            ) : <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">Selecione pelo menos um ano para visualizar o grÃ¡fico.</div>}
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
                            <span className="text-xs text-slate-400">VariaÃ§Ã£o no PerÃ­odo</span>
                            <div className={`text-xl font-bold mt-1 ${varAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {formatarMetricaYoY(varAbs, metricaYoY)} ({formatarPercentual(varPct)})
                            </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Meses comparados</span>
                            <div className="text-xl font-bold text-sky-400 mt-1">{mesesConsiderados.length} meses</div>
                          </div>
                        </div>

                        {/* GrÃ¡fico comparativo de barras lado a lado */}
                        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                          <h3 className="text-sm font-bold text-white mb-4">
                            EvoluÃ§Ã£o mensal â€” {ROTULOS_METRICA_YOY[metricaYoY]} â€” {anoBaseYoY} vs {anoCompYoY}
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
              {/* ABA 4: MÃŠS X MÃŠS */}
              {/* ========================================================= */}
              {abaAtiva === "mes_mes" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-white">EvoluÃ§Ã£o MÃªs a MÃªs (MoM)</h2>
                      <p className="text-xs text-slate-400">
                        Escolha dois ou mais meses para comparar a evoluÃ§Ã£o, a variaÃ§Ã£o entre o primeiro e o Ãºltimo e a contribuiÃ§Ã£o por dimensÃ£o.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3 text-xs">
                      <SeletorMetrica value={metricaMoM} onChange={setMetricaMoM} />
                      <div className="min-w-[280px] max-w-[560px]"><div className="mb-1 flex items-center gap-2 text-slate-400"><span>Meses para comparar ({mesesComparativoSelecionados.length})</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setMesesComparativoSelecionados(mesesDisponiveisMoM.map((mes) => mes.value))}>Selecionar todos</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setMesesComparativoSelecionados(mesesDisponiveisMoM.slice(-4).map((mes) => mes.value))}>Ãšltimos 4</button></div><div className="flex max-h-20 flex-wrap gap-x-3 gap-y-1 overflow-y-auto rounded border border-slate-700 bg-slate-800 p-2">{mesesDisponiveisMoM.map((mes) => <label key={mes.value} className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={mesesComparativoSelecionados.includes(mes.value)} onChange={(e) => setMesesComparativoSelecionados((atuais) => e.target.checked ? [...atuais, mes.value] : atuais.filter((item) => item !== mes.value))} />{mes.label}</label>)}</div></div>
                    </div>
                  </div>

                  {mesesComparativoOrdenados.length >= 2 ? <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">MÃªs A Â· {mesComparativoA}</div><div className="mt-2 text-xl font-bold text-sky-300">{formatarMetrica(linhaComparativoMoM.valorA, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">{dadosMesComparativoA.length.toLocaleString("pt-BR")} linhas</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">MÃªs B Â· {mesComparativoB}</div><div className="mt-2 text-xl font-bold text-orange-300">{formatarMetrica(linhaComparativoMoM.valorB, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">{dadosMesComparativoB.length.toLocaleString("pt-BR")} linhas</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">VariaÃ§Ã£o absoluta</div><div className={`mt-2 text-xl font-bold ${linhaComparativoMoM.delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatarMetrica(linhaComparativoMoM.delta, metricaMoM)}</div><div className="mt-1 text-[11px] text-slate-500">B âˆ’ A</div></div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500">VariaÃ§Ã£o percentual</div><div className={`mt-2 text-xl font-bold ${linhaComparativoMoM.variacao == null || linhaComparativoMoM.variacao >= 0 ? "text-emerald-300" : "text-red-300"}`}>{linhaComparativoMoM.variacao == null ? "-" : formatarPercentual(linhaComparativoMoM.variacao)}</div><div className="mt-1 text-[11px] text-slate-500">Base: MÃªs A</div></div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-4">EvoluÃ§Ã£o dos meses selecionados â€” {metricaMoM}</h3>
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

                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><div className="mb-3"><h3 className="text-sm font-bold text-white">Resumo auditÃ¡vel dos meses selecionados</h3><p className="text-[11px] text-slate-400">A tabela mostra todos os meses escolhidos; a variaÃ§Ã£o usa o primeiro e o Ãºltimo mÃªs.</p></div><DataTable exportName="comparativo_mom_resumo" rows={serieComparativoMoM.map((row, index) => ({ ...row, metrica: metricaMoM, ordem: index + 1, primeiro_mes: mesComparativoA, ultimo_mes: mesComparativoB, delta_primeiro_ultimo: index === serieComparativoMoM.length - 1 ? linhaComparativoMoM.delta : null, variacao_primeiro_ultimo: index === serieComparativoMoM.length - 1 ? linhaComparativoMoM.variacao : null }))} columns={["ordem", "metrica", "periodo", "valor", "linhas", "primeiro_mes", "ultimo_mes", "delta_primeiro_ultimo", "variacao_primeiro_ultimo"]} metricColumns={{ valor: metricaMoM, delta_primeiro_ultimo: metricaMoM }} percentColumns={["variacao_primeiro_ultimo"]} /></div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{detalhesComparativoMoM.map(({ dimensao, itens }) => <div key={dimensao} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-white">Detalhamento por {dimensao}</h3><p className="text-[11px] text-slate-400">Ordenado pela maior alteraÃ§Ã£o absoluta.</p></div><span className="text-[10px] text-slate-500">{itens.length} itens</span></div><DataTable exportName={`comparativo_mom_${dimensao.toLowerCase().replaceAll(" ", "_")}`} rows={itens.slice(0, 100)} columns={["item", "valor_a", "valor_b", "delta", "variacao_pct"]} metricColumns={{ valor_a: metricaMoM, valor_b: metricaMoM, delta: metricaMoM }} percentColumns={["variacao_pct"]} /></div>)}</div>
                  </> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Selecione dois meses com dados para iniciar a comparaÃ§Ã£o.</div>}
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
                        AnÃ¡lise de concentraÃ§Ã£o, curva de Pareto e penetraÃ§Ã£o dos modelos no faturamento global.
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
                          <option value="familia">FamÃ­lia</option>
                          <option value="grupo_modelo">Grupo / Modelo</option>
                          <option value="categoria_produto">Categoria</option>
                          <option value="descricao_generica">DescriÃ§Ã£o GenÃ©rica</option>
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

                  {/* Tabela e GrÃ¡fico de Produtos */}
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
                                  <th className="py-2.5 px-4 text-right">ParticipaÃ§Ã£o</th>
                                  <th className="py-2.5 px-4 text-right">Acumulado</th>
                                  <th className="py-2.5 px-4 text-right">Quantidade</th>
                                  <th className="py-2.5 px-4 text-right">PreÃ§o MÃ©dio</th>
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
                      <h2 className="text-lg font-bold text-white">Clientes & GestÃ£o de Carteira</h2>
                      <p className="text-xs text-slate-400">
                        Curva ABC, retenÃ§Ã£o comercial, dias sem compra e classificaÃ§Ã£o de risco da carteira.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <SeletorMetrica value={metricaCli} onChange={setMetricaCli} />
                      <div className="flex items-center gap-2">
                      <span className="text-slate-400">VisÃ£o:</span>
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
                    const statusAtencao = carteira.filter((c) => c.status === "Em atenÃ§Ã£o").length;
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
                            <span className="text-xs text-slate-400">Clientes em AtenÃ§Ã£o</span>
                            <div className="text-xl font-bold text-amber-400 mt-1">{statusAtencao} clientes</div>
                            <span className="text-[10px] text-slate-500">Gaps de compra acima da mÃ©dia</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">Clientes Inativos</span>
                            <div className="text-xl font-bold text-red-400 mt-1">{statusInativo} clientes</div>
                            <span className="text-[10px] text-slate-500">Mais de 90 dias sem comprar</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <span className="text-xs text-slate-400">ConcentraÃ§Ã£o Top 10</span>
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
                                  <th className="py-2.5 px-4 text-right">Ãšltima Compra</th>
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
                                            : c.status === "Em atenÃ§Ã£o"
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
              {/* ABA 7: INTELIGÃŠNCIA COMERCIAL */}
              {/* ========================================================= */}
              {abaAtiva === "inteligencia" && (
                <div className="space-y-6">
                  {/* Seletor de Sub-Ãreas */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    {[
                      { id: "comparador", label: "ðŸ“Š Comparador & O que mudou" },
                      { id: "carteira_risco", label: "ðŸ‘¥ Carteira & risco" },
                      { id: "abc", label: "ðŸ“ˆ ABC, Pareto & concentraÃ§Ã£o" },
                      { id: "mix", label: "ðŸ§© Mix & venda cruzada" },
                      { id: "preco_dre", label: "ðŸ’µ PreÃ§o, margem & DRE" },
                      { id: "calendario", label: "ðŸ—“ï¸ CalendÃ¡rio & ritmo" },
                      { id: "rep_alertas", label: "ðŸ¤ Representantes & alertas" },
                      { id: "fechamento", label: "ðŸ“Œ Fechamento mensal" },
                    ].map((sub) => (
                      <button key={sub.id} onClick={() => setSubInteligencia(sub.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${subInteligencia === sub.id ? "bg-orange-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {subInteligencia === "comparador" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-base font-bold text-white">Comparador livre de perÃ­odos</h3><p className="text-xs text-slate-400">Explique a variaÃ§Ã£o por cliente, famÃ­lia, produto, representante, regiÃ£o ou UF.</p></div>
                        <div className="flex items-center gap-2 text-xs"><span className="text-slate-400">DimensÃ£o:</span><select value={intelCompDim} onChange={(e) => setIntelCompDim(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option value="cliente">Cliente</option><option value="familia">FamÃ­lia</option><option value="produto">Produto/carreta</option><option value="representante">Representante</option><option value="regiao">RegiÃ£o</option><option value="uf">UF</option></select></div>
                      </div>
                      {(() => { const sorted=[...dadosFiltrados].sort((a,b)=>a.data_emissao.getTime()-b.data_emissao.getTime()); const split=sorted[Math.floor(sorted.length/2)]?.data_emissao || new Date(); const ini=sorted[0]?.data_emissao || new Date(); const fim=sorted[sorted.length-1]?.data_emissao || new Date(); const r=compararPeriodos(sorted,ini,split,split,fim,intelCompDim,"faturamento"); return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["PerÃ­odo A",r.resumo.valor_a], ["PerÃ­odo B",r.resumo.valor_b], ["VariaÃ§Ã£o absoluta",r.resumo.variacao_abs], ["VariaÃ§Ã£o %",r.resumo.variacao_pct]].map(([label,value]:any)=><div key={label} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{label}</span><div className={`text-base font-bold mt-1 ${label === "VariaÃ§Ã£o %" || label === "VariaÃ§Ã£o absoluta" ? (value >= 0 ? "text-green-400" : "text-red-400") : "text-white"}`}>{label === "VariaÃ§Ã£o %" ? formatarPercentual(value) : formatarMoeda(value)}</div></div>)}</div><DataTable rows={r.detalhe} columns={[intelCompDim,"valor_a","valor_b","variacao_abs","variacao_pct","contribuicao_variacao"]} /></div>; })()}
                    </div>
                  )}

                  {subInteligencia === "carteira_risco" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div><h3 className="text-base font-bold text-white">Carteira & risco</h3><p className="text-xs text-slate-400">Status histÃ³rico por recÃªncia, frequÃªncia e faturamento relevante.</p></div>
                      {(() => { const c=classificarCarteiraClientes(dadosFiltrados); const cont=Object.fromEntries(["Novo","Recuperado","Recorrente","Compra Ãºnica","Em atenÃ§Ã£o","Inativo"].map(x=>[x,c.filter(y=>y.status===x).length])); return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Ativos",c.filter(x=>!['Em atenÃ§Ã£o','Inativo'].includes(x.status)).length],['Em atenÃ§Ã£o',cont['Em atenÃ§Ã£o']],['Inativos',cont.Inativo],['Recuperados',cont.Recuperado]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-xl font-bold text-orange-400">{v}</div></div>)}</div><DataTable rows={c.filter(x=>['Em atenÃ§Ã£o','Inativo'].includes(x.status))} columns={["cliente","representante","uf","faturamento","pedidos","dias_sem_compra","status"]} /></>; })()}
                    </div>
                  )}

                  {subInteligencia === "abc" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-white">ABC, Pareto & concentraÃ§Ã£o</h3><p className="text-xs text-slate-400">Curva 80/95% e participaÃ§Ã£o dos Top 5, 10 e 20.</p></div><div className="flex gap-2 text-xs"><select id="abcDim" className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option value="cliente">Clientes</option><option value="produto">Produtos</option><option value="familia">FamÃ­lias</option><option value="representante">Representantes</option></select></div></div>
                      {(() => { const abc=curvaAbc(dadosFiltrados,"cliente","faturamento"); const conc=concentracaoTop(abc,"faturamento"); return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Classe A",abc.filter(x=>x.classe_abc==='A').length],["Top 5",conc.top_5],["Top 10",conc.top_10],["Top 20",conc.top_20]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-xl font-bold text-orange-400">{l==='Classe A'?v:formatarPercentual(v)}</div></div>)}</div><DataTable rows={abc} columns={["cliente","faturamento","participacao","participacao_acumulada","classe_abc"]} /></>; })()}
                    </div>
                  )}

                  {subInteligencia === "mix" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <h3 className="text-base font-bold text-white">Mix & venda cruzada</h3><p className="text-xs text-slate-400">Amplitude do mix, oportunidades ainda nÃ£o compradas e pares no mesmo pedido.</p>
                      {(() => { const mix=mixClientes(dadosFiltrados); const cliente=mix[0]?.cliente || ""; const opp=oportunidadesCrossSell(dadosFiltrados,cliente,"familia",15); const pares=paresCompradosJuntos(dadosFiltrados,"familia",20); return <><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">FamÃ­lias mÃ©dias por cliente</span><div className="text-xl font-bold text-orange-400">{(mix.reduce((s,x)=>s+x.familias,0)/Math.max(mix.length,1)).toFixed(1).replace('.',',')}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Clientes com 1 famÃ­lia</span><div className="text-xl font-bold text-sky-400">{mix.filter(x=>x.familias===1).length}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Oportunidades do lÃ­der</span><div className="text-xl font-bold text-green-400">{opp.length}</div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={opp} columns={["item","clientes_compradores","penetracao_clientes","faturamento_global"]} /><DataTable rows={pares} columns={["item_a","item_b","pedidos_juntos","clientes_juntos"]} /></div></>; })()}
                    </div>
                  )}

                  {subInteligencia === "preco_dre" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                      <h3 className="text-base font-bold text-white">PreÃ§o, margem & DRE aproximada</h3>
                      {(() => { const dre=dreAproximada(dadosFiltrados)[0] || {}; const precos=precoMedioPorItem(dadosFiltrados,"produto"); const desvios=desviosPreco(dadosFiltrados,"produto","cliente",0.15); return <><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["Faturamento",dre.faturamento],["Receita lÃ­quida",dre.receita_liquida_aprox],["Custo",dre.custo],["Resultado",dre.resultado_aprox],["Margem",dre.margem_aprox_pct]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-base font-bold text-orange-400">{l==='Margem'?formatarPercentual(v):formatarMoeda(v)}</div></div>)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={precos} columns={["produto","preco_medio","quantidade","faturamento","clientes","pedidos"]} /><DataTable rows={desvios} columns={["produto","cliente","preco_medio_grupo","preco_medio_item","desvio_pct"]} /></div></>; })()}
                    </div>
                  )}

                  {subInteligencia === "calendario" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">CalendÃ¡rio & ritmo</h3><p className="text-xs text-slate-400">Resumo diÃ¡rio, dias Ãºteis, mÃ©dia diÃ¡ria e melhores dias do perÃ­odo.</p>{(() => { const diario=resumoDiarioInteligencia(dadosFiltrados); const media=diario.length?diario.reduce((s,x)=>s+x.faturamento,0)/diario.length:0; const melhor=[...diario].sort((a,b)=>b.faturamento-a.faturamento)[0]; return <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento mÃ©dio/dia</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(media)}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Dias com movimento</span><div className="text-xl font-bold text-sky-400">{diario.length}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Melhor dia</span><div className="text-xl font-bold text-green-400">{melhor?.data || '-'}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento do melhor dia</span><div className="text-xl font-bold text-green-400">{formatarMoeda(melhor?.faturamento || 0)}</div></div></div><DataTable rows={diario} columns={["data","dia_semana","faturamento","quantidade","pedidos","clientes"]} /></>; })()}</div>
                  )}

                  {subInteligencia === "rep_alertas" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">Representantes & alertas</h3>{(() => { const cart=classificarCarteiraClientes(dadosFiltrados); const reps=painelRepresentantesInteligencia(dadosFiltrados,cart); const alertas=gerarAlertasComerciais(dadosFiltrados); return <><DataTable rows={reps} columns={["representante","faturamento","pedidos","clientes","clientes_ativos","clientes_atencao","clientes_inativos","concentracao_top5_clientes"]} /><DataTable rows={alertas} columns={["nivel","tipo","mensagem","valor","referencia"]} /></>; })()}</div>
                  )}

                  {subInteligencia === "fechamento" && (
                    <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800"><h3 className="text-base font-bold text-white">Fechamento mensal automÃ¡tico</h3>{(() => { const p=dadosMensais[dadosMensais.length-1]?.ano_mes || ""; const [ano,mes]=p ? p.split('-').map(Number) : [new Date().getFullYear(),new Date().getMonth()+1]; const f=fechamentoMensalInteligencia(dadosFiltrados,ano,mes); const r=f.resumo as any; return <><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[["Faturamento",r.faturamento||0],["Quantidade",r.quantidade||0],["Pedidos",r.pedidos||0],["Clientes",r.clientes||0],["Ticket",r.ticket_unitario||0]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">{l}</span><div className="text-base font-bold text-orange-400">{['Faturamento','Ticket'].includes(l)?formatarMoeda(v):formatarInteiro(v)}</div></div>)}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Novos",f.movimentos.novos.length],["Recorrentes",f.movimentos.recorrentes.length],["Recuperados",f.movimentos.recuperados.length],["Perdidos",f.movimentos.perdidos.length]].map(([l,v]:any)=><div key={l} className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Clientes {l}</span><div className="text-xl font-bold text-sky-400">{v}</div></div>)}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DataTable rows={f.top_clientes} columns={["cliente","faturamento","pedidos","clientes"]} /><DataTable rows={f.top_produtos} columns={["produto","faturamento","quantidade","pedidos"]} /></div></>; })()}</div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 8: REGIÃ•ES */}
              {/* ========================================================= */}
              {abaAtiva === "regioes" && (
                <div className="space-y-6">
                  <div className="flex justify-end"><SeletorMetrica value={metricaGeo} onChange={setMetricaGeo} /></div>
                  {/* Mapa do Brasil */}
                  <MapBrasil dadosUf={dadosPorUf} onSelectUf={setUfMapaSelecionada} />
                  <MapMunicipios dadosMunicipios={dadosMunicipios} selectedUf={ufMapaSelecionada} onClearSelection={() => setUfMapaSelecionada(null)} />

                  {/* GrÃ¡ficos Regionais */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Faturamento por MacrorregiÃ£o */}
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-3">{metricaGeo} por MacrorregiÃ£o</h3>
                      {(() => {
                        const regAgg = agregar(
                          dadosFiltrados.filter((d) => d.regiao !== "NÃ£o identificado"),
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
                          dadosFiltrados.filter((d) => d.cidade !== "NÃ£o identificado"),
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
                        Desempenho por vendedor, evoluÃ§Ã£o de vendas e carteira por regiÃ£o.
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
                            <h3 className="text-sm font-bold text-white mb-3">Detalhamento da ForÃ§a de Vendas</h3>
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
                      Mix por natureza de operaÃ§Ã£o e distribuiÃ§Ã£o de faturamento por recurso.
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
              {/* ABA: PREVISÃ•ES */}
              {/* ========================================================= */}
              {abaAtiva === "previsoes" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-orange-900/70 bg-orange-950/20 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><h2 className="text-lg font-bold text-white">ParÃ¢metros exclusivos da previsÃ£o</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">Esses controles alteram somente a previsÃ£o. Os filtros gerais continuam definindo a carteira comercial, mas o perÃ­odo abaixo Ã© independente do perÃ­odo da barra lateral.</p></div>
                      <button type="button" onClick={() => { setPrevisaoDataInicio(meta?.data_min ? (meta.data_min.toISOString().slice(0, 10) > "2022-01-01" ? meta.data_min.toISOString().slice(0, 10) : "2022-01-01") : "2022-01-01"); setPrevisaoDataFim(meta?.data_max?.toISOString().slice(0, 10) || ""); setIncluirMesVigentePrevisao(true); setPrevisaoVisualizacaoInicio(""); setMetricaPrevisao("Faturamento"); setHorizontePrevisao(6); }} className="rounded-lg border border-orange-700/70 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10">Restaurar padrÃ£o</button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Data inicial do histÃ³rico</span><input type="date" value={previsaoDataInicio} onChange={(e) => setPrevisaoDataInicio(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] leading-4 text-slate-500">Primeiro dia usado para treinar o modelo.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Data final do histÃ³rico</span><input type="date" value={previsaoDataFim} onChange={(e) => setPrevisaoDataFim(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] leading-4 text-slate-500">Ãšltimo dia considerado antes da projeÃ§Ã£o.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">O que projetar</span><select value={metricaPrevisao} onChange={(e) => setMetricaPrevisao(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">{METRICAS_PAINEL.map((metrica) => <option key={metrica} value={metrica}>{metrica}</option>)}</select><span className="text-[10px] leading-4 text-slate-500">Escolha faturamento, quantidade, pedidos ou clientes.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Meses Ã  frente</span><select value={horizontePrevisao} onChange={(e) => setHorizontePrevisao(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select><span className="text-[10px] leading-4 text-slate-500">Quantidade de meses futuros apÃ³s o Ãºltimo mÃªs do histÃ³rico.</span></label>
                      <label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Mostrar passado a partir de</span><input type="date" value={previsaoVisualizacaoInicio} min={previsaoDataInicio || undefined} onChange={(e) => setPrevisaoVisualizacaoInicio(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] leading-4 text-slate-500">SÃ³ muda o que aparece no grÃ¡fico e nas tabelas. NÃ£o muda o cÃ¡lculo.</span></label>
                      <label className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300"><input type="checkbox" checked={incluirMesVigentePrevisao} onChange={(e) => setIncluirMesVigentePrevisao(e.target.checked)} className="mt-0.5 accent-orange-500" /><span><strong className="block text-white">Incluir mÃªs vigente</strong><span className="mt-1 block text-[10px] leading-4 text-slate-500">Ligado: estima o fechamento do mÃªs atual mesmo incompleto. Desligado: usa somente meses atÃ© a data final.</span></span></label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4 text-[11px] leading-5"><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-orange-300">HistÃ³rico</strong><p className="text-slate-400">SÃ£o necessÃ¡rios pelo menos 6 meses com registros. AtÃ© 24 meses recentes pesam mais na tendÃªncia.</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-sky-300">Retroativo</strong><p className="text-slate-400">Meses passados sÃ£o recalculados usando apenas os meses anteriores, para medir o erro do modelo.</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><strong className="text-emerald-300">Futuro</strong><p className="text-slate-400">O cÃ¡lculo pode usar tendÃªncia, sazonalidade do mesmo mÃªs ou mÃ©dias recentes, conforme o histÃ³rico indicar.</p></div><div className="rounded-lg border border-violet-800/60 bg-violet-950/20 p-3"><strong className="text-violet-300">CalibraÃ§Ã£o automÃ¡tica</strong><p className="text-slate-400">O sistema compara quatro modelos e escolhe o que teve menor WAPE nos meses histÃ³ricos: <span className="text-white">{previsaoMensal.metodo}</span>.</p></div></div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><h3 className="text-sm font-bold text-white">Fatores externos: histÃ³rico e futuro</h3><p className="text-xs text-slate-400 mt-1">Cruza a mÃ©trica selecionada com chuva e Selic histÃ³ricas e tambÃ©m mostra previsÃµes futuras. AssociaÃ§Ã£o nÃ£o prova causalidade.</p></div>
                      <div className="flex flex-wrap items-end gap-3 text-xs text-slate-300">
                        <label className="flex flex-col gap-1">AbrangÃªncia<select value={abrangenciaFatores} onChange={(e) => setAbrangenciaFatores(e.target.value)} className="min-w-[190px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"><option value="cidade">MunicÃ­pio individual</option><option value="clientes">Cidades dos clientes</option><option value="uf">Estados selecionados</option><option value="regiao">RegiÃ£o</option><option value="brasil">Todo o Brasil</option></select></label>
                        {abrangenciaFatores === "cidade" && <label className="flex flex-col gap-1">MunicÃ­pio<select value={cidadeFatoresExternos} onChange={(e) => setCidadeFatoresExternos(e.target.value)} className="min-w-[190px] max-w-[240px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"><option value="">Selecione</option>{cidadesFatoresExternos.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}</select></label>}
                        {abrangenciaFatores === "regiao" && <label className="flex flex-col gap-1">RegiÃ£o<select value={regiaoFatores} onChange={(e) => setRegiaoFatores(e.target.value)} className="min-w-[150px] bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5">{REGIOES_BRASIL.map((regiao) => <option key={regiao} value={regiao}>{regiao}</option>)}</select></label>}
                        {abrangenciaFatores === "uf" && <div className="max-w-[360px]"><div className="mb-1 flex items-center gap-2"><span>Estados</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setUfsFatores(opcoesFiltros.ufs)}>Selecionar todos</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setUfsFatores([])}>Limpar</button></div><div className="flex max-h-20 flex-wrap gap-x-2 gap-y-1 overflow-y-auto">{opcoesFiltros.ufs.map((uf) => <label key={uf} className="flex items-center gap-1"><input type="checkbox" checked={ufsFatores.includes(uf)} onChange={(e) => setUfsFatores((atuais) => e.target.checked ? [...atuais, uf] : atuais.filter((item) => item !== uf))} />{uf}</label>)}</div></div>}
                        {abrangenciaFatores === "clientes" && <div className="max-w-[420px]"><div className="mb-1 flex items-center gap-2"><span>Cidades dos clientes</span><button type="button" className="text-[10px] text-sky-300 hover:text-white" onClick={() => setCidadesSelecionadasFatores(cidadesClientesFatores.slice(0, 40).map((item) => `${item.cidade}|${item.uf}`))}>Selecionar atÃ© 40</button><button type="button" className="text-[10px] text-slate-400 hover:text-white" onClick={() => setCidadesSelecionadasFatores([])}>Limpar</button></div><div className="flex max-h-20 flex-wrap gap-x-2 gap-y-1 overflow-y-auto">{cidadesClientesFatores.slice(0, 40).map((item) => { const key = `${item.cidade}|${item.uf}`; return <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={cidadesSelecionadasFatores.includes(key)} onChange={(e) => setCidadesSelecionadasFatores((atuais) => e.target.checked ? [...atuais, key].slice(0, 40) : atuais.filter((value) => value !== key))} />{item.cidade}/{item.uf}</label>; })}</div></div>}
                      </div>
                    </div>
                    {fatoresExternosQuery.isFetching && <p className="mt-3 text-xs text-sky-300">Consultando fontes oficiais e meteorolÃ³gicas...</p>}
                    {fatoresExternosQuery.error && <p className="mt-3 text-xs text-amber-300">NÃ£o foi possÃ­vel consultar os fatores externos agora. A previsÃ£o histÃ³rica continua disponÃ­vel.</p>}
                    {fatoresExternosQuery.data?.avisos.map((aviso) => <p key={aviso} className="mt-2 text-xs text-amber-300">{aviso}</p>)}
                    {serieFatoresExternos.length > 0 && <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={serieFatoresExternos} margin={{ top: 10, right: 24, left: 20, bottom: 34 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(serieFatoresExternos.length)} angle={serieFatoresExternos.length > 18 ? -28 : -18} textAnchor="end" height={serieFatoresExternos.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis yAxisId="vendas" stroke={CEMAG_BLUE} fontSize={10} tickFormatter={(v) => formatarMetrica(v, metricaPrevisao)} /><YAxis yAxisId="fatores" orientation="right" stroke="#34D399" fontSize={10} tickFormatter={(v) => `${Number(v).toFixed(0)}`} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(value: any, name: any) => name === "Chuva (mm)" ? [`${Number(value).toFixed(1)} mm`, name] : name === "Selic mÃ©dia" ? [`${Number(value).toFixed(2)}%`, name] : [formatarMetrica(value, metricaPrevisao), metricaPrevisao]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} /><Line yAxisId="vendas" type="monotone" dataKey="vendas" name={metricaPrevisao} stroke={CEMAG_BLUE} strokeWidth={2.5} dot={false} connectNulls={false} /><Line yAxisId="fatores" type="monotone" dataKey="chuva_mm" name="Chuva (mm)" stroke="#34D399" strokeWidth={1.8} dot={false} connectNulls={false} /><Line yAxisId="fatores" type="monotone" dataKey="selic_media_pct" name="Selic mÃ©dia" stroke="#FBBF24" strokeWidth={1.8} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 space-y-3"><DataTable rows={fatoresExternosQuery.data.meses} exportName="fatores_externos_mensais" columns={["ano_mes", "selic_media_pct", "chuva_mm"]} percentColumns={[]} /><div className="text-[10px] leading-5 text-slate-500">ReferÃªncia geogrÃ¡fica: {fatoresExternosQuery.data.localidade || cidadeFatoresExternos}{fatoresExternosQuery.data.latitude != null ? ` (${fatoresExternosQuery.data.latitude.toFixed(3)}, ${fatoresExternosQuery.data.longitude?.toFixed(3)})` : ""}. Fontes: {fatoresExternosQuery.data.fontes.join("; ") || "nenhuma resposta disponÃ­vel"}.</div></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-orange-900/60 bg-orange-950/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-orange-300">Indicadores agrÃ­colas consumidos automaticamente</h4><p className="mt-1 text-[11px] text-slate-400">Dados de contexto para avaliar capacidade de investimento e atividade agrÃ­cola. Eles nÃ£o alteram a previsÃ£o principal sem validaÃ§Ã£o histÃ³rica.</p></div><span className="text-[10px] text-slate-500">IBGE {fatoresExternosQuery.data.indicadores_agro.ano_referencia || "-"}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">PTAX mÃ©dia</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.ptax_media_brl == null ? "-" : `R$ ${fatoresExternosQuery.data.indicadores_agro.ptax_media_brl.toFixed(2)}`}</div><div className="text-[10px] text-slate-500">BCB Â· perÃ­odo consultado</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">ProduÃ§Ã£o de cafÃ©</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_producao_t == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_producao_t.toLocaleString("pt-BR")} t`}</div><div className="text-[10px] text-slate-500">IBGE Â· Ãºltimo ano disponÃ­vel</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">Ãrea colhida de cafÃ©</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha.toLocaleString("pt-BR")} ha`}</div><div className="text-[10px] text-slate-500">IBGE Â· PAM</div></div><div className="rounded border border-slate-800 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">CrÃ©dito de investimento</div><div className="mt-1 text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl == null ? "-" : `R$ ${fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl.toLocaleString("pt-BR")}`}</div><div className="text-[10px] text-slate-500">SICOR/MDCR Â· {fatoresExternosQuery.data.indicadores_agro.credito_status === "indisponivel" ? "indisponÃ­vel" : fatoresExternosQuery.data.indicadores_agro.credito_status === "consultado" ? "consultado" : "aguardando escopo"}</div></div></div></div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-violet-900/60 bg-violet-950/20 p-4"><h4 className="text-sm font-semibold text-violet-300">PreÃ§os agrÃ­colas de mercado</h4><p className="mt-1 text-[11px] text-slate-400">Contratos futuros internacionais em USD, usados como sinal de mercado e nÃ£o como preÃ§o de venda nacional.</p><DataTable rows={fatoresExternosQuery.data.indicadores_agro.precos_agro} exportName="precos_agricolas_mercado" columns={["produto", "ticker", "valor_usd", "atualizado_em"]} /></div>}
                    {fatoresExternosQuery.data && <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4"><h4 className="text-sm font-semibold text-emerald-300">PrevisÃ£o de chuva â€” prÃ³ximos {previsaoChuvaFutura.length || 16} dias</h4><p className="mt-1 text-[11px] text-slate-400">PrevisÃ£o meteorolÃ³gica diÃ¡ria do Open-Meteo. NÃ£o Ã© usada para inventar meses alÃ©m do horizonte meteorolÃ³gico disponÃ­vel.</p><DataTable rows={previsaoChuvaFutura} exportName="previsao_chuva_futura" columns={["data", "chuva_mm", "probabilidade_chuva_pct"]} percentPointColumns={["probabilidade_chuva_pct"]} /></div>
                      <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4"><h4 className="text-sm font-semibold text-amber-300">Expectativa de Selic â€” Boletim Focus</h4><p className="mt-1 text-[11px] text-slate-400">Medianas/mÃ©dias de mercado por reuniÃ£o futura. SÃ£o expectativas do mercado, nÃ£o uma decisÃ£o garantida do Banco Central.</p><DataTable rows={expectativasSelicFuturas} exportName="expectativas_selic_focus" columns={["data_consulta", "reuniao", "media_pct", "mediana_pct", "respondentes"]} percentPointColumns={["media_pct", "mediana_pct"]} /></div>
                    </div>}
                    {fatoresExternosQuery.data && <div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/20 p-4"><h4 className="text-sm font-semibold text-sky-300">PrevisÃ£o climÃ¡tica sazonal â€” prÃ³ximos trimestres</h4><p className="mt-1 text-[11px] text-slate-400">CPTEC/INPE BAM-1.2. Ã‰ uma previsÃ£o probabilÃ­stica regional de trÃªs meses, nÃ£o uma promessa de chuva exata no municÃ­pio.</p><DataTable rows={previsaoSazonal} exportName="previsao_sazonal_cptec" columns={["modelo", "temporada", "periodo", "chuva_total_mm", "sinal_tercil", "valor_sinal", "atualizado_em"]} /></div>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">MÃ©trica</div><div className="text-sm font-semibold text-orange-300 mt-2">{metricaPrevisao}</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Meses histÃ³ricos</div><div className="text-xl font-bold text-white mt-2">{previsaoMensal.historicoMeses}</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">Horizonte</div><div className="text-xl font-bold text-orange-300 mt-2">{horizontePrevisao} meses</div></div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">CenÃ¡rios</div><div className="text-sm font-semibold text-sky-300 mt-2">Conservador Â· ProvÃ¡vel Â· Otimista</div><div className="text-[10px] text-slate-500 mt-1">Faixa pelo erro histÃ³rico</div></div><div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">MAPE histÃ³rico</div><div className="text-xl font-bold text-emerald-300 mt-2">{validacaoPrevisao.mape == null ? "-" : `${validacaoPrevisao.mape.toFixed(1)}%`}</div><div className="text-[10px] text-slate-500 mt-1">Erro percentual mÃ©dio em {validacaoPrevisao.pontos} mÃªs(es)</div></div><div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">MAE</div><div className="text-xl font-bold text-sky-300 mt-2">{validacaoPrevisao.mae == null ? "-" : formatarMetrica(validacaoPrevisao.mae, metricaPrevisao)}</div><div className="text-[10px] text-slate-500 mt-1">Erro mÃ©dio em unidade da mÃ©trica</div></div><div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500">WAPE</div><div className="text-xl font-bold text-violet-300 mt-2">{validacaoPrevisao.wape == null ? "-" : `${validacaoPrevisao.wape.toFixed(1)}%`}</div><div className="text-[10px] text-slate-500 mt-1">Erro absoluto total Ã· realizado total</div></div>
                  </div>
                  {seriePrevisaoVisivel.length ? <>
                    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                      <h3 className="text-sm font-bold text-white mb-2">HistÃ³rico e prÃ³ximos {horizontePrevisao} meses â€” {metricaPrevisao}</h3>
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px]"><span className="mr-1 text-slate-500">Exibir:</span>{Object.entries(ROTULOS_SERIE_PREVISAO).map(([chave, rotulo]) => <label key={chave} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 transition ${seriesPrevisaoVisiveis[chave] ? "border-orange-500/60 bg-orange-500/10 text-orange-200" : "border-slate-700 bg-slate-950/40 text-slate-500"}`}><input type="checkbox" className="accent-orange-500" checked={seriesPrevisaoVisiveis[chave] ?? false} onChange={(event) => setSeriesPrevisaoVisiveis((atuais) => ({ ...atuais, [chave]: event.target.checked }))} />{rotulo}</label>)}</div>
                      {ultimoMesParcial && <p className="mb-3 text-[11px] text-amber-300">MÃªs vigente incluÃ­do: {ultimoMesParcial.ano_mes}. Realizado parcial: {formatarMetrica(ultimoMesParcial.parcial || 0, metricaPrevisao)} em {ultimoMesParcial.dias_decorridos || 0}/{ultimoMesParcial.dias_periodo || 0} dias. Fechamento estimado pelo ritmo diÃ¡rio: {formatarMetrica(ultimoMesParcial.fechamento || 0, metricaPrevisao)}{ultimoMesParcial.referencia_historica_mes != null ? ` Â· mÃ©dia do mesmo mÃªs em anos anteriores: ${formatarMetrica(ultimoMesParcial.referencia_historica_mes, metricaPrevisao)}` : ""}. Os meses seguintes usam tendÃªncia e sazonalidade.</p>}
                      <div className="mx-auto h-80 w-full max-w-[1500px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={seriePrevisaoVisivel} margin={{ top: 10, right: 20, left: 20, bottom: 34 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={intervaloEixoMensal(seriePrevisaoVisivel.length)} angle={seriePrevisaoVisivel.length > 18 ? -28 : -18} textAnchor="end" height={seriePrevisaoVisivel.length > 18 ? 48 : 38} stroke="#94A3B8" fontSize={10} /><YAxis stroke="#94A3B8" fontSize={10} tickFormatter={(v) => formatarMetrica(v, metricaPrevisao)} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(v: any, name: any) => [formatarMetrica(v, metricaPrevisao), rotuloSeriePrevisao(name)]} /><Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />{seriesPrevisaoVisiveis.realizado && <Line type="monotone" dataKey="realizado" name="Realizado" stroke={CEMAG_BLUE} strokeWidth={2.5} dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.previsao_retroativa && <Line type="monotone" dataKey="previsao_retroativa" name="ProvÃ¡vel retroativo" stroke="#A78BFA" strokeWidth={1.8} strokeDasharray="2 3" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.conservador_retroativo && <Line type="monotone" dataKey="conservador_retroativo" name="Conservador retroativo" stroke="#F87171" strokeWidth={1.2} strokeDasharray="2 4" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.otimista_retroativo && <Line type="monotone" dataKey="otimista_retroativo" name="Otimista retroativo" stroke="#34D399" strokeWidth={1.2} strokeDasharray="2 4" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.previsao && <Line type="monotone" dataKey="previsao" name="ProvÃ¡vel / fechamento" stroke={CEMAG_ORANGE} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />}{seriesPrevisaoVisiveis.conservador && <Line type="monotone" dataKey="conservador" name="Conservador" stroke="#F87171" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />}{seriesPrevisaoVisiveis.otimista && <Line type="monotone" dataKey="otimista" name="Otimista" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />}</LineChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-2">ExplicaÃ§Ã£o de cada previsÃ£o â€” {metricaPrevisao}</h3><p className="text-xs text-slate-400 mb-3">O cenÃ¡rio <strong className="text-orange-300">ProvÃ¡vel</strong> Ã© a estimativa principal do modelo. O <strong className="text-red-300">Conservador</strong> reduz esse valor e o <strong className="text-emerald-300">Otimista</strong> aumenta esse valor usando uma margem baseada no erro histÃ³rico.</p><DataTable rows={explicacaoPrevisoes} exportName="explicacao_previsoes" columns={["mes", "metrica", "conservador", "provavel", "otimista", "margem_pct", "explicacao"]} percentColumns={["margem_pct"]} metricColumns={{ conservador: metricaPrevisao, provavel: metricaPrevisao, otimista: metricaPrevisao }} /></div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">A anÃ¡lise detalhada dos meses anteriores foi movida para a aba <strong className="text-orange-300">AnÃ¡lise histÃ³rica</strong>, para manter esta tela focada na previsÃ£o e nos cenÃ¡rios.</div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-3">Valores previstos e retroativos â€” {metricaPrevisao}</h3><DataTable rows={seriePrevisaoVisivel.filter((x) => x.previsao != null || x.previsao_retroativa != null)} columns={["ano_mes", "realizado", "conservador_retroativo", "previsao_retroativa", "otimista_retroativo", "erro_retroativo", "conservador", "previsao", "otimista", "tipo"]} percentColumns={["erro_retroativo"]} metricColumns={{ realizado: metricaPrevisao, conservador_retroativo: metricaPrevisao, previsao_retroativa: metricaPrevisao, otimista_retroativo: metricaPrevisao, conservador: metricaPrevisao, previsao: metricaPrevisao, otimista: metricaPrevisao }} /></div>
                  </> : <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-5 text-sm">HistÃ³rico insuficiente apÃ³s os filtros atuais. SÃ£o necessÃ¡rios pelo menos seis meses com registros.</div>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: ANÃLISE HISTÃ“RICA */}
              {/* ========================================================= */}
              {abaAtiva === "analise_historica" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-orange-900/70 bg-orange-950/20 p-5">
                    <h2 className="text-lg font-bold text-white">AnÃ¡lise dos meses anteriores</h2>
                    <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-300">Aqui ficam as possÃ­veis explicaÃ§Ãµes e curiosidades dos resultados passados. A leitura combina previsÃ£o retroativa, comparaÃ§Ã£o histÃ³rica, mix comercial, clientes, representantes e fatores externos. SÃ£o hipÃ³teses para investigaÃ§Ã£o, nÃ£o prova de causalidade.</p>
                  </div>
                  {explicacoesHistorico.length ? <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(() => { const acima = explicacoesHistorico.filter((x) => Number(x.variacao_vs_previsto_pct || 0) >= 10).length; const abaixo = explicacoesHistorico.filter((x) => Number(x.variacao_vs_previsto_pct || 0) <= -10).length; const confiaveis = explicacoesHistorico.filter((x) => x.confianca_explicacao === "Alta").length; const melhor = explicacoesHistorico.reduce((a, b) => Number(b.variacao_vs_previsto_pct || -Infinity) > Number(a.variacao_vs_previsto_pct || -Infinity) ? b : a, explicacoesHistorico[0]); return <>{[["Meses acima do modelo", acima, "text-emerald-300"], ["Meses abaixo do modelo", abaixo, "text-red-300"], ["ExplicaÃ§Ãµes de alta confianÃ§a", confiaveis, "text-sky-300"], ["Maior surpresa positiva", melhor?.mes || "-", "text-orange-300"]].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"><div className="text-[10px] uppercase text-slate-500">{label}</div><div className={`mt-2 text-xl font-bold ${color}`}>{value}</div></div>)}</>; })()}
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                      <h3 className="mb-2 text-sm font-bold text-white">Como interpretar</h3>
                      <p className="text-xs leading-5 text-slate-400">As contribuiÃ§Ãµes de tipo de produto, cliente e representante mostram as maiores variaÃ§Ãµes contra o mÃªs anterior. A confianÃ§a aumenta quando hÃ¡ volume comercial suficiente e referÃªncias histÃ³ricas comparÃ¡veis. Chuva e Selic sÃ£o sinais de contexto e nÃ£o devem ser tratados como causa isolada.</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"><h3 className="mb-2 text-sm font-bold text-white">ExplicaÃ§Ãµes, contribuiÃ§Ãµes e curiosidades por mÃªs</h3><DataTable rows={explicacoesHistorico} exportName="explicacoes_meses_anteriores" columns={["mes", "realizado", "previsto_retroativo", "variacao_vs_previsto_pct", "variacao_vs_mes_anterior_pct", "variacao_vs_media_mes_historico_pct", "quantidade", "pedidos", "clientes", "principais_tipos", "principais_clientes", "principais_representantes", "confianca_explicacao", "chuva_mm", "selic_media_pct", "leitura"]} percentColumns={["variacao_vs_previsto_pct", "variacao_vs_mes_anterior_pct", "variacao_vs_media_mes_historico_pct"]} percentPointColumns={["selic_media_pct"]} metricColumns={{ realizado: metricaPrevisao, previsto_retroativo: metricaPrevisao }} /></div>
                  </> : <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">Ainda nÃ£o hÃ¡ meses retroativos suficientes no perÃ­odo exibido. Ajuste o perÃ­odo da previsÃ£o ou os filtros comerciais para gerar a anÃ¡lise.</div>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: CENTRAL DE DADOS EXTERNOS */}
              {/* ========================================================= */}
              {abaAtiva === "central_externa" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Central de Dados Externos</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">Use esta aba para puxar e conferir informaÃ§Ãµes de clima, juros, produÃ§Ã£o, crÃ©dito e commodities antes de utilizÃ¡-las nas explicaÃ§Ãµes dos meses ou na previsÃ£o comercial.</p></div><button type="button" onClick={() => void fatoresExternosQuery.refetch()} disabled={fatoresExternosQuery.isFetching || !cidadeFatoresExternos} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">{fatoresExternosQuery.isFetching ? "Consultando fontes..." : "Puxar informaÃ§Ãµes agora"}</button></div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4"><label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">PerÃ­odo inicial da consulta</span><input type="date" value={centralDataInicio} onChange={(event) => setCentralDataInicio(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] text-slate-500">Primeiro mÃªs histÃ³rico solicitado Ã s fontes.</span></label><label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">PerÃ­odo final da consulta</span><input type="date" value={centralDataFim} onChange={(event) => setCentralDataFim(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" /><span className="text-[10px] text-slate-500">Ãšltimo mÃªs histÃ³rico solicitado Ã s fontes.</span></label><label className="flex flex-col gap-1 text-xs text-slate-300"><span className="font-semibold">Localidade da consulta</span><select value={cidadeFatoresExternos} onChange={(event) => { setAbrangenciaFatores("cidade"); setCidadeFatoresExternos(event.target.value); }} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"><option value="">Selecione um municÃ­pio</option>{cidadesFatoresExternos.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}</select><span className="text-[10px] text-slate-500">A Central usa esta cidade para clima, NASA e Open-Meteo.</span></label><div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300"><strong className="block text-white">AbrangÃªncia atual</strong><span className="mt-1 block text-cyan-300">{descricaoAbrangenciaFatores}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">Para consultar regiÃµes, estados ou Brasil, use a aba PrevisÃµes Agro.</span></div></div>
                  </div>
                  {fatoresExternosQuery.isFetching && <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4 text-sm text-sky-300">Consultando as fontes selecionadas. Isso pode levar alguns segundos em abrangÃªncias nacionais.</div>}
                  {fatoresExternosQuery.error && <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">A consulta retornou uma falha. Tente novamente ou reduza a abrangÃªncia. Os dados jÃ¡ disponÃ­veis sÃ£o preservados.</div>}
                  {fatoresExternosQuery.data && <>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">Status das fontes consultadas</h3><p className="mt-1 text-[11px] text-slate-500">Atualizado em {new Date(fatoresExternosQuery.data.atualizado_em).toLocaleString("pt-BR")}</p></div><div className="flex flex-wrap gap-2">{statusFontesExternas.map((fonte) => <span key={fonte.nome} className={`rounded-full border px-2.5 py-1 text-[10px] ${fonte.status === "ok" ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : fonte.status === "aviso" ? "border-amber-700/60 bg-amber-950/30 text-amber-300" : "border-slate-700 bg-slate-950/40 text-slate-400"}`}>{fonte.nome}: {fonte.status}</span>)}</div></div></div>
                    <div className="mt-4 rounded-xl border border-cyan-900/60 bg-cyan-950/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-cyan-300">Fontes agropecuÃ¡rias prontas para atualizaÃ§Ã£o</h3><p className="mt-1 text-[11px] text-slate-400">A atualizaÃ§Ã£o manual desta consulta verifica novamente cada fonte. Dados ausentes ou ainda nÃ£o publicados permanecem identificados, nunca como zero.</p></div><span className="rounded-full border border-cyan-700/60 px-2 py-1 text-[10px] text-cyan-300">AtualizaÃ§Ã£o manual ativa</span></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{(fatoresExternosQuery.data.fontes_agro || []).map((fonte) => <div key={fonte.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><div className="flex items-start justify-between gap-2"><strong className="text-xs text-white">{fonte.nome}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${fonte.status === "consultado" ? "bg-emerald-950/50 text-emerald-300" : fonte.status === "indisponivel" ? "bg-amber-950/50 text-amber-300" : "bg-slate-800 text-slate-400"}`}>{fonte.status === "consultado" ? "consultada" : fonte.status === "indisponivel" ? "indisponÃ­vel" : "nÃ£o consultada"}</span></div><p className="mt-2 text-[10px] text-slate-400">{fonte.fonte} Â· {fonte.periodicidade}</p><p className="mt-1 text-[10px] text-slate-500">PerÃ­odo: {fonte.periodo_disponivel}</p>{fonte.atualizado_em && <p className="mt-1 text-[10px] text-slate-500">Atualizada: {new Date(fonte.atualizado_em).toLocaleString("pt-BR")}</p>}<p className="mt-2 text-[10px] leading-4 text-slate-400">{fonte.observacao}</p></div>)}</div></div>
                    <div className="grid gap-5 xl:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">SÃ©rie histÃ³rica mensal</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">Dados que podem ser comparados aos meses faturados: chuva acumulada e Selic mÃ©dia.</p><DataTable rows={fatoresExternosQuery.data.meses || []} exportName="central_dados_mensais" columns={["ano_mes", "chuva_mm", "selic_media_pct"]} percentPointColumns={["selic_media_pct"]} /></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">PrevisÃµes e expectativas futuras</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">NÃ£o sÃ£o realizadas: servem como contexto para os prÃ³ximos meses.</p><DataTable rows={expectativasSelicFuturas} exportName="central_expectativas_selic" columns={["data_consulta", "reuniao", "media_pct", "mediana_pct", "respondentes"]} percentPointColumns={["media_pct", "mediana_pct"]} /></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Clima global â€” NOAA/CPC</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">ONI indica El NiÃ±o, La NiÃ±a ou neutralidade; Ã© contexto climÃ¡tico, nÃ£o previsÃ£o de vendas.</p><DataTable rows={fatoresExternosQuery.data.indices_climaticos || []} exportName="central_indice_oni" columns={["indice", "periodo", "anomalia_c", "classificacao"]} /></div></div>
                    <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Indicadores agrÃ­colas</h3><DataTable rows={[fatoresExternosQuery.data.indicadores_agro]} exportName="central_indicadores_agro" columns={["ano_referencia", "ptax_media_brl", "cafe_producao_t", "cafe_area_colhida_ha", "credito_investimento_brl", "credito_status"]} /></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">PreÃ§os de commodities</h3><DataTable rows={fatoresExternosQuery.data.indicadores_agro.precos_agro || []} exportName="central_precos_commodities" columns={["produto", "ticker", "valor_usd", "atualizado_em"]} /></div></div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Avisos, limitaÃ§Ãµes e fontes</h3><div className="mt-3 space-y-2 text-xs text-slate-400">{(fatoresExternosQuery.data.avisos || []).map((aviso) => <div key={aviso} className="text-amber-300">Aviso: {aviso}</div>)}<div><strong className="text-slate-300">Fontes:</strong> {(fatoresExternosQuery.data.fontes || []).join("; ") || "nenhuma fonte retornada"}</div></div></div>
                  </>}
                  {!fatoresExternosQuery.data && !fatoresExternosQuery.isFetching && <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">Escolha a localidade, ajuste o perÃ­odo se necessÃ¡rio e clique em <strong className="text-cyan-300">Puxar informaÃ§Ãµes agora</strong> para consultar as fontes.</div>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: PREVISÃ•ES AGRO */}
              {/* ========================================================= */}
              {(abaAtiva === "previsoes_agro" || abaAtiva === "central_externa") && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-emerald-900/60"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-white">PrevisÃµes Agro e fatores externos</h2><p className="text-xs text-slate-400 mt-1">Painel separado para clima, juros, produÃ§Ã£o agrÃ­cola, crÃ©dito rural e preÃ§os de commodities. Os indicadores nÃ£o alteram a previsÃ£o comercial sem validaÃ§Ã£o histÃ³rica.</p></div><div className="flex flex-wrap items-end justify-end gap-3"><div className="text-right text-[11px] text-slate-500">{descricaoAbrangenciaFatores}</div><button type="button" onClick={() => void fatoresExternosQuery.refetch()} disabled={fatoresExternosQuery.isFetching || localidadesFatoresSelecionadas.length === 0} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">{fatoresExternosQuery.isFetching ? "Atualizando..." : "Atualizar APIs"}</button></div></div></div>
                  {fatoresExternosQuery.isFetching && <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4 text-sm text-sky-300">Consultando APIs oficiais e fontes de mercado...</div>}
                  {fatoresExternosQuery.error && <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">As fontes externas nÃ£o responderam completamente. O painel preserva os dados disponÃ­veis e tentarÃ¡ novamente.</div>}
                  {fatoresExternosQuery.data && <>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">Status das fontes</h3><p className="mt-1 text-[11px] text-slate-500">Ãšltima consulta: {new Date(fatoresExternosQuery.data.atualizado_em).toLocaleString("pt-BR")}</p></div><div className="flex flex-wrap gap-2">{statusFontesExternas.map((fonte) => <span key={fonte.nome} className={`rounded-full border px-2.5 py-1 text-[10px] ${fonte.status === "ok" ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : fonte.status === "aviso" ? "border-amber-700/60 bg-amber-950/30 text-amber-300" : "border-slate-700 bg-slate-950/40 text-slate-400"}`}><span className="mr-1">{fonte.status === "ok" ? "â—" : fonte.status === "aviso" ? "!" : "â€“"}</span>{fonte.nome}: {fonte.status}</span>)}</div></div></div>
                    {indiceAgro && <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-orange-300">Ãndice de Ambiente AgropecuÃ¡rio</h3><p className="mt-1 text-[11px] text-slate-400">Indicador de contexto de 0 a 100. NÃ£o Ã© probabilidade de venda e nÃ£o altera automaticamente a previsÃ£o comercial.</p></div><div className={`rounded-full px-4 py-2 text-lg font-black ${indiceAgro.score >= 65 ? "bg-emerald-500/20 text-emerald-300" : indiceAgro.score <= 35 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}`}>{indiceAgro.score}/100 Â· {indiceAgro.classe}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{indiceAgro.componentes.map((item) => <div key={item.nome} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[10px] uppercase text-slate-500">{item.nome}</div><div className={`mt-1 text-lg font-bold ${item.valor > 0 ? "text-emerald-300" : item.valor < 0 ? "text-red-300" : "text-slate-300"}`}>{item.valor > 0 ? "+" : ""}{item.valor} pts</div><div className="text-[10px] leading-4 text-slate-500">{item.explicacao}</div></div>)}</div>{indiceAgro.alertas.length > 0 && <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-200"><strong>Alertas:</strong> {indiceAgro.alertas.join(" ")}</div>}</div>}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Chuva futura</div><div className="mt-2 text-2xl font-bold text-emerald-300">{previsaoChuvaFutura.length} dias</div><div className="text-[11px] text-slate-400">Open-Meteo</div></div><div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Selic futura</div><div className="mt-2 text-2xl font-bold text-amber-300">{expectativasSelicFuturas.length} reuniÃµes</div><div className="text-[11px] text-slate-400">Focus / Banco Central</div></div><div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Clima sazonal</div><div className="mt-2 text-2xl font-bold text-sky-300">{previsaoSazonal.length} perÃ­odos</div><div className="text-[11px] text-slate-400">CPTEC/INPE</div></div><div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4"><div className="text-[10px] uppercase text-slate-500">Commodities</div><div className="mt-2 text-2xl font-bold text-violet-300">{fatoresExternosQuery.data.indicadores_agro.precos_agro.filter((item) => item.valor_usd != null).length}/3</div><div className="text-[11px] text-slate-400">CafÃ©, milho e soja</div></div></div>
                    <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Clima futuro e sazonal</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">A previsÃ£o diÃ¡ria Ã© curta; a sazonal Ã© probabilÃ­stica.</p><DataTable rows={previsaoChuvaFutura} exportName="agro_chuva_futura" columns={["data", "chuva_mm", "probabilidade_chuva_pct"]} percentPointColumns={["probabilidade_chuva_pct"]} /><div className="mt-4"><DataTable rows={previsaoSazonal} exportName="agro_clima_sazonal" columns={["modelo", "periodo", "chuva_total_mm", "sinal_tercil", "valor_sinal"]} /></div></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Selic e crÃ©dito rural</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">Expectativas de mercado e status da consulta SICOR/MDCR.</p><DataTable rows={expectativasSelicFuturas} exportName="agro_selic_focus" columns={["data_consulta", "reuniao", "media_pct", "mediana_pct", "respondentes"]} percentPointColumns={["media_pct", "mediana_pct"]} /><div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="text-[10px] uppercase text-slate-500">CrÃ©dito de investimento</div><div className="mt-1 text-xl font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl == null ? "NÃ£o disponÃ­vel" : `R$ ${fatoresExternosQuery.data.indicadores_agro.credito_investimento_brl.toLocaleString("pt-BR")}`}</div><div className="mt-1 text-[11px] text-slate-500">Status: {fatoresExternosQuery.data.indicadores_agro.credito_status}</div></div></div></div>
                    <div className="grid gap-5 xl:grid-cols-2"><div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-4"><h3 className="text-sm font-bold text-orange-300">ProduÃ§Ã£o agrÃ­cola â€” IBGE/SIDRA</h3><div className="mt-3 grid grid-cols-2 gap-3"><div><div className="text-[10px] uppercase text-slate-500">ProduÃ§Ã£o de cafÃ©</div><div className="text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_producao_t == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_producao_t.toLocaleString("pt-BR")} t`}</div></div><div><div className="text-[10px] uppercase text-slate-500">Ãrea colhida</div><div className="text-lg font-bold text-white">{fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha == null ? "-" : `${fatoresExternosQuery.data.indicadores_agro.cafe_area_colhida_ha.toLocaleString("pt-BR")} ha`}</div></div></div><p className="mt-3 text-[11px] text-slate-500">Ãšltimo ano: {fatoresExternosQuery.data.indicadores_agro.ano_referencia || "-"}.</p></div><div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4"><h3 className="text-sm font-bold text-violet-300">PreÃ§os agrÃ­colas de mercado</h3><p className="mt-1 mb-3 text-[11px] text-slate-400">Futuros internacionais em USD; sÃ£o sinais de mercado, nÃ£o preÃ§os nacionais.</p><DataTable rows={fatoresExternosQuery.data.indicadores_agro.precos_agro} exportName="agro_precos_commodities" columns={["produto", "ticker", "valor_usd", "atualizado_em"]} /></div></div>
                    <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-orange-300">Mercado de mÃ¡quinas autopropulsadas â€” ANFAVEA</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Indicador nacional de quantidade de mÃ¡quinas vendidas no varejo. Ele serve para acompanhar o ritmo do mercado agrÃ­cola e rodoviÃ¡rio; nÃ£o Ã© faturamento da CEMAG e nÃ£o altera automaticamente a previsÃ£o comercial.</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] ${mercadoMaquinasAnfavea?.status === "consultado" ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : "border-amber-700/60 bg-amber-950/30 text-amber-300"}`}>{mercadoMaquinasAnfavea?.status === "consultado" ? "Dados consultados" : "IndisponÃ­vel"}</span></div><div className="mt-4 grid gap-3 md:grid-cols-4"><div className="rounded-lg border border-orange-900/50 bg-slate-950/40 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">O que mede</div><div className="mt-1 text-xs font-semibold text-white">Unidades vendidas</div><div className="mt-1 text-[10px] text-slate-400">Vendas no varejo</div></div><div className="rounded-lg border border-orange-900/50 bg-slate-950/40 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">AbrangÃªncia</div><div className="mt-1 text-xs font-semibold text-white">Brasil</div><div className="mt-1 text-[10px] text-slate-400">NÃ£o Ã© dado por estado ou cidade</div></div><div className="rounded-lg border border-orange-900/50 bg-slate-950/40 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">Periodicidade</div><div className="mt-1 text-xs font-semibold text-white">Mensal</div><div className="mt-1 text-[10px] text-slate-400">A ANFAVEA pode revisar meses anteriores</div></div><div className="rounded-lg border border-orange-900/50 bg-slate-950/40 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">PerÃ­odo recebido</div><div className="mt-1 text-xs font-semibold text-white">{periodoAnfavea}</div><div className="mt-1 text-[10px] text-slate-400">Apenas meses publicados</div></div></div><div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/20 p-4"><h4 className="text-xs font-bold text-sky-300">Como a busca Ã© feita</h4><ol className="mt-2 grid gap-1.5 text-[11px] leading-5 text-slate-300 md:grid-cols-4"><li><strong className="text-white">1.</strong> O servidor acessa a Central de Dados oficial da ANFAVEA.</li><li><strong className="text-white">2.</strong> Solicita vendas no varejo com periodicidade mensal.</li><li><strong className="text-white">3.</strong> LÃª as categorias e os meses publicados pela fonte.</li><li><strong className="text-white">4.</strong> Converte a resposta em tabela e grÃ¡fico no painel.</li></ol><p className="mt-2 text-[10px] text-slate-500">O sistema nÃ£o estima meses ausentes. Se a ANFAVEA ainda nÃ£o publicou determinado mÃªs, ele permanece fora da sÃ©rie e Ã© sinalizado no perÃ­odo recebido.</p></div><div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-orange-900/50 bg-slate-950/40 p-4"><label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs text-slate-300"><span className="font-semibold text-orange-300">Produto / tipo de mÃ¡quina no grÃ¡fico</span><select value={produtoAnfaveaSelecionado} onChange={(event) => setProdutoAnfaveaSelecionado(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"><option value="">Selecione um produto</option>{produtosAnfavea.map((produto) => <option key={produto} value={produto}>{rotuloProdutoAnfavea(produto)}</option>)}</select></label><span className="text-[10px] text-slate-500">O filtro altera o grÃ¡fico, a tabela mensal e o resumo anual da ANFAVEA.<br /><span className="text-orange-200/80"><strong>Totais:</strong> mÃ¡quinas agrÃ­colas e mÃ¡quinas rodoviÃ¡rias sÃ£o subtotais oficiais diferentes; nÃ£o some novamente com as categorias.</span></span></div><div className="mt-4 rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-4"><h4 className="text-xs font-bold text-cyan-300">Como manter atualizado</h4><ol className="mt-2 grid gap-1.5 text-[11px] leading-5 text-slate-300 md:grid-cols-3"><li><strong className="text-white">1.</strong> Abra esta aba e confira a localidade/perÃ­odo selecionados.</li><li><strong className="text-white">2.</strong> Clique em <strong className="text-cyan-300">Atualizar APIs</strong> para consultar novamente a fonte oficial.</li><li><strong className="text-white">3.</strong> Confira â€œPerÃ­odo recebidoâ€ e â€œConsultaâ€ antes de usar os nÃºmeros.</li></ol><p className="mt-2 text-[10px] text-slate-500">A atualizaÃ§Ã£o depende da publicaÃ§Ã£o mensal da ANFAVEA. Se o mÃªs ainda nÃ£o foi publicado, ele nÃ£o deve ser interpretado como zero. O botÃ£o atualiza a consulta manualmente; a base Ã© consultada novamente quando necessÃ¡rio, sem alteraÃ§Ã£o automÃ¡tica da previsÃ£o da CEMAG.</p></div>{mercadoMaquinasAnfavea?.series.length ? <><div className="mt-4 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={serieAnfaveaFiltrada.slice(-36)} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} /><XAxis dataKey="ano_mes" interval={3} angle={-28} textAnchor="end" height={52} stroke="#94A3B8" fontSize={10} /><YAxis stroke="#94A3B8" fontSize={10} /><RechartsTooltip contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155" }} formatter={(value: any) => [Number(value).toLocaleString("pt-BR"), "unidades"]} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="unidades" name={rotuloProdutoAnfavea(produtoAnfaveaSelecionado)} stroke="#fb923c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><DataTable rows={serieAnfaveaFiltrada.slice(-60)} exportName="anfavea_maquinas_mensal" columns={["ano_mes", "maquina", "unidades"]} /><DataTable rows={resumoAnfaveaFiltrado} exportName="anfavea_maquinas_anual" columns={["ano", "maquina", "unidades"]} /></div><p className="mt-3 text-[10px] text-slate-500">Fonte: {mercadoMaquinasAnfavea.fonte}. A Central de Dados informa que os dados sÃ£o atualizados mensalmente e estÃ£o sujeitos a revisÃ£o.</p></> : <p className="mt-4 text-xs text-amber-300">A consulta ANFAVEA nÃ£o retornou dados nesta atualizaÃ§Ã£o. Use â€œAtualizar APIsâ€ para tentar novamente.</p>}</div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><h3 className="text-sm font-bold text-white">Fontes e avisos</h3><div className="mt-3 space-y-2 text-[11px] text-slate-400">{fatoresExternosQuery.data.avisos.map((aviso) => <div key={aviso} className="text-amber-300">Aviso: {aviso}</div>)}<div>Fontes: {fatoresExternosQuery.data.fontes.join("; ") || "nenhuma"}</div><div>Consulta: {new Date(fatoresExternosQuery.data.atualizado_em).toLocaleString("pt-BR")}</div></div></div>
                  </>}
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA: DIAGNÃ“STICO DA BASE */}
              {/* ========================================================= */}
              {abaAtiva === "diagnostico" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h2 className="text-lg font-bold text-white">DiagnÃ³stico da Base</h2>
                    <p className="text-xs text-slate-400 mt-1">Qualidade e faturamento anual calculados conforme os filtros comerciais atuais.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {[
                      ["Originais da base", meta?.linhas_originais || 0, "text-slate-200"],
                      ["VÃ¡lidos na base", meta?.linhas_validas || 0, "text-emerald-300"],
                      ["Sem data", meta?.linhas_sem_data_removidas || 0, "text-amber-300"],
                      ["Meses esperados", diagnosticoBase.mesesEsperados.length, "text-sky-300"],
                      ["Meses sem venda", diagnosticoBase.mesesSemVenda.length, diagnosticoBase.mesesSemVenda.length ? "text-amber-300" : "text-emerald-300"],
                      ["UFs nÃ£o identificadas", diagnosticoBase.ufNaoIdentificada, diagnosticoBase.ufNaoIdentificada ? "text-amber-300" : "text-emerald-300"],
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
                        {[["Quantidade nÃ£o positiva", diagnosticoBase.qtdNaoPositiva], ["Faturamento nÃ£o positivo", diagnosticoBase.faturamentoNaoPositivo], ["Cidade nÃ£o identificada", diagnosticoBase.cidadeNaoIdentificada], ["Produto nÃ£o informado", diagnosticoBase.produtoNaoInformado], ["Cliente nÃ£o informado", diagnosticoBase.clienteNaoInformado]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b border-slate-800 py-2"><span className="text-slate-400">{label}</span><strong className={Number(value) ? "text-amber-300" : "text-emerald-300"}>{Number(value).toLocaleString("pt-BR")}</strong></div>)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-orange-500/30 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-orange-300">Como os nÃºmeros foram classificados</h3>
                        <p className="text-xs text-slate-400 mt-1">Esta tabela acompanha os filtros ativos, inclusive inÃ­cio e fim do perÃ­odo. A quantidade abaixo Ã© a soma das linhas filtradas, e nÃ£o o nÃºmero de registros.</p>
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
                        {dadosFiltrados.length.toLocaleString("pt-BR")} linhas ativas com tratamento de UF, moedas e correÃ§Ãµes.
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
                            <th className="py-2.5 px-3">EmissÃ£o</th>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Cidade</th>
                            <th className="py-2.5 px-3">UF</th>
                            <th className="py-2.5 px-3">Representante</th>
                            <th className="py-2.5 px-3">Produto</th>
                            <th className="py-2.5 px-3">FamÃ­lia</th>
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
                        Exibindo as primeiras 300 de {dadosFiltrados.length.toLocaleString("pt-BR")} linhas. A exportaÃ§Ã£o completa contÃ©m todos os registros.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ABA 13: CENTRAL DE EXPORTAÃ‡Ã•ES */}
              {/* ========================================================= */}
              {abaAtiva === "exportacoes" && (
                <div className="space-y-6">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Download className="w-5 h-5 text-orange-500" /><span>Central de exportaÃ§Ãµes</span></h2><p className="text-xs text-slate-400">Recorte adicional por anos e meses, tabelas prontas, gerador personalizado e base completa.</p></div>
                  {(() => {
                    const quantidadeAuditada = dadosFiltrados.reduce((s, d) => s + Number(d.quantidade || 0), 0);
                    const faturamentoAuditado = dadosFiltrados.reduce((s, d) => s + Number(d.faturamento || 0), 0);
                    const pedidosAuditados = new Set(dadosFiltrados.map((d) => d.pedido)).size;
                    const clientesAuditados = new Set(dadosFiltrados.map((d) => d.cliente)).size;
                    const resumoAuditoria = [
                      { indicador: "Linhas consideradas pelo filtro", valor: dadosFiltrados.length },
                      { indicador: "Quantidade total", valor: quantidadeAuditada },
                      { indicador: "Faturamento total", valor: faturamentoAuditado },
                      { indicador: "Pedidos Ãºnicos", valor: pedidosAuditados },
                      { indicador: "Clientes Ãºnicos", valor: clientesAuditados },
                      { indicador: "PerÃ­odo exibido", valor: periodoBaseTexto },
                      { indicador: "Data usada nos cÃ¡lculos", valor: "BAI_MOVIMENTAC (com fallback para BAI_EMISSAO)" },
                    ];
                    return <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-orange-300">Auditoria dos nÃºmeros exibidos</h3>
                          <p className="mt-1 max-w-3xl text-xs text-slate-300">Exporta exatamente as linhas atualmente filtradas e uma aba de resumo com os indicadores usados pelo painel. Use este arquivo para conferir nÃºmeros como as 145 linhas e a quantidade 222 mostradas na tela.</p>
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
                  {(() => { const anos=Array.from(new Set(dadosFiltrados.map(d=>d.ano))).sort(); const meses=Array.from(new Set(dadosFiltrados.map(d=>d.mes_num))).sort((a,b)=>a-b); const tipo=exportTipo; const modo=exportModo; const baseExport=dadosFiltrados; const tabela=modo==='prontas'?tabelaExportacaoPronta(baseExport,tipo):gerarExportacaoPersonalizada(baseExport,exportGranularidade,exportMetrica,exportDimensao==='Nenhum'?undefined:exportDimensao,false); return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Linhas</span><div className="text-xl font-bold text-white">{baseExport.length.toLocaleString('pt-BR')}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Faturamento</span><div className="text-xl font-bold text-orange-400">{formatarMoeda(baseExport.reduce((s,d)=>s+d.faturamento,0))}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Quantidade</span><div className="text-xl font-bold text-sky-400">{formatarInteiro(baseExport.reduce((s,d)=>s+d.quantidade,0))}</div></div><div className="bg-slate-900 border border-slate-800 p-3 rounded-lg"><span className="text-xs text-slate-400">Pedidos</span><div className="text-xl font-bold text-green-400">{new Set(baseExport.map(d=>d.pedido)).size}</div></div></div><div className="flex flex-wrap gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800"><button onClick={()=>setExportModo('prontas')} className={`px-3 py-1.5 rounded text-xs ${modo==='prontas'?'bg-orange-600 text-white':'text-slate-300'}`}>âš¡ Tabelas prontas</button><button onClick={()=>setExportModo('personalizada')} className={`px-3 py-1.5 rounded text-xs ${modo==='personalizada'?'bg-orange-600 text-white':'text-slate-300'}`}>ðŸ§© Gerador personalizado</button><button onClick={()=>setExportModo('base')} className={`px-3 py-1.5 rounded text-xs ${modo==='base'?'bg-orange-600 text-white':'text-slate-300'}`}>ðŸ—‚ï¸ Base completa</button></div>{modo==='prontas'&&<div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-slate-400">Tabela pronta:</span><select value={exportTipo} onChange={e=>setExportTipo(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{["Faturamento diÃ¡rio","Resumo mensal","Resumo trimestral","Resumo anual","Por famÃ­lia","Por produto/carreta","Por cliente","Por representante","Por regiÃ£o / UF / cidade","Por forma de venda","Por lista de preÃ§o"].map(x=><option key={x}>{x}</option>)}</select></div>}{modo==='personalizada'&&<div className="flex flex-wrap items-center gap-3 text-xs"><select value={exportGranularidade} onChange={e=>setExportGranularidade(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{['DiÃ¡rio','Semanal','Mensal','Trimestral','Anual'].map(x=><option key={x}>{x}</option>)}</select><select value={exportMetrica} onChange={e=>setExportMetrica(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1">{['Faturamento','Quantidade','Pedidos','Clientes','Ticket unitÃ¡rio','Valor mÃ©dio por pedido'].map(x=><option key={x}>{x}</option>)}</select><select value={exportDimensao} onChange={e=>setExportDimensao(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"><option>Nenhum</option>{['familia','produto','cliente','cliente_base','representante','regiao','uf','cidade','tipo_venda','categoria_produto','descricao_generica','lista_preco_uf'].map(x=><option key={x}>{x}</option>)}</select></div>}{modo==='base'?<DataTable rows={baseExport.slice(0,300)} columns={["data_str","cliente","produto","uf","quantidade","faturamento","pedido","tipo_venda"]} />:<DataTable rows={tabela} columns={Object.keys(tabela[0]||{}).slice(0,10)} />}{modo!=='base'&&<div className="flex gap-2"><button onClick={()=>exportarTabelaCsv(tabela,`exportacao_${modo}.csv`)} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-2"><Download className="w-4 h-4"/> Baixar CSV</button><button onClick={()=>exportarTabelaExcel(tabela,`exportacao_${modo}.xlsx`,tipo.slice(0,31))} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Baixar Excel</button></div>}{modo==='base'&&<div className="flex gap-2"><button onClick={()=>exportarTabelaCsv(baseExport,'base_faturamento_filtrada.csv')} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs">Baixar base filtrada em CSV</button><button onClick={()=>exportarTabelaExcel(baseExport,'base_faturamento_filtrada.xlsx','Base filtrada')} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs">Baixar base filtrada em Excel</button></div>}</div>; })()}
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
              <div><h2 className="text-lg font-bold">Gerar relatÃ³rio para impressÃ£o</h2><p className="text-xs text-slate-500">O relatÃ³rio usa os filtros atuais e nÃ£o altera os dados do dashboard.</p></div>
              <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-slate-600">De <input type="date" value={relatorioDataInicio} onChange={(event) => setRelatorioDataInicio(event.target.value)} className="ml-1 rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">AtÃ© <input type="date" value={relatorioDataFim} onChange={(event) => setRelatorioDataFim(event.target.value)} className="ml-1 rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label><select value={tipoRelatorio} onChange={(event) => setTipoRelatorio(event.target.value as typeof tipoRelatorio)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="executivo">RelatÃ³rio executivo</option><option value="mensal">RelatÃ³rio mensal detalhado</option><option value="produtos">Produtos e famÃ­lias</option><option value="clientes">Clientes e concentraÃ§Ã£o</option><option value="territorial">RegiÃµes, estados e cidades</option><option value="metas">Metas e atingimento</option><option value="previsoes">PrevisÃµes e cenÃ¡rios</option><option value="tabelas">Todas as tabelas</option><option value="auditoria">RelatÃ³rio de auditoria</option></select><button type="button" onClick={imprimirRelatorio} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500"><Printer className="h-4 w-4" /> Imprimir relatÃ³rio</button><button type="button" onClick={() => setRelatorioAberto(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Fechar</button></div>
            </div>
            <article className="relatorio-gerado p-6 md:p-10">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-orange-500 pb-4"><div><div className="text-2xl font-black tracking-tight text-orange-600">cemag</div><h1 className="mt-1 text-2xl font-bold">{tipoRelatorio === "executivo" ? "RelatÃ³rio Executivo Comercial" : tipoRelatorio === "mensal" ? "RelatÃ³rio Mensal Detalhado" : tipoRelatorio === "produtos" ? "RelatÃ³rio de Produtos e FamÃ­lias" : tipoRelatorio === "clientes" ? "RelatÃ³rio de Clientes e ConcentraÃ§Ã£o" : tipoRelatorio === "territorial" ? "RelatÃ³rio Territorial" : tipoRelatorio === "metas" ? "RelatÃ³rio de Metas e Atingimento" : tipoRelatorio === "previsoes" ? "RelatÃ³rio de PrevisÃµes e CenÃ¡rios" : tipoRelatorio === "tabelas" ? "RelatÃ³rio Completo de Tabelas" : "RelatÃ³rio de Auditoria da Base"}</h1><p className="mt-1 text-sm text-slate-500">InteligÃªncia Comercial Â· PerÃ­odo: {relatorioDataInicio || "inÃ­cio"} a {relatorioDataFim || "fim"}</p></div><div className="text-right text-xs text-slate-500">Gerado em {hoje.toLocaleString("pt-BR")}<br />Aba de origem: {abaAtiva}</div></div>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">{[["Faturamento", formatarMoeda(dadosRelatorio.totalFaturamento)], ["Quantidade", formatarInteiro(dadosRelatorio.totalQuantidade)], ["Pedidos", dadosRelatorio.pedidos.toLocaleString("pt-BR")], ["Clientes", dadosRelatorio.clientes.toLocaleString("pt-BR")], ["Linhas", dadosRelatorio.linhas.toLocaleString("pt-BR")]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-1 block text-lg text-slate-900">{value}</strong></div>)}</div>
              {tipoRelatorio === "executivo" && <div className="space-y-6"><section><h2 className="mb-3 text-lg font-bold">Resumo executivo</h2><p className="text-sm leading-6 text-slate-700">O perÃ­odo analisado registrou <strong>{formatarMoeda(dadosRelatorio.totalFaturamento)}</strong> em faturamento, distribuÃ­do em <strong>{dadosRelatorio.pedidos.toLocaleString("pt-BR")}</strong> pedidos e <strong>{dadosRelatorio.clientes.toLocaleString("pt-BR")}</strong> clientes. Este relatÃ³rio considera exatamente as linhas resultantes dos filtros aplicados no dashboard.</p></section><div className="grid gap-6 md:grid-cols-3">{[["Top clientes", dadosRelatorio.topClientes], ["Top produtos", dadosRelatorio.topProdutos], ["Top regiÃµes", dadosRelatorio.topRegioes]].map(([titulo, lista]) => <section key={titulo as string}><h2 className="mb-2 text-sm font-bold">{titulo as string}</h2><table className="w-full text-xs"><tbody>{(lista as typeof dadosRelatorio.topClientes).slice(0, 5).map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="py-2 pr-2">{item.nome}</td><td className="py-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td></tr>)}</tbody></table></section>)}</div></div>}
              {tipoRelatorio === "mensal" && <section><h2 className="mb-3 text-lg font-bold">EvoluÃ§Ã£o mensal detalhada</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Pedidos</th><th className="p-2 text-right">Clientes</th></tr></thead><tbody>{dadosRelatorio.meses.map((item) => <tr key={item.mes} className="border-b border-slate-200"><td className="p-2">{item.mes}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td><td className="p-2 text-right">{item.pedidos}</td><td className="p-2 text-right">{item.clientes}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "produtos" && <section><h2 className="mb-3 text-lg font-bold">Ranking de produtos</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Produto</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{dadosRelatorio.topProdutos.map((item, index) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{index + 1}. {item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "clientes" && <section><h2 className="mb-3 text-lg font-bold">Clientes e concentraÃ§Ã£o de faturamento</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Cliente</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">ParticipaÃ§Ã£o</th></tr></thead><tbody>{dadosRelatorio.topClientes.map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{dadosRelatorio.totalFaturamento ? formatarPercentual(item.faturamento / dadosRelatorio.totalFaturamento) : "â€”"}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "territorial" && <section><h2 className="mb-3 text-lg font-bold">Desempenho por regiÃ£o</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">RegiÃ£o</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{dadosRelatorio.topRegioes.map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "metas" && <section><h2 className="mb-3 text-lg font-bold">Metas e atingimento disponÃ­veis</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2 text-right">Realizado</th><th className="p-2 text-right">Meta</th><th className="p-2 text-right">Atingimento</th></tr></thead><tbody>{atingimentoMensal.filter((item) => `${item.ano}-${String(item.mes_num).padStart(2, "0")}` >= relatorioDataInicio.slice(0, 7) && `${item.ano}-${String(item.mes_num).padStart(2, "0")}` <= relatorioDataFim.slice(0, 7)).map((item) => <tr key={`${item.ano}-${item.mes_num}`} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2 text-right">{formatarMoeda(item.realizado)}</td><td className="p-2 text-right">{formatarMoeda(item.meta)}</td><td className="p-2 text-right font-semibold">{formatarPercentual(item.atingimento)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "previsoes" && <section><h2 className="mb-3 text-lg font-bold">PrevisÃµes e cenÃ¡rios â€” {metricaPrevisao}</h2><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2 text-right">Conservador</th><th className="p-2 text-right">ProvÃ¡vel</th><th className="p-2 text-right">Otimista</th></tr></thead><tbody>{previsaoMensal.serie.filter((item: any) => item.tipo === "PrevisÃ£o").slice(0, 12).map((item: any) => <tr key={item.ano_mes} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2 text-right">{formatarMetrica(item.conservador, metricaPrevisao)}</td><td className="p-2 text-right font-semibold">{formatarMetrica(item.previsao, metricaPrevisao)}</td><td className="p-2 text-right">{formatarMetrica(item.otimista, metricaPrevisao)}</td></tr>)}</tbody></table></section>}
              {tipoRelatorio === "tabelas" && <section className="space-y-7"><div><h2 className="mb-2 text-lg font-bold">Todas as tabelas comerciais</h2><p className="text-sm leading-6 text-slate-700">RelatÃ³rio consolidado das tabelas disponÃ­veis para o perÃ­odo escolhido e para os filtros ativos. As tabelas sÃ£o ordenadas por faturamento e preservam pedidos e clientes Ãºnicos por dimensÃ£o.</p></div>{[["Produtos", dadosRelatorio.todasTabelas.produtos], ["FamÃ­lias", dadosRelatorio.todasTabelas.familias], ["Clientes", dadosRelatorio.todasTabelas.clientes], ["Representantes", dadosRelatorio.todasTabelas.representantes], ["RegiÃµes", dadosRelatorio.todasTabelas.regioes], ["Estados", dadosRelatorio.todasTabelas.ufs], ["Cidades", dadosRelatorio.todasTabelas.cidades], ["Tipos de produto", dadosRelatorio.todasTabelas.tipos], ["Formas de venda", dadosRelatorio.todasTabelas.formasVenda], ["Listas de preÃ§o", dadosRelatorio.todasTabelas.listasPreco]].map(([titulo, lista]) => <section key={titulo as string}><h3 className="mb-2 text-base font-bold">{titulo as string}</h3><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Nome</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Pedidos</th><th className="p-2 text-right">Clientes</th></tr></thead><tbody>{(lista as typeof dadosRelatorio.todasTabelas.produtos).map((item) => <tr key={item.nome} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td><td className="p-2 text-right">{item.pedidos.toLocaleString("pt-BR")}</td><td className="p-2 text-right">{item.clientes.toLocaleString("pt-BR")}</td></tr>)}</tbody></table></section>)}<section><h3 className="mb-2 text-base font-bold">Resumo mensal</h3><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Pedidos</th><th className="p-2 text-right">Clientes</th></tr></thead><tbody>{dadosRelatorio.meses.map((item) => <tr key={`rel-mes-${item.mes}`} className="border-b border-slate-200"><td className="p-2">{item.mes}</td><td className="p-2 text-right font-semibold">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td><td className="p-2 text-right">{item.pedidos.toLocaleString("pt-BR")}</td><td className="p-2 text-right">{item.clientes.toLocaleString("pt-BR")}</td></tr>)}</tbody></table></section><section><h3 className="mb-2 text-base font-bold">Metas e atingimento</h3><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2 text-right">Realizado</th><th className="p-2 text-right">Meta</th><th className="p-2 text-right">Atingimento</th></tr></thead><tbody>{atingimentoMensal.filter((item) => `${item.ano}-${String(item.mes_num).padStart(2, "0")}` >= relatorioDataInicio.slice(0, 7) && `${item.ano}-${String(item.mes_num).padStart(2, "0")}` <= relatorioDataFim.slice(0, 7)).map((item) => <tr key={`rel-meta-${item.ano}-${item.mes_num}`} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2 text-right">{formatarMoeda(item.realizado)}</td><td className="p-2 text-right">{formatarMoeda(item.meta)}</td><td className="p-2 text-right font-semibold">{formatarPercentual(item.atingimento)}</td></tr>)}</tbody></table></section><section><h3 className="mb-2 text-base font-bold">Cores e grupos de modelo</h3><div className="grid gap-6 md:grid-cols-2">{[["Cores", dadosRelatorio.todasTabelas.cores], ["Grupos de modelo", dadosRelatorio.todasTabelas.gruposModelo]].map(([titulo, lista]) => <div key={titulo as string}><h4 className="mb-2 text-sm font-semibold">{titulo as string}</h4><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Nome</th><th className="p-2 text-right">Faturamento</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{(lista as typeof dadosRelatorio.todasTabelas.produtos).map((item) => <tr key={`${titulo}-${item.nome}`} className="border-b border-slate-200"><td className="p-2">{item.nome}</td><td className="p-2 text-right">{formatarMoeda(item.faturamento)}</td><td className="p-2 text-right">{formatarInteiro(item.quantidade)}</td></tr>)}</tbody></table></div>)}</div></section><section><h3 className="mb-2 text-base font-bold">ANFAVEA â€” mÃ¡quinas autopropulsadas</h3><p className="mb-2 text-xs text-slate-600">Vendas nacionais no varejo, conforme os dados disponÃ­veis na Central de Dados da ANFAVEA. O perÃ­odo abaixo Ã© limitado ao intervalo do relatÃ³rio.</p><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">MÃªs</th><th className="p-2">MÃ¡quina</th><th className="p-2 text-right">Unidades</th></tr></thead><tbody>{(mercadoMaquinasAnfavea?.series || []).filter((item) => item.ano_mes >= relatorioDataInicio.slice(0, 7) && item.ano_mes <= relatorioDataFim.slice(0, 7)).map((item) => <tr key={`rel-anfavea-${item.ano_mes}-${item.maquina}`} className="border-b border-slate-200"><td className="p-2">{item.ano_mes}</td><td className="p-2">{item.maquina}</td><td className="p-2 text-right">{formatarInteiro(Number(item.unidades || 0))}</td></tr>)}</tbody></table>{!(mercadoMaquinasAnfavea?.series || []).length && <p className="text-xs text-slate-500">Sem dados ANFAVEA disponÃ­veis nesta consulta.</p>}</section></section>}
              {tipoRelatorio === "auditoria" && <section className="space-y-4"><h2 className="text-lg font-bold">MemÃ³ria de cÃ¡lculo e auditoria</h2><div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6"><p><strong>Linhas consideradas:</strong> {dadosRelatorio.linhas.toLocaleString("pt-BR")}</p><p><strong>PerÃ­odo aplicado:</strong> {relatorioDataInicio || "inÃ­cio"} a {relatorioDataFim || "fim"}</p><p><strong>Data utilizada:</strong> movimentaÃ§Ã£o, com fallback para emissÃ£o</p><p><strong>Filtros:</strong> todos os filtros gerais ativos no momento da geraÃ§Ã£o</p></div><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Indicador</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{[["Faturamento total", formatarMoeda(dadosRelatorio.totalFaturamento)], ["Quantidade total", formatarInteiro(dadosRelatorio.totalQuantidade)], ["Pedidos Ãºnicos", dadosRelatorio.pedidos.toLocaleString("pt-BR")], ["Clientes Ãºnicos", dadosRelatorio.clientes.toLocaleString("pt-BR")], ["Linhas filtradas", dadosRelatorio.linhas.toLocaleString("pt-BR")]].map(([label, value]) => <tr key={label} className="border-b border-slate-200"><td className="p-2">{label}</td><td className="p-2 text-right font-semibold">{value}</td></tr>)}</tbody></table></section>}
              <footer className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-500">Documento gerado pelo painel CEMAG Â· Os valores refletem os filtros selecionados no momento da geraÃ§Ã£o.</footer>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
