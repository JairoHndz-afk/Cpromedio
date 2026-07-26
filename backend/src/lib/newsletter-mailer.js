import crypto from "node:crypto";

import nodemailer from "nodemailer";

import { env } from "../config/env.js";

let transporter;
let transporterCacheKey = "";
const MAIL_BRAND_NAME = "Colombiano Promedio";
const MAIL_BRAND_TAGLINE = "Hasta que la dignidad se haga costumbre";
const NEWSLETTER_LOGO_ASSET_PATH = "/assets/branding/logo-c-dark.png";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransporter() {
  const nextCacheKey = getMailMode() === "smtp"
    ? JSON.stringify({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        user: env.smtpUser
      })
    : "preview";

  if (transporter && transporterCacheKey === nextCacheKey) {
    return transporter;
  }

  if (getMailMode() === "smtp") {
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
    transporterCacheKey = nextCacheKey;

    return transporter;
  }

  transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix"
  });
  transporterCacheKey = nextCacheKey;

  return transporter;
}

function getMailMode() {
  if (env.resendApiKey && env.resendFromEmail) {
    return "resend";
  }

  if (env.mailConfigured && env.smtpHost && env.smtpUser && env.smtpPass) {
    return "smtp";
  }

  return "preview";
}

function buildAppUrl(pathname, token) {
  const url = new URL(pathname, `${env.publicSiteUrl}/`);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}

function buildPublicArticleUrl(slug) {
  return new URL(`/articulo/${slug}`, `${env.publicSiteUrl}/`).toString();
}

function buildPublicAssetUrl(pathname) {
  return new URL(pathname, `${env.publicSiteUrl}/`).toString();
}

function buildBrandLogoUrl() {
  return buildPublicAssetUrl(NEWSLETTER_LOGO_ASSET_PATH);
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

function buildLogoBackgroundStyle() {
  return [
    "background-color:#081223;",
    "background-image:radial-gradient(circle at top right, rgba(21,72,167,0.34), transparent 34%), radial-gradient(circle at bottom left, rgba(201,53,53,0.18), transparent 26%);"
  ].join("");
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
  const brandLogoUrl = buildBrandLogoUrl();

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
                        <table role="presentation" style="border-collapse:collapse;">
                          <tr>
                            <td valign="middle" style="padding:0 16px 0 0;">
                              <img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(MAIL_BRAND_NAME)}" width="64" height="64" style="display:block;width:64px;height:64px;border:0;border-radius:18px;" />
                            </td>
                            <td valign="middle">
                              <div style="display:inline-block;margin:0 0 10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.08);color:#f8cf44;font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;">
                                Bolet&iacute;n editorial
                              </div>
                              <div style="margin:0 0 8px;color:#ffffff;font-size:30px;font-weight:800;line-height:1.02;letter-spacing:0.08em;text-transform:uppercase;">
                                ${escapeHtml(MAIL_BRAND_NAME)}
                              </div>
                              <div style="color:#d6e2f5;font-size:13px;line-height:1.55;">
                                ${escapeHtml(MAIL_BRAND_TAGLINE)}
                              </div>
                            </td>
                          </tr>
                        </table>
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
  }

  return headers;
}

function buildProviderErrorMessage(payload, fallbackStatus) {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.name === "string" && payload.name.trim()) {
    return payload.name.trim();
  }

  if (typeof payload?.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message.trim();
  }

  return `El proveedor de correo rechazo el envio (${fallbackStatus}).`;
}

async function deliverMailThroughResend({ to, subject, html, text, unsubscribeUrl, feedbackKey }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `colombiano-promedio-mailer/1.0 (+${env.publicSiteUrl})`
    },
    body: JSON.stringify({
      from: `${MAIL_BRAND_NAME} <${env.mailFromEmail}>`,
      to: [to],
      subject,
      html,
      text,
      reply_to: env.mailReplyTo || undefined,
      headers: buildMailHeaders({
        unsubscribeUrl,
        feedbackKey
      })
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Resend rechazo un envio de correo.");
    console.error({
      status: response.status,
      from: env.mailFromEmail,
      replyTo: env.mailReplyTo || "",
      to,
      subject,
      payload
    });
    const error = new Error(buildProviderErrorMessage(payload, response.status));
    error.status = 502;
    throw error;
  }

  return payload;
}

