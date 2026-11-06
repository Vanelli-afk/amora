"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.assign("/entrar?etapa=2fa");
      },
    }),
  ],
});

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  EMAIL_NOT_VERIFIED: "Confirme o seu e-mail antes de entrar. Enviamos um novo link.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "Essa senha é longa demais.",
  INVALID_PASSWORD: "Senha incorreta.",
  INVALID_TOKEN: "Este link expirou ou já foi usado. Peça um novo.",
  TERMS_REQUIRED: "Para continuar, aceite os termos e a política de privacidade.",
  EMAIL_NOT_ALLOWED: "Este e-mail não tem acesso ao Amora.",
  INVALID_TWO_FACTOR_AUTHENTICATION: "Código incorreto.",
  INVALID_CODE: "Código incorreto.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Espere um pouco e tente de novo.",
  SESSION_EXPIRED: "Por segurança, entre de novo antes de fazer isso.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Esta conta entra pelo Google e não tem senha.",
};

type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

/** Mensagem em português para um erro do Better Auth, sem expor detalhes internos. */
export function authErrorMessage(error: AuthError): string {
  if (error?.status === 429) return MESSAGES.TOO_MANY_REQUESTS as string;
  const key = error?.code ?? error?.message ?? "";
  return MESSAGES[key] ?? "Não foi possível concluir. Tente de novo em instantes.";
}
