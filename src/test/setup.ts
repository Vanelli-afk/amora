import { existsSync, readFileSync } from "node:fs";

// Carrega o .env, mas força o banco de teste: os testes nunca tocam o banco de desenvolvimento.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match?.[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
