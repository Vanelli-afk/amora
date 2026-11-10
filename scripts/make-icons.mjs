// Gera o favicon e os ícones do PWA a partir do mesmo desenho da amora.
// Rodar de novo só se o desenho mudar. Se mudar, troque também o nome dos arquivos em
// public/icons (e a VERSION do public/sw.js): o service worker e o celular guardam o ícone antigo.
import { mkdirSync, rmSync } from "node:fs";
import sharp from "sharp";

const PEACH = "#FADCC4"; // --peach
const BODY = "#8A70BF"; // lavanda um tom abaixo de --lav-e, para segurar o contraste em 16px
const DRUPE = "#E3D8F4";
const BLUSH = "#E69DAB"; // --rose-e
const INK = "#4A3B33"; // --tx
const LEAF = "#93B98A"; // --sage-e
const LEAF_DARK = "#7FA977";
const STEM = "#6E9A68";

const top = [[25, 26], [39, 26]];
const bottom = [[25, 50], [39, 50]];
const sides = [[19, 38], [45, 38]];

const circles = (list, r) => list.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");

const heart = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 3C-5-1-3-6 0-3 3-6 5-1 0 3z" fill="${fill}"/>`;

// Desenho em viewBox 64x64. `face` e `love` ficam de fora no favicon, onde seriam só ruído.
const berry = ({ face, love }) => `
  <path d="M32 20C24 21 16 18 14 11c9-1 16 2 18 9z" fill="${LEAF}"/>
  <path d="M32 20C34 13 40 9 48 9c1 8-5 13-16 11z" fill="${LEAF_DARK}"/>
  <path d="M31 21c-1-5 0-9 2-12" stroke="${STEM}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <g fill="${BODY}">${circles([...top, ...bottom, ...sides], 9)}<circle cx="32" cy="38" r="13"/></g>
  <g fill="${DRUPE}">${circles([...top, ...bottom], 5)}${face ? "" : circles(sides, 5)}${face ? "" : '<circle cx="32" cy="38" r="5"/>'}</g>
  <g fill="#fff" opacity=".85">${[...top, ...bottom].map(([x, y]) => `<circle cx="${x - 1.6}" cy="${y - 1.8}" r="1.1"/>`).join("")}</g>
  ${face ? `
  <g fill="${BLUSH}" opacity=".75"><ellipse cx="21" cy="42" rx="3.4" ry="2.3"/><ellipse cx="43" cy="42" rx="3.4" ry="2.3"/></g>
  <g fill="${INK}"><circle cx="27.5" cy="37" r="2.2"/><circle cx="36.5" cy="37" r="2.2"/></g>
  <g fill="#fff"><circle cx="28.2" cy="36.3" r=".8"/><circle cx="37.2" cy="36.3" r=".8"/></g>
  <path d="M29.500 41c1.200 1.800 3.800 1.800 5 0" stroke="${INK}" stroke-width="1.500" stroke-linecap="round" fill="none"/>` : ""}
  ${love ? heart(54, 17, 1.2, BLUSH) : ""}`;

const art = (size, { bg, rx = 0, scale = 1, face = true, love = true, crop = "0 0 64 64" } = {}) => {
  const [cx, cy, cw, ch] = crop.split(" ").map(Number);
  const t = (cw * (1 - scale)) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${cx} ${cy} ${cw} ${ch}">${bg ? `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${rx}" fill="${bg}"/>` : ""}<g transform="translate(${cx + t} ${cy + t}) scale(${scale})">${berry({ face, love })}</g></svg>`);
};

const png = (name, buffer) => sharp(buffer, { density: 300 }).png().toFile(name);

mkdirSync("public/icons", { recursive: true });
for (const old of ["icon-192", "icon-512", "icon-maskable-512", "apple-touch-icon"]) rmSync(`public/icons/${old}.png`, { force: true });
rmSync("src/app/icon.svg", { force: true });

// Ícone mascarável precisa de folga: o sistema recorta as bordas.
await png("public/icons/amora-192.png", art(192, { bg: PEACH, rx: 16 }));
await png("public/icons/amora-512.png", art(512, { bg: PEACH, rx: 16 }));
await png("public/icons/amora-maskable-512.png", art(512, { bg: PEACH, scale: 0.74 }));
await png("public/icons/amora-apple-180.png", art(180, { bg: PEACH, scale: 0.9 }));
// Aba do navegador: sem fundo, enquadrada na fruta para ocupar o quadradinho todo.
await png("src/app/icon.png", art(96, { face: false, love: false, crop: "5 6 54 54" }));
console.log("Ícones gerados em public/icons/ e src/app/icon.png");
