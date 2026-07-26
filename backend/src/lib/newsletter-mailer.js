import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import nodemailer from "nodemailer";

import { env } from "../config/env.js";

let transporter;
const MAIL_BRAND_NAME = env.smtpFromName || "Colombiano Promedio";
const MAIL_BRAND_TAGLINE = "Hasta que la dignidad se haga costumbre";
const NEWSLETTER_LOGO_CID = "colombiano-promedio-logo-dark@newsletter";
const NEWSLETTER_LOGO_PATH = fileURLToPath(
  new URL("../../../frontend/src/assets/branding/logo-user-dark-email.png", import.meta.url)
);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (env.mailConfigured) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
      auth: env.smtpUser
        ? {
            user: env.smtpUser,
            pass: env.smtpPass
          }
        : undefined
    });

    return transporter;
  }

  transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix"
  });

  return transporter;
}

function buildAppUrl(pathname, token) {
  const url = new URL(pathname, `${env.publicSiteUrl}/`);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

function buildPublicAssetUrl(pathname) {
  return new URL(pathname, `${env.publicSiteUrl}/`).toString();
}

function buildBrandAttachments() {
  if (!existsSync(NEWSLETTER_LOGO_PATH)) {
    return [];
  }

  return [
    {
      filename: "colombiano-promedio-logo-dark.png",
      content: readFileSync(NEWSLETTER_LOGO_PATH),
      cid: NEWSLETTER_LOGO_CID,
      contentType: "image/png",
      contentDisposition: "inline",
      headers: {
        "X-Attachment-Id": NEWSLETTER_LOGO_CID
      }
    }
  ];
}

function renderHighlightCards(highlights) {
  return highlights
    .map(
      (item) => `
        <td style="width:50%;padding:0 8px 16px;vertical-align:top;">
          <div style="height:100%;padding:18px 18px 19px;border:1px solid rgba(19,31,53,0.1);border-radius:22px;background:#f7f5ef;">
            <div style="margin:0 0 10px;color:${escapeHtml(item.accentColor)};font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
              ${escapeHtml(item.eyebrow)}
            </div>
            <div style="margin:0;color:#101826;font-size:17px;font-weight:700;line-height:1.45;">
              ${escapeHtml(item.text)}
            </div>
          </div>
        </td>
      `
    )
    .join("");
}

function buildLogoBackgroundStyle({ size = "300px", position = "right -36px top -32px", opacity = 1 } = {}) {
  if (existsSync(NEWSLETTER_LOGO_PATH)) {
    return [
      "background-color:#081223;",
      `background-image:url('cid:${NEWSLETTER_LOGO_CID}');`,
      "background-repeat:no-repeat;",
      `background-position:${position};`,
      `background-size:${size};`,
      opacity < 1 ? `opacity:${opacity};` : ""
    ]
      .filter(Boolean)
      .join("");
  }

  return "background-color:#081223;";
}

function renderShell({
  eyebrow,
  title,
  intro,
  bodyLines,
  ctaLabel,
  ctaUrl,
  secondaryLabel,
  secondaryUrl,
  footnote,
  preheader,
  statusLabel,
  highlights
}) {
  const content = bodyLines
    .map((line) => `<p style="margin:0 0 14px;color:#5c687d;font-size:16px;line-height:1.72;">${escapeHtml(line)}</p>`)
    .join("");

  const secondaryLink = secondaryLabel && secondaryUrl
    ? `
        <p style="margin:18px 0 0;">
          <a href="${escapeHtml(secondaryUrl)}" style="color:#1548a7;text-decoration:none;font-weight:700;">
            ${escapeHtml(secondaryLabel)}
          </a>
        </p>
      `
    : "";

  const highlightRows = renderHighlightCards(highlights);

  return {
    html: `
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(preheader)}
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#eef2f7;font-family:Aptos,'Segoe UI',Arial,sans-serif;color:#101826;">
        <tr>
          <td align="center" style="padding:28px 12px;">
            <table role="presentation" style="width:100%;max-width:720px;border-collapse:collapse;background:#081223;border:1px solid rgba(17,27,47,0.12);border-radius:34px;overflow:hidden;box-shadow:0 28px 70px rgba(16,24,38,0.16);">
              <tr>
                <td style="height:8px;font-size:0;line-height:0;background:linear-gradient(90deg,#f8c400 0 46%, #1548a7 46% 79%, #c93535 79% 100%);">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 36px 28px;${buildLogoBackgroundStyle()}">
                  <table role="presentation" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td valign="top" style="padding:0 0 24px;">
                        <div style="display:inline-block;margin:0 0 14px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.08);color:#f8cf44;font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;">
                          Colombiano Promedio
                        </div>
                        <div style="margin:0 0 8px;color:#ffffff;font-size:30px;font-weight:800;line-height:1.02;letter-spacing:0.08em;text-transform:uppercase;">
                          ${escapeHtml(MAIL_BRAND_NAME)}
                        </div>
                        <div style="color:#d6e2f5;font-size:13px;line-height:1.55;">
                          ${escapeHtml(MAIL_BRAND_TAGLINE)}
                        </div>
                      </td>
                      <td align="right" valign="top" style="padding:0 0 24px 18px;">
                        <div style="display:inline-block;padding:12px 16px;border-radius:999px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.08);color:#f6f8ff;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                          ${escapeHtml(statusLabel)}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding:0;">
                        <div style="padding:28px 28px 30px;border-radius:28px;background:rgba(7,18,35,0.7);border:1px solid rgba(255,255,255,0.1);">
                          <div style="margin:0 0 14px;color:#8faef7;font-size:12px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">
                            ${escapeHtml(eyebrow)}
                          </div>
                          <h1 style="margin:0 0 16px;font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif;font-size:46px;line-height:1;color:#ffffff;">
                            ${escapeHtml(title)}
                          </h1>
                          <p style="margin:0;color:#d8e4f7;font-size:19px;line-height:1.75;">
                            ${escapeHtml(intro)}
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 24px;background:#081223;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;background:#fcfbf7;border:1px solid rgba(18,30,52,0.08);border-radius:30px;overflow:hidden;">
                    <tr>
                      <td style="padding:34px 34px 18px;">
                        ${content}
                        <div style="margin:26px 0 0;padding:24px 24px 22px;border-radius:24px;background:#f5efe2;border:1px solid rgba(248,196,0,0.32);">
                          <div style="margin:0 0 12px;color:#101826;font-size:15px;font-weight:800;">
                            Acci&oacute;n principal
                          </div>
                          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;min-height:48px;padding:14px 26px;border-radius:999px;background:linear-gradient(135deg,#163c88,#c93535);color:#fdfdfd;text-decoration:none;font-weight:800;box-shadow:0 16px 32px rgba(38,54,115,0.2);">
                            ${escapeHtml(ctaLabel)}
                          </a>
                          ${secondaryLink}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:4px 26px 8px;">
                        <table role="presentation" style="width:100%;border-collapse:collapse;">
                          <tr>
                            ${highlightRows}
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 34px 34px;color:#5b667b;font-size:13px;line-height:1.72;">
                        <p style="margin:0 0 10px;">${escapeHtml(footnote)}</p>
                        <p style="margin:0;">Si el bot&oacute;n no abre, copia y pega este enlace en tu navegador:<br /><span style="color:#1548a7;">${escapeHtml(ctaUrl)}</span></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
    text: [preheader, eyebrow, title, intro, ...bodyLines, `${ctaLabel}: ${ctaUrl}`, secondaryLabel && secondaryUrl ? `${secondaryLabel}: ${secondaryUrl}` : "", footnote]
      .filter(Boolean)
      .join("\n\n")
  };
}

function buildMailHeaders({ unsubscribeUrl, feedbackKey }) {
  const headers = {
    "Feedback-ID": `colombiano-promedio:${feedbackKey}:editorial`,
    "X-Auto-Response-Suppress": "OOF, AutoReply"
  };

  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return headers;
}

async function deliverMail({ to, subject, html, text, unsubscribeUrl, feedbackKey, attachments = [] }) {
  const senderDomain = env.smtpFromEmail.split("@")[1] || "localhost";

  const info = await getTransporter().sendMail({
    from: {
      name: MAIL_BRAND_NAME,
      address: env.smtpFromEmail
    },
    sender: {
      name: MAIL_BRAND_NAME,
      address: env.smtpFromEmail
    },
    to,
    replyTo: env.smtpReplyTo || undefined,
    subject,
    html,
    text,
    attachments: attachments.length ? attachments : undefined,
    date: new Date(),
    messageId: `<${crypto.randomUUID()}@${senderDomain}>`,
    headers: buildMailHeaders({
      unsubscribeUrl,
      feedbackKey
    })
  });

  if (!env.mailConfigured) {
    const preview = Buffer.isBuffer(info.message) ? info.message.toString("utf8") : String(info.message ?? "");
    console.info(`[newsletter-preview] ${subject}\n${preview}`);
  }

  return info;
}

export function buildNewsletterLinks({ confirmationToken, unsubscribeToken }) {
  return {
    homeUrl: env.publicSiteUrl,
    confirmUrl: buildAppUrl("/boletin/confirmar", confirmationToken),
    unsubscribeUrl: buildAppUrl("/boletin/salir", unsubscribeToken)
  };
}

export async function sendNewsletterConfirmationEmail(subscription, { confirmationToken, unsubscribeToken }) {
  const links = buildNewsletterLinks({
    confirmationToken,
    unsubscribeToken
  });

  const { html, text } = renderShell({
    eyebrow: "Bolet\u00edn editorial",
    title: "Confirma tu suscripci\u00f3n",
    intro: `${subscription.name}, tu acceso al bolet\u00edn ya est\u00e1 casi listo.`,
    bodyLines: [
      "Usamos un paso de confirmaci\u00f3n para proteger la comunidad de lectores y evitar registros falsos.",
      "Activa el bolet\u00edn con el bot\u00f3n principal y empieza a recibir nuevas publicaciones, portadas destacadas y avisos editoriales."
    ],
    ctaLabel: "Confirmar suscripci\u00f3n",
    ctaUrl: links.confirmUrl,
    secondaryLabel: "Cancelar esta solicitud",
    secondaryUrl: links.unsubscribeUrl,
    footnote: "Si no solicitaste este bolet\u00edn, ignora el mensaje o cancela la solicitud desde el enlace secundario.",
    preheader: "Confirma tu correo para activar el bolet\u00edn de Colombiano Promedio.",
    statusLabel: "Confirmaci\u00f3n pendiente",
    highlights: [
      {
        eyebrow: "Seguridad",
        text: "Solo el titular del enlace puede activar la suscripci\u00f3n.",
        accentColor: "#1548a7"
      },
      {
        eyebrow: "Lectura",
        text: "Recibir\u00e1s avisos editoriales y nuevas publicaciones sin ruido visual.",
        accentColor: "#af7f00"
      }
    ]
  });

  if (!env.mailConfigured) {
    console.info(`[newsletter-links] confirm=${links.confirmUrl} unsubscribe=${links.unsubscribeUrl}`);
  }

  await deliverMail({
    to: subscription.email,
    subject: `${MAIL_BRAND_NAME} | Confirma tu suscripci\u00f3n`,
    html,
    text,
    attachments: buildBrandAttachments(),
    unsubscribeUrl: links.unsubscribeUrl,
    feedbackKey: "confirmacion"
  });
}

export async function sendNewsletterWelcomeEmail(subscription, { unsubscribeToken }) {
  const links = buildNewsletterLinks({
    unsubscribeToken
  });

  const { html, text } = renderShell({
    eyebrow: "Bolet\u00edn activo",
    title: "Bienvenido al bolet\u00edn editorial",
    intro: `${subscription.name}, tu correo ya qued\u00f3 confirmado y el acceso al bolet\u00edn est\u00e1 activo.`,
    bodyLines: [
      "Desde ahora podr\u00e1s recibir nuevas publicaciones, piezas destacadas y acceso r\u00e1pido a la portada del medio.",
      "Si en alg\u00fan momento quieres salir, el enlace de administraci\u00f3n queda disponible dentro de este mismo correo."
    ],
    ctaLabel: "Abrir la portada",
    ctaUrl: links.homeUrl,
    secondaryLabel: "Administrar suscripci\u00f3n",
    secondaryUrl: links.unsubscribeUrl,
    footnote: "Este mensaje fue enviado porque activaste el bolet\u00edn de Colombiano Promedio desde el sitio p\u00fablico.",
    preheader: "Tu suscripci\u00f3n a Colombiano Promedio ya est\u00e1 activa.",
    statusLabel: "Suscripci\u00f3n activa",
    highlights: [
      {
        eyebrow: "Portada",
        text: "Accede a las nuevas lecturas desde el mismo punto de entrada del medio.",
        accentColor: "#1548a7"
      },
      {
        eyebrow: "Control",
        text: "Tu suscripci\u00f3n sigue bajo tu control y puedes salir cuando quieras.",
        accentColor: "#c93535"
      }
    ]
  });

  if (!env.mailConfigured) {
    console.info(`[newsletter-links] home=${links.homeUrl} unsubscribe=${links.unsubscribeUrl}`);
  }

  await deliverMail({
    to: subscription.email,
    subject: `${MAIL_BRAND_NAME} | Suscripci\u00f3n activa`,
    html,
    text,
    attachments: buildBrandAttachments(),
    unsubscribeUrl: links.unsubscribeUrl,
    feedbackKey: "bienvenida"
  });
}
