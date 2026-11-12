import { createHash, createSign } from "node:crypto";

const CACHE_TTL_MS = 5 * 60 * 1000;
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const EXPECTED_HEADERS = [
  "1o. Agrupamento", "VRA_CLASSE.CLASSERECURSO", "BAI_PESSOA.CODIGO",
  "BAI_RECURSO.DESCRICAOGENERICA", "BAI_RECURSO.CLASSE.NOME", "BAI_QUANTIDADE",
  "BAI_EMISSAO", "BAI_MOVIMENTAC", "BAI_CLASSE.NOME", "BAI_NUMERO",
  "BAI_CUSTOCONT", "BAI_TOTAL", "BAI_CHCRIACAO", "BAI_FRETE", "BAI_IPI",
  "BAI_PIS", "BAI_COFINS", "BAI_ISS", "BAI_IR", "BAI_INSS", "BAI_II",
  "BAI_ICMS", "BAI_ACESSORI0", "BAI_ACESSORI1", "CIDADE", "CIDADE+ ESTADO",
  "REPRESENTANTE", "LISTA DE PREÇO UF", "", "MÊS", "ANO",
];

type SheetSnapshot = {
  version: string;
  fileName: string;
  rowCount: number;
  updatedAt: string;
  rows: Record<string, string>[];
  expiresAt: number;
};

let snapshotCache: SheetSnapshot | null = null;
let snapshotRequest: Promise<SheetSnapshot> | null = null;
let accessTokenCache: { token: string; expiresAt: number } | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Google Sheets não configurado: variável ${name} ausente no servidor.`);
  return value;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.token;

  const clientEmail = requiredEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const tokenUri = process.env.GOOGLE_TOKEN_URI?.trim() || "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: tokenUri,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google OAuth recusou a autenticação da conta de serviço (HTTP ${response.status}).`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth não retornou um token de acesso válido.");
  accessTokenCache = { token: body.access_token, expiresAt: Date.now() + Math.max(60, body.expires_in || 3600) * 1000 };
  return body.access_token;
}

async function readSheetSnapshot(): Promise<SheetSnapshot> {
  requiredEnv("GOOGLE_CLIENT_EMAIL");
  requiredEnv("GOOGLE_PRIVATE_KEY");
  const spreadsheetId = requiredEnv("GOOGLE_SPREADSHEET_ID");
  const sheetName = requiredEnv("GOOGLE_SHEET_NAME");
  const range = `${sheetName.replace(/'/g, "''")}!A1:AE`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  const response = await fetch(url, { headers: { authorization: `Bearer ${await getAccessToken()}` } });
  if (!response.ok) throw new Error(`Google Sheets não conseguiu ler a aba configurada (HTTP ${response.status}).`);
  const body = await response.json() as { values?: unknown[][] };
  const matrix = body.values || [];
  if (!matrix.length) throw new Error("A aba configurada do Google Sheets está vazia.");

  const headers = EXPECTED_HEADERS.map((_, index) => String(matrix[0]?.[index] ?? "").trim());
  const normalizeHeader = (header: string) => header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const mismatch = EXPECTED_HEADERS.findIndex((expected, index) => normalizeHeader(headers[index]) !== normalizeHeader(expected));
  if (mismatch >= 0) throw new Error(`Google Sheets header changed in column ${mismatch + 1}; data was not loaded.`);

  const namedColumns = headers.map((header, index) => ({ header, index })).filter(({ header }) => header.length > 0);
  const rows = matrix.slice(1).flatMap((cells) => {
    const row = Object.fromEntries(namedColumns.map(({ header, index }) => [header, String(cells?.[index] ?? "").trim()]));
    return Object.values(row).some((value) => value !== "") ? [row] : [];
  });
  const version = createHash("sha256").update(JSON.stringify({ headers, rows })).digest("hex").slice(0, 32);
  const updatedAt = new Date().toISOString();
  return { version, fileName: `${sheetName} (Google Sheets)`, rowCount: rows.length, updatedAt, rows, expiresAt: Date.now() + CACHE_TTL_MS };
}

async function getSnapshot(): Promise<SheetSnapshot> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) return snapshotCache;
  if (!snapshotRequest) {
    snapshotRequest = readSheetSnapshot().then((snapshot) => {
      snapshotCache = snapshot;
      return snapshot;
    }).finally(() => { snapshotRequest = null; });
  }
  return snapshotRequest;
}

export async function getGoogleSheetBase() {
  const { version, fileName, rowCount, updatedAt } = await getSnapshot();
  return { version, fileName, rowCount, updatedAt };
}

export async function getGoogleSheetRows(version?: string): Promise<Record<string, string>[]> {
  const snapshot = await getSnapshot();
  if (version && snapshot.version !== version) throw new Error("A planilha foi atualizada. Recarregue o painel para continuar.");
  return snapshot.rows;
}

export async function getGoogleSheetPage(version: string, offset: number, limit: number) {
  const snapshot = await getSnapshot();
  if (snapshot.version !== version) throw new Error("A planilha foi atualizada. Recarregue o painel para continuar.");
  return snapshot.rows.slice(offset, offset + limit).map((row, index) => ({ rowNumber: offset + index + 1, payload: JSON.stringify(row) }));
}
