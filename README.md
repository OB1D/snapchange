# SnapChange V2 — The 3-Second Visual Cash Change Trainer

> Bill **$11.70**. Customer hands you a **$20** note… then digs out **$1.70** in coins.
> Slide both numbers left by $1.70 → **$20.00 − $10.00 = $10.00**. One note back. Three seconds.

SnapChange is a mobile-first Progressive Web App that teaches cashiers, students and teachers how to work out cash change quickly. It has no dependencies, no build step and no backend. It works offline and installs to the home screen.

## Features

| View | What it teaches |
| --- | --- |
| **① Constant-difference number line** | The bill and tender markers are joined by a rigid emerald **CHANGE GAP** beam. You can drag the *Slide to Friendly Ten* slider, or press **Auto-Slide (−$1.70)**, to glide both markers onto $10.00 and $20.00. The gap stays the same throughout. |
| **Parallel bar-chop** | Two stacked bars (tender above bill) are coloured by **base note** (emerald), **odd dollars** (amber) and **cents** (cyan). **⚡ Zap Overhang** slices the matching $1.00 + 70c off both bars at once. |
| **② "Drawer already open" coin fusion** | The POS screen says $8.30, then the customer adds $1.70 in coins. Instead of cancelling the sale, you fuse them: `30c + 70c → $1`, then `$8 + $1 + $1 → $10`. The cashier hands over one $10 note instead of five pieces. |
| **④ Real cash guide** | Every note and coin in circulation for the selected currency, in its real colour, with coins drawn to relative size and in their real shape (for example the 12-sided AUD 50c and the 7-sided GBP 20p and 50p). Each entry shows what is pictured, its size, and any status such as the end of US penny production. Links go to the official central bank and mint sites. |
| **③ Timed cashier speed drill** | Two modes: a **5-Customer Shift** and a **60-Second Rush**. The timer counts in milliseconds. Answers are checked against the greedy minimum number of notes and coins. Sound effects are synthesised with the Web Audio API, and **📋 Copy Emoji Scorecard** copies your result in one click. |

All three views use the same scenario, so changing the bill, note, extra coins or currency updates every view. After a drill, **🔍 Explain last customer** loads the last customer from the drill into the visual views.

### Drill scoring

| Result | Emoji | Points |
| --- | --- | --- |
| Exact change, fewest pieces, ≤ 3 s | ⚡ | 150 |
| Exact change, fewest pieces | ✅ | 100 |
| Exact change, too many pieces | 🟨 | 40 |
| Wrong amount | ❌ | 0 |

Each mode keeps a personal best per currency in `localStorage`. On a computer you can press **Enter** to hand over the change, **Backspace** to undo and **Esc** to clear the tray.

## Currencies

Each currency uses the notes and coins that are really in circulation (checked October 2026). The **drill drawer** column lists the ones used to give change. The Real Cash tab also lists legal tender that is rarely used for change.

| Toggle | Notes in drawer | Coins in drawer | Shown but not used for change | Cash rounding |
| --- | --- | --- | --- | --- |
| `$` AUD | $100, $50, $20, $10, $5 | $2, $1, 50c, 20c, 10c, 5c | — | Nearest 5c |
| `$` USD | $100, $50, $20, $10, $5, $1 | 25c, 10c, 5c, 1c | $2 note, 50c and $1 coins | To the cent. Penny production ended in Nov 2025 and some stores round to 5c |
| `$` CAD | $100, $50, $20, $10, $5 | $2, $1, 25c, 10c, 5c | 50c coin | Nearest 5c (no penny since 2013) |
| `£` GBP | £50, £20, £10, £5 | £2, £1, 50p, 20p, 10p, 5p, 2p, 1p | — | To the penny |
| `€` EUR | €200, €100, €50, €20, €10, €5 | €2, €1, 50c, 20c, 10c, 5c, 2c, 1c | €500 (no longer issued) | To the cent. Some countries round to 5c |

The `$` button opens AUD; use the currency menu to switch to USD or CAD. All of these coin systems are canonical, so working from the largest denomination down always gives the fewest pieces. The data is in the `CASH` table in `index.html`. If a central bank issues a new note, edit that table and bump `CACHE_VERSION` in `sw.js`.

## Integer-cents engine

Every amount of money is stored and calculated as a **safe integer number of cents** (`$21.70` → `2170`, `$11.70` → `1170`). This avoids IEEE 754 drift such as `0.1 + 0.2 = 0.30000000000000004`.

- **Parsing** splits the input string on the decimal point (`"11.7"` → `11 * 100 + 70`). It never calls `parseFloat`.
- **Formatting** uses integer remainder and division (`(c - c % 100) / 100`, then `c % 100`, padded to two digits).
- **Greedy change** works through the denominations from largest to smallest, using whole-number counts. All of the supported coin systems are canonical, so the greedy result is always the minimum number of pieces.
- **Animations** move in whole cents, rounded to the smallest coin. Floats are only used to place things on screen in pixels.

You can try the engine in the DevTools console through `window.SnapChange.Cents`, for example `Cents.greedy(830, CURRENCIES.AUD)`.

## URL deep-linking

```
https://<user>.github.io/<repo>/?bill=11.70&note=20&extra=1.70&currency=AUD
```

| Param | Meaning | Example |
| --- | --- | --- |
| `bill` | Bill total | `11.70` |
| `note` | Note tendered | `20` |
| `extra` | Late extra coins from the customer | `1.70` |
| `currency` | `AUD`, `USD`, `CAD`, `GBP` or `EUR` | `GBP` |
| `view` | `line`, `fusion`, `drill` or `cash` (optional) | `cash` |
| `mode` | Drill mode `shift` or `rush` (optional) | `rush` |

The address bar updates live as you change the scenario. **🔗 Copy share link** copies the current URL. Invalid values are ignored and the app shows a short message about them.

## Files

```
index.html                    Whole app: HTML + CSS + vanilla ES2020 JS + inline SVG + Web Audio
manifest.json                 Installable PWA manifest (standalone, shortcuts, maskable icon)
sw.js                         Offline-first service worker (precache + stale-while-revalidate)
icon.svg, icon-192.png, icon-512.png
.github/workflows/deploy.yml  Deploys the repo root to GitHub Pages on every push to main
```

## Run locally

The service worker needs `http://` or `https://`, so serve the folder instead of opening the file directly:

```bash
npx serve .            # or: python3 -m http.server 8000
```

Then open <http://localhost:3000> (or `:8000`).

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`, or run the workflow from the **Actions** tab. `.github/workflows/deploy.yml` uploads the repository root and publishes it.
4. Your app will be live at `https://<user>.github.io/<repo>/`. All paths are relative, so the app works under a project sub-path.

Because the site is static and is served from GitHub's CDN, every visitor gets the same files and there is no server to scale. After the first visit, the service worker serves the app from the device.

### Shipping updates

`sw.js` serves cached files first and refreshes them in the background. When you change `index.html` or `manifest.json`, also bump `CACHE_VERSION` in `sw.js` (for example to `snapchange-v2.1.1`). Returning visitors then get the new version on their next visit, and old caches are deleted.

## Accessibility

- Tabs follow the ARIA tab pattern and support arrow keys. Currency and mode toggles use radio-group roles.
- Live regions announce the equations, the drill feedback and the POS screen.
- `prefers-reduced-motion` turns off animations, and `prefers-color-scheme` switches between the light and dark themes.
- Tap targets are at least 44 px, and the layout respects safe-area insets on notched phones.

## License

MIT
