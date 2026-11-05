import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db, schema } from "@/db";
import { removeAllUserFiles } from "@/data/files";
import { actionMail, sendMail } from "./email";
import { env } from "./env";

const config = env();
const isProd = config.NODE_ENV === "production";
const google = config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
  ? { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET }
  : null;

export const isGoogleEnabled = () => google !== null;

export const auth = betterAuth({
  appName: "Amora",
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [config.BETTER_AUTH_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(actionMail(user.email, "Redefinir sua senha do Amora",
        "Recebemos um pedido para redefinir a sua senha. O link vale por 30 minutos.", "Redefinir senha", url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(actionMail(user.email, "Confirme o seu e-mail no Amora",
        "Falta só confirmar o seu e-mail para abrir o seu caderno.", "Confirmar e-mail", url));
    },
  },
  socialProviders: google ? { google } : {},
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Também exigida para listar aparelhos; ações destrutivas pedem a senha de qualquer forma.
    freshAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ newEmail, url }) => {
        await sendMail(actionMail(newEmail, "Confirme o seu novo e-mail no Amora",
          "Confirme este endereço para usá-lo na sua conta.", "Confirmar novo e-mail", url));
      },
    },
    deleteUser: {
      enabled: true,
      // As linhas somem por ON DELETE CASCADE; os arquivos em disco precisam ser apagados à parte.
      beforeDelete: async (user) => {
        await removeAllUserFiles(user.id);
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
      "/two-factor/*": { window: 60, max: 5 },
      "/change-password": { window: 60 * 10, max: 5 },
      "/delete-user": { window: 60 * 10, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: isProd,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProd },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      if (ctx.body?.acceptTerms !== true) {
        throw new APIError("BAD_REQUEST", { message: "TERMS_REQUIRED" });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Cadastro por e-mail exige o aceite acima; o Google mostra o aviso ao lado do botão.
        before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }),
        after: async (user) => {
          await db.insert(schema.userSettings).values({ userId: user.id }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [twoFactor({ issuer: "Amora" }), nextCookies()],
});

export type AuthUser = typeof auth.$Infer.Session.user;
