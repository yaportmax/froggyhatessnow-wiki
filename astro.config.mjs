import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://froggyhatessnow-wiki.vercel.app",
  integrations: [
    starlight({
      title: "FROGGY HATES SNOW Wiki",
      description: "Unofficial metadata-first fan wiki for FROGGY HATES SNOW.",
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
