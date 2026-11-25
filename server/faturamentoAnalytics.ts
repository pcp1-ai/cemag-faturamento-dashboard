import {
  CLIENTE_INFO_OVERRIDE,
  normalizarNomeColuna,
  prepararDados,
  type TransacaoTratada,
} from "../shared/faturamentoData";
import { getGoogleSheetBase, getGoogleSheetRows } from "./googleSheets";

type NullableMetricField =
  | "faturamento" | "quantidade" | "cliente" | "pedido" | "custo" | "frete"
  | "ipi" | "pis" | "cofins" | "icms" | "iss" | "ir" | "inss" | "ii"
  | "acessorio0" | "acessorio1" | "impostos_principais" | "tributos_dre"
  | "faturamento_liquido_aprox" | "ticket_unitario";
type FaturamentoLinhaAnalitica = Omit<TransacaoTratada, NullableMetricField>
  & Partial<Pick<TransacaoTratada, NullableMetricField>>;

export type FaturamentoAnalytics = {
  sourceVersion: string;
  sourceName: string;
  fetchedAt: string;
  sourceRowCount: number;
  rows: FaturamentoLinhaAnalitica[];
  validRowCount: number;
  ignoredRowCount: number;
  coverage: { from: string | null; to: string | null };
  dimensions: string[];
  numericMetrics: string[];
  availableMetrics: string[];
  indexes: Record<string, Record<string, number[]>>;
  missingMetricRows: Record<string, number>;
};

let cachedLayer: FaturamentoAnalytics | null = null;
let layerRequest: Promise<FaturamentoAnalytics> | null = null;

const DIMENSION_FIELDS: Record<string, string[]> = {
  produto: ["produto"], tipo_produto: ["tipo_produto"], cor: ["cor"],
  cliente: ["cliente", "cliente_base"], municipio: ["cidade"], uf: ["uf"], regiao: ["regiao"],
  representante: ["representante"], lista_preco_uf: ["lista_preco_uf"],
  descricao_generica: ["descricao_generica"], categoria_produto: ["categoria_produto"],
  tipo_venda: ["tipo_venda"], pedido: ["pedido"], familia: ["familia"], grupo_modelo: ["grupo_modelo"],
  ano: ["ano"], mes: ["ano_mes"], trimestre: ["trimestre"], semestre: ["semestre"],
};

const DIMENSION_SOURCE_COLUMNS: Record<string, string[]> = {
  produto: ["1o. Agrupamento"],
  tipo_produto: ["1o. Agrupamento", "BAI_RECURSO.CLASSE.NOME", "BAI_RECURSO.DESCRICAOGENERICA"],
  cor: ["1o. Agrupamento"],
  cliente: ["BAI_PESSOA.CODIGO"],
  municipio: ["CIDADE", "CIDADE+ ESTADO", "BAI_PESSOA.CODIGO"],
  uf: ["CIDADE", "CIDADE+ ESTADO", "BAI_PESSOA.CODIGO"],
  regiao: ["CIDADE", "CIDADE+ ESTADO", "BAI_PESSOA.CODIGO"],
  representante: ["REPRESENTANTE"],
  lista_preco_uf: ["LISTA DE PREÇO UF"],
  descricao_generica: ["BAI_RECURSO.DESCRICAOGENERICA"],
  categoria_produto: ["BAI_RECURSO.CLASSE.NOME"],
  tipo_venda: ["BAI_CLASSE.NOME"],
  pedido: ["BAI_NUMERO"],
  familia: ["1o. Agrupamento"],
  grupo_modelo: ["1o. Agrupamento"],
  ano: ["BAI_MOVIMENTAC", "BAI_EMISSAO"],
  mes: ["BAI_MOVIMENTAC", "BAI_EMISSAO"],
  trimestre: ["BAI_MOVIMENTAC", "BAI_EMISSAO"],
  semestre: ["BAI_MOVIMENTAC", "BAI_EMISSAO"],
};

const NUMERIC_METRICS = [
  "quantidade", "faturamento", "custo", "frete", "ipi", "pis", "cofins", "icms", "iss", "ir",
  "inss", "ii", "acessorio0", "acessorio1", "impostos_principais", "tributos_dre",
  "acessorios_dre", "faturamento_liquido_aprox", "ticket_unitario",
] as const;

