import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isProd
    // Prazo curto e sem preload enquanto o domínio não estabiliza: aumentar depois é fácil, reverter não.
    ? [{ key: "Strict-Transport-Security", value: "max-age=2592000" }]
    : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  // A Vercel comprime na borda. Aqui, a compressão juntava os pedaços do streaming e escondia bugs de navegação.
  compress: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "pg"],
  experimental: {
    // Capa de até 4 MB (multipart) e margem para o restante do formulário, no teto de 4,5 MB da Vercel.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default config;
