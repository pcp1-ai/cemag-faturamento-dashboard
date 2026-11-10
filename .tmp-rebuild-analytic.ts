import Papa from "papaparse";
import { readFile } from "node:fs/promises";
import { CLIENTE_INFO_OVERRIDE, prepararDados } from "./client/src/lib/faturamento";
import { getSharedFile, replaceAnalyticBase } from "./server/db";

const file = await getSharedFile("base");
if (!file) throw new Error("Base central não encontrada");
const bytes = await readFile("/tmp/shared-current.csv");
const parsed = Papa.parse<Record<string, unknown>>(bytes.toString("utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false, delimiter: "" });
const raw = parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
const tratados = prepararDados(raw, CLIENTE_INFO_OVERRIDE).dados;
const linhas = tratados as unknown as Record<string, unknown>[];
const datas = linhas.map((row) => String(row.data_movimento || row.data_emissao || "").slice(0, 10)).filter(Boolean).sort();
const versao = `${Date.now()}-a3-${file.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
const dimensoes = Object.keys(linhas[0] || {}).filter((nome) => /data|ano|m[eê]s|cidade|uf|estado|regi[aã]o|representante|vendedor|cliente|produto|modelo|fam[ií]lia|tipo|pedido|lista|quantidade|faturamento|valor|cor/i.test(nome));
await replaceAnalyticBase({ id: 1, version: versao, sourceStorageKey: file.storageKey, sourceFileName: file.fileName, status: "ready", rowCount: linhas.length, dimensions: JSON.stringify(dimensoes), dataInicio: datas[0] || null, dataFim: datas[datas.length - 1] || null, errorMessage: null }, linhas.map((row, index) => ({ baseVersion: versao, rowNumber: index + 1, payload: JSON.stringify(row) })));
let fat = 0, qtd = 0;
for (const row of linhas) { fat += Number(row.faturamento || 0); qtd += Number(row.quantidade || 0); }
console.log(JSON.stringify({ versao, arquivo: file.fileName, rawRows: raw.length, analyticRows: linhas.length, dataInicio: datas[0], dataFim: datas[datas.length - 1], faturamento: fat, quantidade: qtd }));