async function deliverMail({ to, subject, html, text, unsubscribeUrl, feedbackKey }) {
  if (getMailMode() === "resend") {
    return deliverMailThroughResend({
      to,
      subject,
      html,
      text,
      unsubscribeUrl,
      feedbackKey
    });
  }

  const senderDomain = env.mailFromEmail.split("@")[1] || "localhost";

  const info = await getTransporter().sendMail({
    from: {
      name: MAIL_BRAND_NAME,
      address: env.mailFromEmail
    },
    sender: {
      name: MAIL_BRAND_NAME,
      address: env.mailFromEmail
    },
    to,
    replyTo: env.mailReplyTo || undefined,
    subject,
    html,
    text,
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
    unsubscribeUrl: buildAppUrl("/boletin/salir", unsubscribeToken),
    reactivateUrl: buildAppUrl("/boletin/reactivar", confirmationToken)
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
    unsubscribeUrl: links.unsubscribeUrl,
    feedbackKey: "bienvenida"
  });
}

export async function sendNewsletterGoodbyeEmail(subscription, { reactivationToken }) {
  const links = buildNewsletterLinks({
    confirmationToken: reactivationToken
  });

  const { html, text } = renderShell({
    eyebrow: "Bolet\u00edn en pausa",
    title: "Lamentamos verte partir",
    intro: `${subscription.name}, tu salida del bolet\u00edn ya fue confirmada.`,
    bodyLines: [
      "Desde este momento dejar\u00e1s de recibir nuevas publicaciones editoriales en este correo.",
      "Si cambias de idea, puedes reactivar tu suscripci\u00f3n con el bot\u00f3n principal o volver a registrarte desde la portada del sitio."
    ],
    ctaLabel: "Reactivar suscripci\u00f3n",
    ctaUrl: links.reactivateUrl,
    secondaryLabel: "Volver a la portada",
    secondaryUrl: links.homeUrl,
    footnote: "Este enlace de reactivaci\u00f3n se entrega para que puedas regresar sin repetir todo el proceso.",
    preheader: "Tu salida del bolet\u00edn fue procesada y puedes volver cuando quieras.",
    statusLabel: "Salida confirmada",
    highlights: [
      {
        eyebrow: "Control",
        text: "Tu correo ya no seguir\u00e1 dentro de la lista activa del bolet\u00edn.",
        accentColor: "#c93535"
      },
      {
        eyebrow: "Regreso",
        text: "Puedes volver desde este mismo mensaje o desde el formulario p\u00fablico.",
        accentColor: "#1548a7"
      }
    ]
  });

  if (!env.mailConfigured) {
    console.info(`[newsletter-links] reactivate=${links.reactivateUrl} home=${links.homeUrl}`);
  }

  await deliverMail({
    to: subscription.email,
    subject: `${MAIL_BRAND_NAME} | Tu suscripci\u00f3n fue cancelada`,
    html,
    text,
    feedbackKey: "despedida"
  });
}

export async function sendNewsletterArticlePublishedEmail(subscription, { article }) {
  const articleUrl = buildPublicArticleUrl(article.slug);
  const articleCategory = article.category?.name || article.tags?.[0] || "Nueva lectura";
  const articleAuthor = article.author?.name || "Equipo editorial";
  const articleExcerpt = article.excerpt || article.subtitle || "Ya hay una nueva pieza disponible en la portada editorial.";

  const { html, text } = renderShell({
    eyebrow: "Nueva publicaci\u00f3n",
    title: article.title,
    intro: articleExcerpt,
    bodyLines: [
      `Acabamos de publicar una nueva nota firmada por ${articleAuthor}.`,
      "Puedes abrirla desde el bot\u00f3n principal y continuar la lectura directamente en el sitio."
    ],
    ctaLabel: "Leer publicaci\u00f3n",
    ctaUrl: articleUrl,
    secondaryLabel: "Abrir portada",
    secondaryUrl: env.publicSiteUrl,
    footnote: "Recibes este aviso porque mantienes activa tu suscripci\u00f3n al bolet\u00edn editorial de Colombiano Promedio.",
    preheader: `Nueva publicaci\u00f3n disponible: ${article.title}.`,
    statusLabel: "Edici\u00f3n nueva",
    highlights: [
      {
        eyebrow: "Autor",
        text: articleAuthor,
        accentColor: "#1548a7"
      },
      {
        eyebrow: "Tema",
        text: articleCategory,
        accentColor: "#af7f00"
      }
    ]
  });

  if (!env.mailConfigured) {
    console.info(`[newsletter-links] article=${articleUrl}`);
  }

  await deliverMail({
    to: subscription.email,
    subject: `${MAIL_BRAND_NAME} | Nueva publicaci\u00f3n: ${article.title}`,
    html,
    text,
    feedbackKey: "publicacion"
  });
}
