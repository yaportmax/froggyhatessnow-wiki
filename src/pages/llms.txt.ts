import type { APIRoute } from "astro";

import achievements from "../data/achievements.json";
import bosses from "../data/bosses.json";
import companions from "../data/companions.json";
import enemies from "../data/enemies.json";
import frogs from "../data/frogs.json";
import glossary from "../data/glossary.json";
import items from "../data/items.json";
import maps from "../data/maps.json";
import skills from "../data/skills.json";
import steamSnapshot from "../data/steam-snapshot.json";
import tools from "../data/tools.json";
import upgrades from "../data/upgrades.json";

const FALLBACK_SITE = "https://froggyhatessnow-wiki.vercel.app";
const DATASETS = {
  frogs,
  maps,
  tools,
  items,
  skills,
  companions,
  upgrades,
  bosses,
  enemies,
  achievements,
  glossary
};

function siteBase(site: URL | undefined) {
  return (site?.toString() ?? FALLBACK_SITE).replace(/\/$/, "");
}

function countEntities() {
  return Object.values(DATASETS).reduce((total, entries) => total + entries.length, 0);
}

export const GET: APIRoute = ({ site }) => {
  const base = siteBase(site);
  const body = [
    "# FROGGY HATES SNOW Wiki",
    "",
    "> Unofficial metadata-first fan wiki for FROGGY HATES SNOW.",
    "",
    "This site summarizes public Steam metadata, public Steam news/devlogs, public achievement data, publisher/developer public pages, and safe local metadata scan results. It intentionally does not redistribute proprietary game assets, binaries, source code, decompiled content, DRM-bypassed material, review text, or large raw text dumps.",
    "",
    "## Verification Policy",
    "",
    "- Allowed statuses: Verified, Inferred, Needs verification.",
    "- Verified entries require sources.",
    "- Inferred entries must stay distinguishable from confirmed gameplay facts.",
    "- Volatile figures such as prices, review counts, recommendations, and achievement percentages are as-of metadata.",
    "",
    "## Snapshot",
    "",
    `- Full game Steam app ID: ${steamSnapshot.apps.full_game.app_id}`,
    `- Demo Steam app ID: ${steamSnapshot.apps.demo.app_id}`,
    `- Source snapshot generated: ${steamSnapshot.generated_at}`,
    `- Source snapshot accessed date: ${steamSnapshot.accessed_date}`,
    `- Entity entries: ${countEntities()}`,
    `- Achievement rows: ${achievements.length}`,
    "",
    "## High-Value Pages",
    "",
    `- ${base}/`,
    `- ${base}/game-metadata/`,
    `- ${base}/steam-source-snapshot/`,
    `- ${base}/achievement-source-matrix/`,
    `- ${base}/source-ledger/`,
    `- ${base}/verification-status/`,
    `- ${base}/faq/`,
    `- ${base}/contribute/`,
    "",
    "## Generated Category Indexes",
    "",
    ...Object.entries(DATASETS).map(([name, entries]) => `- ${name}: ${entries.length} entries at ${base}/generated/${name}/`),
    "",
    "## Primary Public Sources",
    "",
    `- Steam full-game store page: ${steamSnapshot.sources.full_store}`,
    `- Steam demo store page: ${steamSnapshot.sources.demo_store}`,
    `- Steam News API snapshot: ${steamSnapshot.sources.steam_news_api}`,
    `- Steam achievements page: ${steamSnapshot.sources.full_achievements_page}`,
    `- Publisher page: ${steamSnapshot.sources.publisher_page}`,
    `- Xbox Wire interview: ${steamSnapshot.sources.xbox_wire_interview}`,
    "",
    "Use the Source Ledger and each entity page's source list before treating any individual claim as confirmed."
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
};
