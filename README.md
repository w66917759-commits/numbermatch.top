# Number Match — Play Online Free

Public static product repository generated from the main `gamesite` Hermes system.

Play Number Match now, a free browser merge puzzle that loads in seconds. No download needed — drop tiles, chain merges, and chase the next milestone.

## Play

- Live domain: https://numbermatch.top
- Canonical URL: https://numbermatch.top/game/number-match
- Game route: `/game/number-match`
- Render mode: iframe
- Source SEO file: [seo.json](./seo.json)

## SEO Blueprint

- SEO title: Play Number Match Online Free — No Download Browser Game
- H1: Number Match — Play Online Free
- Meta description: Play Number Match now, a free browser merge puzzle that loads in seconds. No download needed — drop tiles, chain merges, and chase the next milestone.
- Primary keyword: number match
- Category: puzzle
- Mechanic: merge
- Application category: Game
- Operating system: Any (HTML5)

## Keyword Variations

- Play Number Match online game free
- Number Match unblocked online game
- Number Match free game no download

## Internal Link Targets

- puzzle-games
- relaxing-games

## Gameplay Summary

Number Match is an HTML5 browser game built around reading the board, pairing equal numbers, and keeping enough free cells for the next move. You can play instantly with no download: scan for identical values, tap or drag matches depending on the embedded version, and clear space before the grid locks up. The goal is not just one match at a time; good runs plan two or three merges ahead so higher-value numbers remain reachable and the board stays open.

## How To Play

- Find two matching numbers, then select or drag them together to clear or upgrade the pair.
- Use every move to open space; blocked cells make later matches much harder.
- Plan chains ahead so high-value numbers stay reachable instead of trapped in corners.

## Tips

- Start by clearing isolated numbers before building larger combinations.
- Keep at least one lane open so new pieces do not split the board.
- When several matches exist, choose the one that creates the most future space.

## FAQ

- Do I need to install anything to play Number Match? No, the game is a browser-based HTML5 build — just open the page and start playing.
- Does Number Match run on mobile browsers? Yes, it runs smoothly on desktop and most modern phones without any plugin.

## Repository Metadata

- Slug: `number-match`
- Domain: https://numbermatch.top
- GitHub visibility: public by default
- Generated from: main `gamesite` generator repo

## Structure

- `/game/number-match/` contains the playable landing page.
- `/seo.json` contains the machine-readable SEO blueprint used to generate this README and page metadata.
- `/privacy`, `/terms`, `/cookies`, and `/disclaimer` are static compliance pages.
- `CNAME`, `robots.txt`, and `sitemap.xml` are ready for static hosting.
- `scripts/update-sitemap.mjs` regenerates the static sitemap from page canonical and hreflang tags.
- `sw.js` is generated when this domain has an ad service-worker zone configured.
- `vercel.json` forces Vercel to deploy this repository as a static no-framework site.

## Sitemap

Run this after adding, removing, or changing static pages:

```bash
node scripts/update-sitemap.mjs
```

GitHub Pages and Vercel both run the same script before deployment, so the deployed static `sitemap.xml` stays in sync with the HTML pages.

## Deploy

Recommended main-system flow:

```bash
pnpm project:repo -- --slug number-match --init-git --commit --create-github
pnpm project:vercel -- --slug number-match
```

Then configure DNS at the registrar:

```txt
@     A     76.76.21.21
www   A     76.76.21.21
```

Remove parking/forwarding records for `@` and `www`. `_domainconnect` TXT can stay.
