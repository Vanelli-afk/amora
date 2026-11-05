// Gera os ícones PNG do PWA. Rodar de novo só se o desenho mudar.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const icon = (size, { maskable = false } = {}) => {
  // Ícone mascarável precisa de folga: o sistema recorta as bordas.
  const scale = maskable ? 0.62 : 0.8;
  const w = 24 * (size / 64) * (scale / 0.8);
  const h = 40 * (size / 64) * (scale / 0.8);
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const radius = maskable ? 0 : size * 0.25;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#BE4B33"/>
    <path d="M${x} ${y}h${w}v${h}l-${w / 2} -${h * 0.225} -${w / 2} ${h * 0.225}z" fill="#FFFCF5"/>
  </svg>`);
};

mkdirSync("public/icons", { recursive: true });
await sharp(icon(192)).png().toFile("public/icons/icon-192.png");
await sharp(icon(512)).png().toFile("public/icons/icon-512.png");
await sharp(icon(512, { maskable: true })).png().toFile("public/icons/icon-maskable-512.png");
await sharp(icon(180, { maskable: true })).png().toFile("public/icons/apple-touch-icon.png");
console.log("Ícones gerados em public/icons/");
