const normalize = (email: string) => email.trim().toLowerCase();

/** `list` vem de ALLOWED_EMAILS: e-mails separados por vírgula, ou `*` para liberar todos. */
export function isEmailAllowed(email: string, list: string | undefined): boolean {
  if (list === undefined || list.trim() === "*") return true;
  return list.split(",").map(normalize).includes(normalize(email));
}
