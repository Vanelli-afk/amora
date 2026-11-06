// A Vercel roda este script no lugar de `next build`, quando ele existe como `vercel-build`.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

// Só produção migra: um preview nunca pode alterar o banco de quem está usando o app.
if (process.env.VERCEL_ENV === "production") run("npx drizzle-kit migrate");
run("npx next build");
