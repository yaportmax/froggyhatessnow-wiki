# Public Research

Accessed: 2026-05-13

This note summarizes public metadata used to seed the wiki. It intentionally avoids raw long store-description dumps and raw review text.

## High-Confidence Sources

- Steam full-game store page: https://store.steampowered.com/app/3232380/FROGGY_HATES_SNOW/
- Steam demo store page: https://store.steampowered.com/app/4037600/FROGGY_HATES_SNOW_Demo/
- Steam appdetails API, full game: https://store.steampowered.com/api/appdetails?appids=3232380&cc=us&l=english
- Steam appdetails API, demo: https://store.steampowered.com/api/appdetails?appids=4037600&cc=us&l=english
- Steam community achievements page: https://steamcommunity.com/stats/3232380/achievements/?l=english
- Steam global achievement percentages API: https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=3232380&format=json

## Game-Level Facts

- Full game app ID: 3232380
- Demo app ID: 4037600
- Full game title: FROGGY HATES SNOW
- Demo title: FROGGY HATES SNOW Demo
- Developer: CRYING BRICK
- Publisher: Digital Bandidos
- Full game release date: {"coming_soon":false,"date":"May 7, 2026"}
- Demo release date: {"coming_soon":false,"date":"Sep 24, 2025"}
- Platforms from Steam appdetails: full={"windows":true,"mac":false,"linux":false}; demo={"windows":true,"mac":false,"linux":false}
- Genres from Steam appdetails: [{"id":"1","description":"Action"},{"id":"23","description":"Indie"},{"id":"2","description":"Strategy"}]
- Categories from Steam appdetails: [{"id":2,"description":"Single-player"},{"id":22,"description":"Steam Achievements"},{"id":28,"description":"Full controller support"},{"id":78,"description":"Adjustable Difficulty"},{"id":74,"description":"Playable without Timed Input"},{"id":23,"description":"Steam Cloud"},{"id":62,"description":"Family Sharing"}]
- Full game screenshots listed by appdetails: 14
- Demo screenshots listed by appdetails: 13
- Full-game languages: English * , French * , German * , Spanish - Spain * , Japanese * , Korean * , Polish * , Portuguese - Brazil * , Simplified Chinese * , Ukrainian * , Turkish * , Traditional Chinese * * languages with full audio support
- Demo languages: English * , French * , Italian * , German * , Spanish - Spain * , Ukrainian * * languages with full audio support

## Public Gameplay Concepts

- Verified from official Steam copy: digging through snow, warmth/freezing as survival pressure, gems, keys, treasure chests, artifacts, anomaly zones, escape door, bosses, enemies, Peaceful Mode, upgrades, tools, companions, and a snowy-desert setting.
- Verified named companions/tools/items from public copy or achievements include Penguin, Mole, Owl, Map, Shovel, Cart, Scanner, Locator, Pickaxe, Dynamite, Air Bomb, Flamethrower, Heater Sled, Gloves, Hot Tea, Energy Drink, Poison Flask, Frost Bomb, and Flashbang.
- Exact stats, unlock costs, named map roster, named boss roster, named enemy roster, and individual frog/character roster remain Needs verification unless local metadata or gameplay notes confirm them.

## Achievements

- Public community page rows parsed: 42
- Public global achievement API ids parsed: 42
- Achievement percentages are volatile and may differ slightly by endpoint/cache. Use them as as-of metadata only.

## Review Summaries

- Full game review summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":176,"total_negative":15,"total_reviews":191}
- Demo review summary: {"num_reviews":10,"review_score":8,"review_score_desc":"Very Positive","total_positive":139,"total_negative":3,"total_reviews":142}

## SteamCMD / Local Demo Acquisition Status

- Homebrew SteamCMD was installed successfully.
- Attempted command: `steamcmd +@sSteamCmdForcePlatformType windows +force_install_dir ./game-files +login anonymous +app_update 4037600 validate +quit`.
- Result: blocked in this macOS environment. The command produced repeated Steam launch/assertion output and left `game-files/` empty.
- A Docker SteamCMD fallback was attempted, but Docker/Rancher Desktop was not running, so the Docker API socket was unavailable.
- SteamDB indicates demo app 4037600 has Windows 64-bit depot 4037601, total size about 822.98 MiB and download size about 365.64 MiB. This is third-party corroboration, not Valve-official metadata.

## Cautions

- Do not infer entity effects, unlock costs, or roster completeness from names alone.
- Do not redistribute proprietary assets, binaries, source code, or large raw text excerpts from local game files.
- Refresh prices, review counts, player counts, and achievement percentages before using them in visible copy.
