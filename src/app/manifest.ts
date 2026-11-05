import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amora",
    short_name: "Amora",
    description: "O seu cantinho de cada dia: agenda, tarefas, notas e livros.",
    start_url: "/hoje",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F0E1",
    theme_color: "#F7F0E1",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo item", url: "/hoje?novo=compromisso" },
      { name: "Tarefas", url: "/tarefas" },
    ],
  };
}
