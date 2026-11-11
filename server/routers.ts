import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearCemagSession, createCemagSession, validateCemagCredentials } from "./cemagAuth";
import { appendAnalyticRows, countAnalyticRows, deleteAnalyticRows, getCurrentAnalyticBase, listAnalyticRows, listAnalyticRowsPage, publishAnalyticBase, upsertExternalSnapshot } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { obterFatoresExternos } from "./externalFactors";
import { invokeLLM } from "./_core/llm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CHAT_BUSINESS_DICTIONARY } from "../shared/chatDictionary";
import { queryPublishedBase } from "./chatBaseQuery";
import { buildChatSuggestions } from "./chatSuggestions";

let periodoBaseCache: { anoInicio: number; anoFim: number; atualizadoEm: number } | null = null;

function lerLinhasArquivo(bytes: Buffer, fileName: string): Record<string, unknown>[] {
  if (/\.csv$/i.test(fileName)) {
    const parsed = Papa.parse<Record<string, unknown>>(bytes.toString("utf8"), { header: true, skipEmptyLines: true, dynamicTyping: false, delimiter: "" });
    if (parsed.errors.length) console.warn("[CSV] Avisos de leitura:", parsed.errors.slice(0, 3));
    return parsed.data.filter((linha) => Object.values(linha).some((valor) => String(valor ?? "").trim() !== ""));
  }
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, cellNF: false });
  const primeiraAba = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[primeiraAba] || {}, { defval: "" });
}

function extrairAno(valor: unknown): number | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.getFullYear();
  if (typeof valor === "number" && valor > 20000 && valor < 100000) {
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return Number.isNaN(data.getTime()) ? null : data.getUTCFullYear();
  }
  const texto = String(valor ?? "").trim();
  const br = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (br) return Number(br[3]);
  const iso = texto.match(/^(\d{4})[\/-]\d{1,2}[\/-]\d{1,2}/);
  if (iso) return Number(iso[1]);
  const ano = texto.match(/\b(19\d{2}|20\d{2})\b/);
  return ano ? Number(ano[1]) : null;
}

async function obterPeriodoBaseCentral() {
  if (periodoBaseCache && Date.now() - periodoBaseCache.atualizadoEm < 10 * 60 * 1000) return periodoBaseCache;
  const candidatos = [
    path.resolve(process.cwd(), "client/public/data/tabelaFaturamento.csv"),
    path.resolve(process.cwd(), "dist/public/data/tabelaFaturamento.csv"),
    path.resolve(process.cwd(), "client/src/data/tabelaFaturamento.csv"),
  ];
  const caminho = candidatos.find((item) => existsSync(item));
  if (!caminho) return null;
  const linhas = lerLinhasArquivo(await readFile(caminho), path.basename(caminho));
  const nomesData = ["data_movimentacao", "data movimentação", "movimentacao", "data_emissao", "data emissão", "data", "date", "bai_movimentac", "bai_emissao"];
  const anos: number[] = [];
  for (const linha of linhas) {
    const chave = Object.keys(linha).find((nome) => nomesData.includes(nome.trim().toLowerCase()));
    const ano = chave ? extrairAno(linha[chave]) : null;
    if (ano && ano >= 1900 && ano <= 2200) anos.push(ano);
  }
  if (!anos.length) return null;
  periodoBaseCache = { anoInicio: Math.min(...anos), anoFim: Math.max(...anos), atualizadoEm: Date.now() };
  return periodoBaseCache;
}

const chatMessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-180) || "arquivo.csv";
}

