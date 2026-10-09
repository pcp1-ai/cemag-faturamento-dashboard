import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { CEMAG_ADMIN_EMAIL, readCemagSession, validateCemagCredentials } from "./cemagAuth";
import type { TrpcContext } from "./_core/context";

function createContext() {
  const headers: Record<string, string> = {};
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "http", headers } as TrpcContext["req"],
    res: {
      setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
  return { ctx, headers };
}

describe("autenticação central CEMAG", () => {
  it("aceita somente credenciais CEMAG e identifica pcp1 como administradora", () => {
    expect(validateCemagCredentials(CEMAG_ADMIN_EMAIL, "000000")).toBe(true);
    expect(validateCemagCredentials("analista@cemag.com.br", "000000")).toBe(true);
    expect(validateCemagCredentials("analista@itaueira.com.br", "000000")).toBe(true);
    expect(validateCemagCredentials("ANALISTA@ITAUEIRA.COM.BR", "000000")).toBe(true);
    expect(validateCemagCredentials("analista@gmail.com", "000000")).toBe(false);
    expect(validateCemagCredentials(CEMAG_ADMIN_EMAIL, "senha-incorreta")).toBe(false);
  });

  it("cria uma sessão de servidor com perfil administrativo", async () => {
    const { ctx, headers } = createContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({ email: CEMAG_ADMIN_EMAIL, password: "000000" });
    expect(result).toEqual({ success: true, email: CEMAG_ADMIN_EMAIL });
    expect(headers["set-cookie"]).toContain("cemag_session=");
    ctx.req.headers.cookie = headers["set-cookie"];
    const session = await readCemagSession(ctx.req);
    expect(session?.email).toBe(CEMAG_ADMIN_EMAIL);
    expect(session?.role).toBe("admin");
  });

  it("recusa a sessão quando o timestamp de atividade está ausente ou inválido", async () => {
    const { ctx } = createContext();
    ctx.req.headers.cookie = "cemag_session=token-invalido";
    await expect(readCemagSession(ctx.req)).resolves.toBeNull();
  });
});
