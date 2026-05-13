---
title: "Source Ledger"
description: "Public source ledger for the FROGGY HATES SNOW wiki."
draft: false
---

# Source Ledger

This is the public-source audit trail for the wiki. It separates source availability from gameplay certainty: a public achievement can verify a name without verifying the item's exact effect.

Entity status counts: Verified: 121, Needs verification: 2, Inferred: 27.

## Source Coverage

| Source Label | Referenced Entities |
|---|---:|
| Steam community achievements page | 92 |
| Steam community news/devlogs | 73 |
| Steam full-game store page | 62 |
| Steam demo store page | 62 |
| Steam global achievement percentages API | 42 |
| Achievement condition classification | 27 |
| Digital Bandidos game page | 24 |
| Xbox Wire developer interview | 3 |
| Thank You for an Incredible Launch — First Update and What Comes Next | 2 |

## Public Sources

| ID | Source | Confidence | Notes |
|---|---|---|---|
| `steam-full-store` | [Steam full-game store page](https://store.steampowered.com/app/3232380/FROGGY_HATES_SNOW/) | high | Official public Steam listing for app 3232380. |
| `steam-demo-store` | [Steam demo store page](https://store.steampowered.com/app/4037600/FROGGY_HATES_SNOW_Demo/) | high | Official public Steam listing for demo app 4037600. |
| `steam-full-appdetails` | [Steam full-game appdetails API](https://store.steampowered.com/api/appdetails?appids=3232380&cc=us&l=english) | high | Public Steam store API data summarized without raw long description dumps. |
| `steam-demo-appdetails` | [Steam demo appdetails API](https://store.steampowered.com/api/appdetails?appids=4037600&cc=us&l=english) | high | Public Steam store API data summarized without raw long description dumps. |
| `steam-full-achievements-page` | [Steam community achievements page](https://steamcommunity.com/stats/3232380/achievements/?l=english) | high | Public display names, descriptions, icons, and current global percentages. |
| `steam-full-global-achievement-percentages` | [Steam global achievement percentages API](https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=3232380&format=json) | high | Public no-key endpoint for internal achievement ids and volatile global percentages. |
| `steam-news-devlogs` | [Steam community news/devlogs](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | Official public Steam news/devlog stream used for launch counts, named mechanics, named skills/tools/companions, update notes, and system descriptions. |
| `steam-news-api` | [Steam News API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=3232380&count=20&maxlength=50000&format=json) | high | Public Steam News API used to map individual news/devlog posts to direct source records. |
| `steam-full-review-summary` | [Steam full-game review summary API](https://store.steampowered.com/appreviews/3232380?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0) | medium | Summary fetched only; review text not redistributed. Current summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":178,"total_negative":15,"total_reviews":193}. |
| `steam-demo-review-summary` | [Steam demo review summary API](https://store.steampowered.com/appreviews/4037600?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0) | medium | Summary fetched only; review text not redistributed. Current summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":139,"total_negative":3,"total_reviews":142}. |
| `steamdb-full` | [SteamDB full-game page](https://steamdb.info/app/3232380/) | medium | Third-party corroboration for app metadata, changenumbers, technologies, depots, and timestamps. |
| `steamdb-demo` | [SteamDB demo page](https://steamdb.info/app/4037600/) | medium | Third-party corroboration for demo metadata, parent app, depot, build, and timestamps. |
| `digital-bandidos-page` | [Digital Bandidos game page](https://digitalbandidos.com/games/froggy-hates-snow/) | medium | Publisher page for platforms, price, genre, and one-player listing. |
| `xbox-wire-interview` | [Xbox Wire developer interview](https://news.xbox.com/en-us/2026/05/05/froggy-hates-snow-interview/) | medium | Public developer interview covering solo developer context, launch scope counts, snow technology, skill/tool variety, companions, and Peaceful Mode. |
| `achievement-condition-classification` | [Achievement condition classification](local inference from public-source wording) | medium | Local classification of public achievement loadout names into wiki categories; exact in-game type and effect still need gameplay or safe metadata verification. |
| `steam-full-appdetails-summary` | [Steam full-game appdetails summary](https://store.steampowered.com/api/appdetails?appids=3232380&cc=us&l=english) | high | Summarized facts: type=game, name=FROGGY HATES SNOW, release={"coming_soon":false,"date":"May 7, 2026"}, achievements_total=42, screenshots=14, platforms={"windows":true,"mac":false,"linux":false}. |
| `steam-demo-appdetails-summary` | [Steam demo appdetails summary](https://store.steampowered.com/api/appdetails?appids=4037600&cc=us&l=english) | high | Summarized facts: type=demo, name=FROGGY HATES SNOW Demo, fullgame={"appid":"3232380","name":"FROGGY HATES SNOW"}, release={"coming_soon":false,"date":"Sep 24, 2025"}, platforms={"windows":true,"mac":false,"linux":false}. |
| `steam-post-launch-update` | [Thank You for an Incredible Launch — First Update and What Comes Next](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1832065502824701) | high | 2026-05-12: First post-launch update with Zippy, projectile-defense skills, early unlock/progression adjustments, Night Mode visibility, and UI scale changes. |
| `steam-launch-news` | [Froggy Hates Snow is out now!](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1832065502812843) | high | 2026-05-07: Launch announcement for the released full game. |
| `steam-launch-devlog` | [Devlog #7: What's New For Launch?](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155577514) | high | 2026-05-04: Launch devlog naming movement skills, projectile skills, robotic helpers, status effects, and skill-management systems. |
| `steam-anomalous-zones-devlog` | [Devlog #6: Introduction to Anomalous Zones](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1831432155565119) | high | 2026-04-29: Anomalous-zone devlog with challenge examples, hazards, Blue Gems, artifacts, and artifact rarity tiers. |
| `steam-release-date-news` | [Froggy Hates Snow release date revealed](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1830797770242233) | high | 2026-04-27: Release-date post with launch scope counts and demo progress carryover. |
| `steam-snow-devlog` | [Devlog #5: How Snow Works in Froggy Hates Snow](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1827626365766540) | high | 2026-03-24: Snow-system devlog explaining snow interaction, density/layers, and named snow/ice tools. |
| `steam-demo-overhaul-news` | [The Froggy Hates Snow demo is back – and it’s had a major overhaul](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1823825466505761) | high | 2026-02-09: Updated-demo announcement describing quest-based progress and Blue Gems unlocking characters, abilities, and locations. |
| `steam-next-demo-devlog` | [Devlog #3: What to expect from the next demo](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1823825466494740) | high | 2026-02-04: Pre-demo devlog describing ten frogs, unique specializations, main attacks, starting skillsets, and Blue Gem/quest meta-progression. |
| `steam-demo-update-devlog` | [Devlog #2: A quick update about the Froggy Hates Snow demo](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1821922921824108) | high | 2026-01-20: Demo update devlog previewing quest-based meta-progression and ten planned characters with unique skins, skills, and main attacks. |
| `steam-developer-intro-devlog` | [Devlog #1: Meet The Developer](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1819386365096417) | high | 2025-12-19: Developer introduction describing the game's interactive snow and digging ideas. |
