import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { UserError } from "./errors";
import { allow } from "./rate-limit";
import { requireUser } from "./session";

export { UserError };

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC = "Algo deu errado. Tente de novo em instantes.";

type Limit = { max: number; windowSeconds: number };
type Ctx = { userId: string };

/**
 * Toda Server Action passa por aqui, porque é um endpoint público: exige sessão, valida a
 * entrada com Zod e nunca devolve detalhes internos ao cliente.
 */
export function defineAction<S extends z.ZodType, T>(
  name: string,
  schema: S,
  handler: (input: z.output<S>, ctx: Ctx) => Promise<T>,
  options?: { limit?: Limit },
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = await requireUser();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
      if (options?.limit) {
        const permitted = await allow(`${name}:${user.id}`, options.limit.max, options.limit.windowSeconds);
        if (!permitted) return { ok: false, error: "Muitas tentativas. Espere um pouco e tente de novo." };
      }
      return { ok: true, data: await handler(parsed.data, { userId: user.id }) };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof UserError) return { ok: false, error: error.message };
      // Só o tipo do erro: a mensagem pode conter dados do usuário.
      console.error(`[action:${name}] ${error instanceof Error ? error.name : "erro"}`);
      if (process.env.NODE_ENV !== "production") console.error(error);
      return { ok: false, error: GENERIC };
    }
  };
}
