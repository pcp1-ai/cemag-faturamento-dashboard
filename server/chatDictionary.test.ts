import { describe, expect, it } from "vitest";
import { resolveChatTerm } from "../shared/chatDictionary";

describe("resolveChatTerm", () => {
  it("resolves Portuguese aliases without accents", () => {
    expect(resolveChatTerm("consultores")?.canonical).toBe("representante");
    expect(resolveChatTerm("municípios")?.canonical).toBe("municipio");
    expect(resolveChatTerm("mais vendidas")?.canonical).toBe("quantidade_faturada");
  });

  it("does not treat profit as revenue", () => {
    expect(resolveChatTerm("lucro")?.canonical).toBe("lucro");
    expect(resolveChatTerm("faturamento")?.canonical).toBe("faturamento_valor");
  });

  it("requires a complete alias and returns null for unknown terms", () => {
    expect(resolveChatTerm("carretas faturadas")?.canonical).toBe("carreta");
    expect(resolveChatTerm("lucrosamente")).toBeNull();
    expect(resolveChatTerm("coisa qualquer")).toBeNull();
  });
});