const METRIC_COLUMNS: Record<string, string[]> = {
  faturamento_valor: ["BAI_TOTAL"],
  quantidade_faturada: ["BAI_QUANTIDADE"],
  cliente: ["BAI_PESSOA.CODIGO"],
  pedido: ["BAI_NUMERO"],
  custo: ["BAI_CUSTOCONT"],
  frete: ["BAI_FRETE"],
  ipi: ["BAI_IPI"], pis: ["BAI_PIS"], cofins: ["BAI_COFINS"], icms: ["BAI_ICMS"],
  iss: ["BAI_ISS"], ir: ["BAI_IR"], inss: ["BAI_INSS"], ii: ["BAI_II"],
  acessorio0: ["BAI_ACESSORI0"], acessorio1: ["BAI_ACESSORI1"],
  impostos_principais: ["BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS"],
  tributos_dre: ["BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS", "BAI_ISS", "BAI_IR", "BAI_INSS", "BAI_II"],
  faturamento_liquido_aprox: ["BAI_TOTAL", "BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS", "BAI_ISS", "BAI_IR", "BAI_INSS", "BAI_II", "BAI_FRETE"],
  ticket_unitario: ["BAI_TOTAL", "BAI_QUANTIDADE"],
};

const METRIC_OUTPUT_FIELDS: Record<string, { field: string; columns: string[] }> = {
  faturamento_valor: { field: "faturamento", columns: ["BAI_TOTAL"] },
  quantidade_faturada: { field: "quantidade", columns: ["BAI_QUANTIDADE"] },
  cliente: { field: "cliente", columns: ["BAI_PESSOA.CODIGO"] },
  pedido: { field: "pedido", columns: ["BAI_NUMERO"] },
  custo: { field: "custo", columns: ["BAI_CUSTOCONT"] },
  frete: { field: "frete", columns: ["BAI_FRETE"] },
  ipi: { field: "ipi", columns: ["BAI_IPI"] },
  pis: { field: "pis", columns: ["BAI_PIS"] },
  cofins: { field: "cofins", columns: ["BAI_COFINS"] },
  icms: { field: "icms", columns: ["BAI_ICMS"] },
  iss: { field: "iss", columns: ["BAI_ISS"] },
  ir: { field: "ir", columns: ["BAI_IR"] },
  inss: { field: "inss", columns: ["BAI_INSS"] },
  ii: { field: "ii", columns: ["BAI_II"] },
  acessorio0: { field: "acessorio0", columns: ["BAI_ACESSORI0"] },
  acessorio1: { field: "acessorio1", columns: ["BAI_ACESSORI1"] },
  impostos_principais: { field: "impostos_principais", columns: ["BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS"] },
  tributos_dre: { field: "tributos_dre", columns: ["BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS", "BAI_ISS", "BAI_IR", "BAI_INSS", "BAI_II"] },
  faturamento_liquido_aprox: { field: "faturamento_liquido_aprox", columns: ["BAI_TOTAL", "BAI_IPI", "BAI_PIS", "BAI_COFINS", "BAI_ICMS", "BAI_ISS", "BAI_IR", "BAI_INSS", "BAI_II", "BAI_FRETE"] },
  ticket_unitario: { field: "ticket_unitario", columns: ["BAI_TOTAL", "BAI_QUANTIDADE"] },
};

