import type { APIRoute } from "astro";

const FALLBACK_SITE = "https://froggyhatessnow-wiki.vercel.app";

function siteBase(site: URL | undefined) {
  return (site?.toString() ?? FALLBACK_SITE).replace(/\/$/, "");
}

export const GET: APIRoute = ({ site }) => {
  const base = siteBase(site);
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${base}/sitemap-index.xml`,
    `Host: ${base.replace(/^https?:\/\//, "")}`,
    "",
    "# Unofficial FROGGY HATES SNOW wiki.",
    "# Public game metadata and compact local extraction summaries only."
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
};
