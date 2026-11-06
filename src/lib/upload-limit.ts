// Sem dependências: é importado também por componentes de cliente.
// A Vercel recusa corpos acima de 4,5 MB antes de chegar ao app, e o multipart ocupa uma parte disso.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_TOO_LARGE = "A imagem precisa ter até 4 MB.";
