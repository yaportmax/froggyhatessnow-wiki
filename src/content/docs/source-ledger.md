---
title: "Source Ledger"
description: "Public source ledger for the FROGGY HATES SNOW wiki."
draft: false
---

# Source Ledger

This is the public-source audit trail for the wiki. It separates source availability from gameplay certainty: a public achievement can verify a name without verifying the item's exact effect.

Entity status counts: Verified: 114, Inferred: 27.

## Source Coverage

| Source Label | Referenced Entities |
|---|---:|
| Steam community achievements page | 91 |
| Steam community news/devlogs | 66 |
| Steam full-game store page | 57 |
| Steam demo store page | 57 |
| Steam global achievement percentages API | 42 |
| Achievement condition classification | 27 |
| Digital Bandidos game page | 19 |

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
| `steam-release-date-news` | [Steam release-date news post](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | All-news page includes the public launch-count post: 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, and demo progress carryover. |
| `steam-launch-devlog` | [Steam launch devlog](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | All-news page includes launch additions such as movement skills, robotic helpers, projectile skills, character leveling, artifact upgrades, status effects, roll upgrades, and skill banishing. |
| `steam-anomalous-zones-devlog` | [Steam anomalous zones devlog](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | All-news page includes anomalous-zone challenge types, hazards, Blue Gems, artifacts, and artifact rarity tiers. |
| `steam-snow-devlog` | [Steam snow systems devlog](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | All-news page includes snow heightmap behavior, snow density/layers, and named snow or ice tools. |
| `steam-post-launch-update` | [Steam first post-launch update](https://steamcommunity.com/app/3232380/allnews/?l=english) | high | All-news page includes first update changes for readability, boss projectile speed, projectile defense skills, Zippy, early unlocks, location progression, and UI scale. |
| `steam-full-review-summary` | [Steam full-game review summary API](https://store.steampowered.com/appreviews/3232380?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0) | medium | Summary fetched only; review text not redistributed. Current summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":178,"total_negative":15,"total_reviews":193}. |
| `steam-demo-review-summary` | [Steam demo review summary API](https://store.steampowered.com/appreviews/4037600?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0) | medium | Summary fetched only; review text not redistributed. Current summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":139,"total_negative":3,"total_reviews":142}. |
| `steamdb-full` | [SteamDB full-game page](https://steamdb.info/app/3232380/) | medium | Third-party corroboration for app metadata, changenumbers, technologies, depots, and timestamps. |
| `steamdb-demo` | [SteamDB demo page](https://steamdb.info/app/4037600/) | medium | Third-party corroboration for demo metadata, parent app, depot, build, and timestamps. |
| `digital-bandidos-page` | [Digital Bandidos game page](https://digitalbandidos.com/games/froggy-hates-snow/) | medium | Publisher page for platforms, price, genre, and one-player listing. |
| `steam-full-appdetails-summary` | [Steam full-game appdetails summary](https://store.steampowered.com/api/appdetails?appids=3232380&cc=us&l=english) | high | Summarized facts: type=game, name=FROGGY HATES SNOW, release={"coming_soon":false,"date":"May 7, 2026"}, achievements_total=42, screenshots=14, platforms={"windows":true,"mac":false,"linux":false}. |
| `steam-demo-appdetails-summary` | [Steam demo appdetails summary](https://store.steampowered.com/api/appdetails?appids=4037600&cc=us&l=english) | high | Summarized facts: type=demo, name=FROGGY HATES SNOW Demo, fullgame={"appid":"3232380","name":"FROGGY HATES SNOW"}, release={"coming_soon":false,"date":"Sep 24, 2025"}, platforms={"windows":true,"mac":false,"linux":false}. |
