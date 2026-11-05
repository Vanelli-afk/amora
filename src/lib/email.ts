import "server-only";
import { appendFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

type Mail = { to: string; subject: string; text: string; html: string };

let transport: Transporter | undefined;

export async function sendMail(mail: Mail): Promise<void> {
  const config = env();

  // Permite ao teste E2E ler o link sem servidor de e-mail. Nunca ativo em produção.
  if (config.MAIL_CAPTURE_FILE && config.NODE_ENV !== "production") {
    appendFileSync(config.MAIL_CAPTURE_FILE, `${JSON.stringify(mail)}\n`);
    return;
  }

  if (!config.SMTP_URL) {
    if (config.NODE_ENV === "production") throw new Error("SMTP não configurado.");
    console.info(`\n[e-mail de desenvolvimento] para ${mail.to}: ${mail.subject}\n${mail.text}\n`);
    return;
  }

  transport ??= nodemailer.createTransport(config.SMTP_URL);
  await transport.sendMail({ from: config.EMAIL_FROM, ...mail });
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function actionMail(to: string, subject: string, intro: string, cta: string, url: string): Mail {
  const safeIntro = escapeHtml(intro);
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject,
    text: `${intro}\n\n${cta}: ${url}\n\nSe não foi você, pode ignorar este e-mail.`,
    html: `<div style="font-family:Georgia,serif;color:#4A3B33;background:#F7F0E1;padding:32px">
      <div style="max-width:460px;margin:auto;background:#FFFCF5;border-radius:18px;padding:28px">
        <h1 style="color:#A63E29;margin:0 0 12px;font-size:28px">Amora</h1>
        <p style="font-size:16px;line-height:1.5">${safeIntro}</p>
        <p style="margin:24px 0"><a href="${safeUrl}" style="background:#BE4B33;color:#fff;padding:12px 20px;border-radius:14px;text-decoration:none;font-weight:bold">${escapeHtml(cta)}</a></p>
        <p style="font-size:13px;color:#62524A">Se não foi você, pode ignorar este e-mail.</p>
      </div></div>`,
  };
}
