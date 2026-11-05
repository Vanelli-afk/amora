// Cluster Postgres só do projeto em .pgdata/, para não depender de Docker nem da senha
// de outra instalação. Usa os binários do Postgres 17 instalado na máquina.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DATA = resolve(".pgdata");
const LOG = resolve(".pgdata.log");
const PORT = "54329";

function findBin() {
  const candidates = [
    process.env.PG_BIN,
    "C:/Program Files/PostgreSQL/17/bin",
    "/usr/lib/postgresql/17/bin",
    "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/local/opt/postgresql@17/bin",
  ].filter(Boolean);
  const ext = process.platform === "win32" ? ".exe" : "";
  const found = candidates.find((dir) => existsSync(join(dir, `pg_ctl${ext}`)));
  if (!found) {
    console.error("Postgres 17 não encontrado. Instale-o ou defina PG_BIN com a pasta dos binários.");
    process.exit(1);
  }
  return (name) => join(found, `${name}${ext}`);
}

function dbPassword() {
  if (!existsSync(".env")) {
    console.error("Falta o .env. Rode `npm run setup`.");
    process.exit(1);
  }
  const match = readFileSync(".env", "utf8").match(/^DATABASE_URL=postgres:\/\/amora:([^@]+)@/m);
  if (!match) {
    console.error("DATABASE_URL não está no formato esperado no .env.");
    process.exit(1);
  }
  return match[1];
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (result.status !== 0 && !opts.allowFail) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

const bin = findBin();
const isRunning = () => run(bin("pg_ctl"), ["-D", DATA, "status"], { allowFail: true }).status === 0;

function up() {
  const password = dbPassword();
  const fresh = !existsSync(join(DATA, "PG_VERSION"));

  if (fresh) {
    const dir = mkdtempSync(join(tmpdir(), "amora-pg-"));
    const pwfile = join(dir, "pw");
    writeFileSync(pwfile, password, { mode: 0o600 });
    run(bin("initdb"), [
      "-D", DATA, "-U", "amora", "--pwfile", pwfile,
      "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C",
    ]);
    rmSync(dir, { recursive: true, force: true });
  }

  if (!isRunning()) {
    // stdio ignorado: no Windows o pg_ctl mantém os pipes abertos e travaria o spawnSync.
    run(bin("pg_ctl"), [
      "-D", DATA, "-l", LOG, "-w", "-o", `-p ${PORT} -c listen_addresses=127.0.0.1`, "start",
    ], { stdio: "ignore" });
  }

  const env = { ...process.env, PGPASSWORD: password };
  for (const name of ["amora", "amora_test"]) {
    const exists = run(bin("psql"), [
      "-h", "127.0.0.1", "-p", PORT, "-U", "amora", "-d", "postgres", "-tAc",
      `SELECT 1 FROM pg_database WHERE datname='${name}'`,
    ], { env });
    if (exists.stdout.trim() !== "1") {
      run(bin("createdb"), ["-h", "127.0.0.1", "-p", PORT, "-U", "amora", name], { env });
    }
  }
  console.log(`Postgres do projeto no ar em 127.0.0.1:${PORT}.`);
}

function down() {
  if (isRunning()) run(bin("pg_ctl"), ["-D", DATA, "-m", "fast", "stop"], { stdio: "ignore" });
  console.log("Postgres do projeto parado.");
}

const command = process.argv[2];
if (command === "up") up();
else if (command === "down") down();
else if (command === "status") console.log(isRunning() ? "rodando" : "parado");
else {
  console.error("Uso: node scripts/db.mjs up|down|status");
  process.exit(1);
}