function extrairDataTexto(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number" && valor > 20000 && valor < 100000) {
    const data = new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
    return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
  }
  const texto = String(valor ?? "").trim();
  const br = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = texto.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return iso ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : null;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    basePeriod: publicProcedure.query(async () => {
      try {
        const periodo = await obterPeriodoBaseCentral();
        return periodo ? { anoInicio: periodo.anoInicio, anoFim: periodo.anoFim } : null;
      } catch (error) {
        console.warn("[Auth] Não foi possível consultar o período da base central:", error);
        return null;
      }
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        if (!validateCemagCredentials(email, input.password)) {
          return { success: false as const, message: "E-mail corporativo ou senha inválidos. Use @cemag.com.br ou @itaueira.com.br." };
        }
        await createCemagSession(ctx.res, ctx.req, email);
        return { success: true as const, email };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearCemagSession(ctx.res, ctx.req);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ai: router({
    chat: protectedProcedure
      .input(z.object({ messages: z.array(chatMessageInput).min(1).max(16) }))
      .mutation(async ({ input }) => {
        const emptySuggestions: string[] = [];
        let base;
        let rows: Record<string, unknown>[];
        try {
          base = await getCurrentAnalyticBase();
          if (!base || base.status !== "ready") {
            return { content: "A base compartilhada ainda não está publicada. Peça ao administrador para publicar a base e tente novamente.", suggestions: emptySuggestions };
          }
          const storedRows = await listAnalyticRows(base.version);
          if (!storedRows.length) {
            return { content: "Não consegui consultar os registros da base compartilhada publicada. Tente novamente mais tarde ou avise o administrador.", suggestions: emptySuggestions };
          }
          rows = storedRows.map((row) => JSON.parse(row.payload) as Record<string, unknown>);
        } catch (error) {
          console.error("[AI] Falha ao carregar a base completa publicada:", error);
          return { content: "Não consegui consultar a base compartilhada agora. Tente novamente mais tarde ou avise o administrador.", suggestions: emptySuggestions };
        }

        const latestQuestion = input.messages.at(-1)?.content || "";
        const previousQuestion = input.messages.slice(0, -1).reverse().find((message) => message.role === "user")?.content;
        const isContinuation = /^(?:e\s+)?(?:em|no ano|no m[eê]s|por|e para|e no)\b/i.test(latestQuestion.trim());
        const question = isContinuation && previousQuestion ? `${previousQuestion} ${latestQuestion}` : latestQuestion;
        const query = queryPublishedBase(question, rows, base.version);
        const suggestions = buildChatSuggestions(question, query, CHAT_BUSINESS_DICTIONARY, rows);
        if (query.status === "ambiguous") {
          return { content: query.limitations.join(" "), suggestions };
        }
        if (query.status === "no_match") {
          return { content: query.limitations.join(" ") || "Não encontrei registros que respondam a essa pergunta na base publicada.", suggestions };
        }

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: [
                "Você é o assistente de inteligência comercial da CEMAG. Responda em português do Brasil, com clareza e objetividade.",
                "A consulta estruturada abaixo foi feita na base completa publicada no servidor e é a única fonte para afirmações numéricas. Não use filtros da interface nem invente campos, valores ou causas.",
                "Use o dicionário para compreender sinônimos, sem confundir conceitos ambíguos. Faturamento é valor faturado, não lucro. Implemento é mais amplo que carreta. Quantidade faturada não comprova produção física.",
                "Declare o período e o critério da resposta. Se a pergunta pedir algo que o resultado não contém, explique o limite sem completar por suposição.",
                `DICIONÁRIO DE NEGÓCIOS:\n${JSON.stringify(CHAT_BUSINESS_DICTIONARY)}`,
                `RESULTADO DA CONSULTA (versão ${base.version}):\n${JSON.stringify(query)}`,
                "Mensagens anteriores servem apenas para entender referências da conversa; não são fonte de dados. Baseie fatos somente no resultado desta consulta.",
              ].join("\n\n"),
            },
            ...input.messages,
          ],
          maxTokens: 700,
        });
        const content = response.choices[0]?.message?.content;
        if (typeof content !== "string") throw new Error("A resposta do assistente não veio em formato de texto.");
        return { content, suggestions };
      }),
  }),
  cemag: router({
    sharedBase: protectedProcedure.query(async () => {
      const base = await getCurrentAnalyticBase();
      if (!base || !base.sourceStorageKey.startsWith("database:")) return null;
      return { version: base.version, fileName: base.sourceFileName, rowCount: base.rowCount, updatedAt: base.updatedAt };
    }),
    sharedBaseRows: protectedProcedure
      .input(z.object({ version: z.string().min(1).max(180), offset: z.number().int().min(0), limit: z.number().int().min(1).max(1000) }))
      .query(async ({ input }) => {
        const base = await getCurrentAnalyticBase();
        if (!base || base.version !== input.version) throw new Error("A base compartilhada foi atualizada. Recarregue o painel.");
        return listAnalyticRowsPage(input.version, input.offset, input.limit);
      }),
    uploadBaseChunk: adminProcedure
      .input(z.object({
        version: z.string().regex(/^[a-zA-Z0-9_-]{1,180}$/),
        rows: z.array(z.object({ rowNumber: z.number().int().positive(), payload: z.string().max(60000) })).min(1).max(500),
      }))
      .mutation(async ({ input }) => {
        await appendAnalyticRows(input.rows.map((row) => ({ ...row, baseVersion: input.version })));
        return { received: input.rows.length };
      }),
    publishSharedBase: adminProcedure
      .input(z.object({ version: z.string().regex(/^[a-zA-Z0-9_-]{1,180}$/), fileName: z.string().min(1).max(255), rowCount: z.number().int().positive(), dimensions: z.array(z.string().max(255)).max(250) }))
      .mutation(async ({ input }) => {
        const received = await countAnalyticRows(input.version);
        if (received !== input.rowCount) throw new Error(`Envio incompleto: ${received} de ${input.rowCount} registros chegaram ao servidor.`);
        await publishAnalyticBase({
          id: 1,
          version: input.version,
          sourceStorageKey: `database:${input.version}`,
          sourceFileName: safeFileName(input.fileName),
          status: "ready",
          rowCount: input.rowCount,
          dimensions: JSON.stringify(input.dimensions),
          dataInicio: null,
          dataFim: null,
          errorMessage: null,
        });
        return { success: true, rowCount: input.rowCount };
      }),
    discardSharedBaseUpload: adminProcedure
      .input(z.object({ version: z.string().regex(/^[a-zA-Z0-9_-]{1,180}$/) }))
      .mutation(async ({ input }) => {
        const current = await getCurrentAnalyticBase();
        if (current?.version !== input.version) await deleteAnalyticRows(input.version);
        return { success: true };
      }),
    fatoresExternos: protectedProcedure
      .input(z.object({
        dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        cidade: z.string().min(1).max(120),
        uf: z.string().max(2).optional(),
        localidades: z.array(z.object({ cidade: z.string().min(1).max(120), uf: z.string().max(2).optional() })).max(40).optional(),
        descricaoAbrangencia: z.string().max(180).optional(),
      }))
      .query(async ({ input }) => {
        const result = await obterFatoresExternos(input);
        try {
          await upsertExternalSnapshot({ cidade: input.cidade, uf: input.uf || null, payload: JSON.stringify({ input, result }) });
        } catch (error) {
          console.warn("[ExternalFactors] Não foi possível persistir o snapshot:", error);
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
