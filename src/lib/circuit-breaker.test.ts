import { describe, expect, it, vi } from "vitest";
import { CircuitOpenError, createBreaker } from "./circuit-breaker";

const fail = () => Promise.reject(new Error("fora do ar"));

describe("circuit breaker", () => {
  it("abre depois de falhas seguidas e nem chama o serviço", async () => {
    const run = createBreaker({ failures: 2, now: () => 0 });
    await expect(run(fail)).rejects.toThrow("fora do ar");
    await expect(run(fail)).rejects.toThrow("fora do ar");
    const call = vi.fn(fail);
    await expect(run(call)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(call).not.toHaveBeenCalled();
  });

  it("um sucesso zera a contagem", async () => {
    const run = createBreaker({ failures: 2, now: () => 0 });
    await expect(run(fail)).rejects.toThrow();
    await run(async () => 1);
    await expect(run(fail)).rejects.toThrow("fora do ar");
  });

  it("depois da espera testa de novo e se recupera", async () => {
    let time = 0;
    const run = createBreaker({ failures: 1, cooldownMs: 100, now: () => time });
    await expect(run(fail)).rejects.toThrow("fora do ar");
    await expect(run(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
    time = 100;
    expect(await run(async () => 2)).toBe(2);
    expect(await run(async () => 3)).toBe(3);
  });

  it("volta a abrir se o teste falhar", async () => {
    let time = 0;
    const run = createBreaker({ failures: 1, cooldownMs: 100, now: () => time });
    await expect(run(fail)).rejects.toThrow("fora do ar");
    time = 100;
    await expect(run(fail)).rejects.toThrow("fora do ar");
    await expect(run(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("erro causado pela entrada não abre o circuito", async () => {
    const run = createBreaker({ failures: 1, now: () => 0, counts: (e) => (e as Error).message !== "entrada" });
    await expect(run(() => Promise.reject(new Error("entrada")))).rejects.toThrow("entrada");
    expect(await run(async () => 1)).toBe(1);
  });

  it("limita chamadas simultâneas", async () => {
    const run = createBreaker({ maxConcurrent: 1 });
    let release = () => {};
    const slow = run(() => new Promise<void>((resolve) => { release = resolve; }));
    await expect(run(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
    release();
    await slow;
    expect(await run(async () => 2)).toBe(2);
  });
});
