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
    "> Unofficial reference wiki for FROGGY HATES SNOW.",
    "",
    "This site exposes compact reference tables for extracted characters, skills, upgrades, items, maps, enemies, bosses, waves, mechanics, and achievements.",
    "",
    "## Snapshot",
    "",
    `- Full game Steam app ID: ${steamSnapshot.apps.full_game.app_id}`,
    `- Demo Steam app ID: ${steamSnapshot.apps.demo.app_id}`,
    `- Steam metadata generated: ${steamSnapshot.generated_at}`,
    `- Steam metadata accessed date: ${steamSnapshot.accessed_date}`,
    `- Entity entries: ${countEntities()}`,
    `- Achievement rows: ${achievements.length}`,
    "",
    "## High-Value Pages",
    "",
    `- ${base}/`,
    `- ${base}/generated/media/`,
    `- ${base}/generated/achievements/`,
    `- ${base}/generated/frogs/`,
    `- ${base}/generated/skills/`,
    `- ${base}/generated/upgrades/`,
    `- ${base}/generated/items/`,
    `- ${base}/generated/maps/`,
    `- ${base}/generated/enemies/`,
    `- ${base}/generated/bosses/`,
    `- ${base}/generated/waves/`,
    `- ${base}/generated/mechanics/`,
    `- ${base}/generated/quests/`,
    `- ${base}/generated/modes/`,
    `- ${base}/generated/terrain/`,
    "",
    "## Generated Category Indexes",
    "",
    ...Object.entries(DATASETS).map(([name, entries]) => `- ${name}: ${entries.length} entries at ${base}/generated/${name}/`),
    "",
    "## Steam Apps",
    "",
    `- Full game Steam app ID: ${steamSnapshot.apps.full_game.app_id}`,
    `- Demo Steam app ID: ${steamSnapshot.apps.demo.app_id}`
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
};
