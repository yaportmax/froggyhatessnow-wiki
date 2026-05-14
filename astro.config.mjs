import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const steamHeaderImage =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3232380/4aec6dc45dab3a096faeda88c8036627817f0cfe/header_alt_assets_0.jpg?t=1778580427";

export default defineConfig({
  site: "https://froggyhatessnow-wiki.vercel.app",
  integrations: [
    starlight({
      title: "FROGGY HATES SNOW Wiki",
      description: "Unofficial reference wiki for FROGGY HATES SNOW.",
      disable404Route: true,
      head: [
        { tag: "meta", attrs: { property: "og:image", content: steamHeaderImage } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "FROGGY HATES SNOW Steam header art" } },
        { tag: "meta", attrs: { name: "twitter:image", content: steamHeaderImage } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: "FROGGY HATES SNOW Steam header art" } }
      ],
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/yaportmax/froggyhatessnow-wiki"
        }
      ],
      sidebar: [
        { label: "Home", link: "/" },
        { label: "Media", link: "/generated/media/" },
        {
          label: "Frogs",
          items: [
            { label: "All Frogs", link: "/generated/frogs/" },
            { label: "Froggy", link: "/generated/frogs/froggy/" },
            { label: "Puff", link: "/generated/frogs/puff/" },
            { label: "Zippy", link: "/generated/frogs/zippy/" }
          ]
        },
        {
          label: "Skills & Tools",
          items: [
            { label: "All Skills", link: "/generated/skills/" },
            { label: "Tools", link: "/generated/tools/" },
            { label: "Companions", link: "/generated/companions/" },
            { label: "Upgrades", link: "/generated/upgrades/" },
            { label: "Status Effects", link: "/generated/status-effects/" }
          ]
        },
        {
          label: "Items & Maps",
          items: [
            { label: "Artifacts & Items", link: "/generated/items/" },
            { label: "Locations", link: "/generated/maps/" },
            { label: "Snowplain", link: "/generated/maps/snowplain/" },
            { label: "Enemy Waves", link: "/generated/waves/" },
            { label: "Object Spawners", link: "/generated/spawners/" }
          ]
        },
        {
          label: "Bestiary",
          items: [
            { label: "Enemies", link: "/generated/enemies/" },
            { label: "Bosses", link: "/generated/bosses/" }
          ]
        },
        {
          label: "Progress",
          items: [
            { label: "Achievements", link: "/generated/achievements/" },
            { label: "Mechanics", link: "/generated/mechanics/" },
            { label: "Quest Templates", link: "/generated/quests/" },
            { label: "Modes & Difficulty", link: "/generated/modes/" },
            { label: "Terrain", link: "/generated/terrain/" },
            { label: "Glossary", link: "/generated/glossary/" }
          ]
        }
      ]
    })
  ]
});
