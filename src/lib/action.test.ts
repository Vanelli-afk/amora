import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const requireUser = vi.fn();
const allow = vi.fn();

vi.mock("./session", () => ({ requireUser }));
vi.mock("./rate-limit", () => ({ allow }));

const { defineAction, UserError } = await import("./action");

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ id: "u1" });
  allow.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const echo = defineAction("teste", z.object({ n: z.number().max(5, "Grande demais.") }), async ({ n }, { userId }) => ({ n, userId }));

describe("defineAction", () => {
  it("usa o usuário da sessão, ignorando o que vier do cliente", async () => {
    const result = await echo({ n: 1, userId: "invasor" } as unknown as { n: number });
    expect(result).toEqual({ ok: true, data: { n: 1, userId: "u1" } });
  });

  it("não executa sem sessão", async () => {
    const handler = vi.fn();
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/entrar;307;" });
    requireUser.mockRejectedValue(redirect);
    const action = defineAction("x", z.object({}), handler);
    await expect(action({})).rejects.toBe(redirect);
    expect(handler).not.toHaveBeenCalled();
  });

  it("devolve a mensagem de validação e não executa", async () => {
    const handler = vi.fn();
    const action = defineAction("x", z.object({ n: z.number().max(5, "Grande demais.") }), handler);
    expect(await action({ n: 9 })).toEqual({ ok: false, error: "Grande demais." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("nunca expõe detalhes internos de um erro", async () => {
    const action = defineAction("x", z.object({}), async () => {
      throw new Error("password authentication failed for user amora at 10.0.0.1");
    });
    const result = await action({});
    expect(result).toEqual({ ok: false, error: "Algo deu errado. Tente de novo em instantes." });
  });

  it("mostra a mensagem de UserError", async () => {
    const action = defineAction("x", z.object({}), async () => { throw new UserError("Tarefa não encontrada."); });
    expect(await action({})).toEqual({ ok: false, error: "Tarefa não encontrada." });
  });

  it("aplica o limite por usuário", async () => {
    allow.mockResolvedValue(false);
    const handler = vi.fn();
    const action = defineAction("x", z.object({}), handler, { limit: { max: 1, windowSeconds: 60 } });
    const result = await action({});
    expect(result.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(allow).toHaveBeenCalledWith("x:u1", 1, 60);
  });
});
