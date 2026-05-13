import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://froggyhatessnow.wiki",
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
