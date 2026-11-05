// Desempacota amora-design.html em docs/design/ para consulta durante o desenvolvimento.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SCREENS = [
  "entrar", "criar-conta", "hoje", "cal-mes", "cal-semana", "novo-item", "detalhe-compromisso",
  "tarefas", "notas", "livros-estante", "livros-adicionar", "livros-detalhe", "perfil",
];

const source = readFileSync("amora-design.html", "utf8");

function island(html, type) {
  const open = `<script type="__bundler/${type}">`;
  const start = html.indexOf(open);
  if (start < 0) return null;
  const from = start + open.length;
  return html.slice(from, html.indexOf("</script>", from));
}

function decode(entry) {
  const raw = Buffer.from(entry.data, "base64");
  return entry.compressed ? gunzipSync(raw) : raw;
}

const manifest = JSON.parse(island(source, "manifest"));
const order = JSON.parse(island(source, "page_order"));
mkdirSync("docs/design", { recursive: true });

let css = "";
order.forEach((uuid, i) => {
  const page = decode(manifest[uuid]).toString("utf8");
  const template = JSON.parse(island(page, "template"));
  if (!css) {
    const a = template.indexOf("<style>") + "<style>".length;
    css = template.slice(a, template.indexOf("</style>", a));
  }
  const body = template.slice(template.indexOf("</helmet>") + "</helmet>".length);
  const clean = body
    .replaceAll("sc-camel-view-box", "viewBox")
    .replace(/\n\s*\n/g, "\n");
  writeFileSync(`docs/design/${SCREENS[i]}.html`, clean);
});

writeFileSync("docs/design/design.css", css);
console.log(`Extraídas ${order.length} telas e ${css.length} caracteres de CSS em docs/design/`);
