import { next, rewrite } from "@vercel/functions";

const SOCIAL_BOT_PATTERN =
  /(facebookexternalhit|meta-externalagent|whatsapp|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|bot|crawler|spider)/i;

export default function middleware(request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/articulo/")) {
    return next();
  }

  const userAgent = request.headers.get("user-agent") ?? "";

  if (!SOCIAL_BOT_PATTERN.test(userAgent)) {
    return next();
  }

  const slug = url.pathname.replace(/^\/articulo\/+/, "").replace(/\/+$/, "");

  if (!slug) {
    return next();
  }

  const destination = new URL(`/api/articulo/${slug}`, request.url);
  destination.search = url.search;

  return rewrite(destination);
}

export const config = {
  matcher: ["/articulo/:slug*"]
};
