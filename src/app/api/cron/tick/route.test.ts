import { beforeAll, describe, expect, it } from "vitest";
import { prepareDb } from "@/test/db";
import { GET, POST } from "./route";

const SECRET = "s".repeat(32);
const call = (handler: typeof GET, authorization?: string) =>
  handler(new Request("http://localhost/api/cron/tick", { headers: authorization ? { authorization } : {} }));

beforeAll(async () => {
  process.env.CRON_SECRET = SECRET;
  await prepareDb();
});

describe("/api/cron/tick", () => {
  it.each([undefined, "Bearer errado", SECRET, `Bearer ${SECRET}x`])("recusa a credencial %s", async (authorization) => {
    expect((await call(GET, authorization)).status).toBe(401);
  });

  it("recusa tudo quando o segredo não está configurado", async () => {
    delete process.env.CRON_SECRET;
    try {
      expect((await call(GET, "Bearer undefined")).status).toBe(401);
      expect((await call(GET, "Bearer ")).status).toBe(401);
    } finally {
      process.env.CRON_SECRET = SECRET;
    }
  });

  it("executa um ciclo com a credencial certa, por GET e POST", async () => {
    for (const handler of [GET, POST]) {
      const response = await call(handler, `Bearer ${SECRET}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});
