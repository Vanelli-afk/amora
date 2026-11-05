import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { caveat, fraunces, nunito } from "./fonts";
import "./globals.css";
import "./amora.css";

export const metadata: Metadata = {
  title: { default: "Amora", template: "%s · Amora" },
  description: "O seu cantinho de cada dia: agenda, tarefas, notas e livros.",
  applicationName: "Amora",
  appleWebApp: { capable: true, title: "Amora", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F0E1" },
    { media: "(prefers-color-scheme: dark)", color: "#2B221D" },
  ],
};

const THEMES = new Set(["light", "dark", "auto"]);

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Tema decidido no servidor: nada de script bloqueante nem flash de cor errada.
  const stored = (await cookies()).get("amora-theme")?.value ?? "auto";
  const theme = THEMES.has(stored) ? stored : "auto";

  return (
    <html lang="pt-BR" data-theme={theme} className={`${fraunces.variable} ${nunito.variable} ${caveat.variable}`}>
      <body className="paper">{children}</body>
    </html>
  );
}
