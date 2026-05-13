import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const steamHeaderImage =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3232380/4aec6dc45dab3a096faeda88c8036627817f0cfe/header_alt_assets_0.jpg?t=1778580427";

export default defineConfig({
  site: "https://froggyhatessnow-wiki.vercel.app",
  integrations: [
    starlight({
      title: "FROGGY HATES SNOW Wiki",
      description: "Unofficial metadata-first fan wiki for FROGGY HATES SNOW.",
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
        { label: "Start Here", link: "/" },
        { label: "Game Metadata", link: "/game-metadata/" },
        { label: "Steam Source Snapshot", link: "/steam-source-snapshot/" },
        { label: "Achievement Source Matrix", link: "/achievement-source-matrix/" },
        { label: "Source Ledger", link: "/source-ledger/" },
        {
          label: "Guides",
          autogenerate: { directory: "guides" }
        },
        {
          label: "Generated Data",
          autogenerate: { directory: "generated" }
        },
        { label: "FAQ", link: "/faq/" },
        { label: "Contribute", link: "/contribute/" },
        { label: "Verification Status", link: "/verification-status/" }
      ]
    })
  ]
});