async function buildLayer(attempt = 0): Promise<FaturamentoAnalytics> {
  const base = await getGoogleSheetBase();
  if (cachedLayer?.sourceVersion === base.version) return cachedLayer;

  let rawRows: Record<string, string>[];
  try {
    rawRows = await getGoogleSheetRows(base.version);
  } catch (error) {
    if (attempt < 2 && error instanceof Error && error.message.includes("planilha foi atualizada")) return buildLayer(attempt + 1);
    throw error;
  }
  const sourceColumns = Object.keys(rawRows[0] || {}).map(normalizarNomeColuna);
  const hasColumn = (column: string) => sourceColumns.includes(normalizarNomeColuna(column));
  const hasNonEmptySourceValue = (column: string) => hasColumn(column)
    && rawRows.some((row) => String(Object.entries(row).find(([key]) => normalizarNomeColuna(key) === normalizarNomeColuna(column))?.[1] ?? "").trim() !== "");
  const prepared = prepararDados(rawRows, CLIENTE_INFO_OVERRIDE);
  const missingMetricRows: Record<string, number> = {};
  const rows = prepared.dados.map((row) => {
    const sourceIndex = Number(String(row.id).match(/_(\d+)$/)?.[1]);
    const raw = rawRows[sourceIndex] || {};
    const normalizedRaw = new Map(Object.entries(raw).map(([key, value]) => [normalizarNomeColuna(key), String(value ?? "").trim()]));
    const copy = { ...row } as FaturamentoLinhaAnalitica & Record<string, unknown>;
    for (const [metric, definition] of Object.entries(METRIC_OUTPUT_FIELDS)) {
      const hasValues = definition.columns.every((column) => normalizedRaw.get(normalizarNomeColuna(column)) !== undefined
        && normalizedRaw.get(normalizarNomeColuna(column)) !== "")
        && (metric !== "ticket_unitario" || row.quantidade > 0);
      if (!hasValues) {
        missingMetricRows[metric] = (missingMetricRows[metric] || 0) + 1;
        copy[definition.field] = undefined;
      }
    }
    return copy;
  });
  const indexes: Record<string, Record<string, number[]>> = {};
  for (const [dimension, fields] of Object.entries(DIMENSION_FIELDS)) {
    const groups: Record<string, number[]> = {};
    rows.forEach((row, index) => {
      const values = row as unknown as Record<string, unknown>;
      const rawValue = fields.map((field) => values[field]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
      const label = String(rawValue ?? "Não informado").trim() || "Não informado";
      (groups[label] ||= []).push(index);
    });
    indexes[dimension] = groups;
  }
  const dates = prepared.dados.map((row) => row.data_emissao.getTime()).filter(Number.isFinite);
  const from = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : null;
  const to = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null;

  const layer: FaturamentoAnalytics = {
    sourceVersion: base.version,
    sourceName: base.fileName,
    fetchedAt: base.updatedAt,
    sourceRowCount: rawRows.length,
    rows,
    validRowCount: prepared.meta.linhas_validas,
    ignoredRowCount: rawRows.length - prepared.meta.linhas_validas,
    coverage: { from, to },
    dimensions: Object.entries(DIMENSION_FIELDS).filter(([dimension, fields]) =>
      DIMENSION_SOURCE_COLUMNS[dimension]?.some(hasNonEmptySourceValue)
      && rows.some((row) => fields.some((field) => {
        const value = (row as unknown as Record<string, unknown>)[field];
        return value !== undefined && value !== null && String(value).trim() !== ""
          && !["não identificado", "não informado", "não aplicável"].includes(String(value).trim().toLocaleLowerCase("pt-BR"));
      })),
    ).map(([dimension]) => dimension),
    numericMetrics: NUMERIC_METRICS.filter((metric) => prepared.dados.some((row) => typeof (row as unknown as Record<string, unknown>)[metric] === "number")),
    availableMetrics: Object.entries(METRIC_COLUMNS)
      .filter(([, columns]) => columns.every(hasColumn))
      .map(([metric]) => metric),
    indexes,
    missingMetricRows,
  };

  // Nunca substitua um snapshot mais novo por uma resposta atrasada de versão anterior.
  const latest = await getGoogleSheetBase();
  if (latest.version !== layer.sourceVersion) {
    if (attempt < 2) return buildLayer(attempt + 1);
    throw new Error("A planilha mudou durante a preparação da base. Tente novamente.");
  }
  cachedLayer = layer;
  return layer;
}

export async function getFaturamentoAnalytics(): Promise<FaturamentoAnalytics> {
  if (!layerRequest) {
    layerRequest = buildLayer().finally(() => {
      layerRequest = null;
    });
  }
  return layerRequest;
}

export function clearFaturamentoAnalyticsCache(): void {
  cachedLayer = null;
}
