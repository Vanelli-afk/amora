import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Janela fixa em banco, atômica mesmo com vários processos. Retorna false se passou do limite. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO action_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN action_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE action_limits.count + 1 END,
      window_start = CASE WHEN action_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE action_limits.window_start END
    RETURNING count
  `);
  return Number(result.rows[0]?.count ?? 0) <= max;
}
