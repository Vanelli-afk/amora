import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "docs/**", "drizzle/**", "public/**", "scripts/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Isolamento por usuário: só a camada de dados fala com o banco.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/**", "src/db/**", "src/lib/auth.ts", "src/lib/rate-limit.ts", "src/worker/**", "src/**/*.test.ts", "src/test/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/db", "@/db/*", "**/db/index", "**/db/schema", "drizzle-orm", "drizzle-orm/*"],
          message: "Acesse o banco apenas por src/data/*, sempre com o userId da sessão.",
        }],
      }],
    },
  },
  {
    rules: {
      "react/no-danger": "error",
    },
  },
];

export default config;
