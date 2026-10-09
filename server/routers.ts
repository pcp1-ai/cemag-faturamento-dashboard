import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearCemagSession, createCemagSession, validateCemagCredentials } from "./cemagAuth";
import { getSharedFile, upsertSharedFile } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

const sharedFileInput = z.object({
  kind: z.enum(["base", "metas"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(160),
  contentBase64: z.string().min(1),
});

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-180) || "arquivo.csv";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
  cemag: router({
    currentFiles: protectedProcedure.query(async () => {
      const [base, metas] = await Promise.all([getSharedFile("base"), getSharedFile("metas")]);
      return {
        base: base ? { ...base, url: `/manus-storage/${base.storageKey}` } : null,
        metas: metas ? { ...metas, url: `/manus-storage/${metas.storageKey}` } : null,
      };
    }),
    uploadFile: adminProcedure
      .input(sharedFileInput)
      .mutation(async ({ input, ctx }) => {
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (!bytes.length) throw new Error("Arquivo vazio.");
        if (bytes.length > 50 * 1024 * 1024) throw new Error("Arquivo excede o limite de 50 MB.");
        const stored = await storagePut(
          `cemag/${input.kind}/${Date.now()}-${safeFileName(input.fileName)}`,
          bytes,
          input.contentType,
        );
        await upsertSharedFile({
          kind: input.kind,
          fileName: input.fileName,
          storageKey: stored.key,
          contentType: input.contentType,
          sizeBytes: bytes.length,
        });
        return {
          success: true as const,
          kind: input.kind,
          fileName: input.fileName,
          sizeBytes: bytes.length,
          url: stored.url,
          updatedBy: ctx.user.email,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
