# SNAPCHANGE ⚡ — The 3-Second Visual Cash Change Trainer

**Live:** https://ob1d.github.io/snapchange/

SnapChange teaches the cashier's trick for giving change in about three seconds. When a customer hands over a note **plus some extra coins**, you shouldn't stop to do column subtraction. Slide both numbers onto a friendly ten, fuse the coins, and hand over the fewest notes and coins.

It's a zero-dependency, mobile-first **Progressive Web App**. It installs to the home screen, works offline, and deploys as static files to GitHub Pages.

---

## The three synchronized views

One scenario panel at the top (bill, note tendered, extra coins and currency) drives every view at once.

### 1. Constant-Difference Number Line & Bar-Chop (.EDU / .GOV visual)
- **Open number line.** Bill (`$11.70`) and Tender (`$21.70`) are joined by a rigid emerald **CHANGE GAP** beam (`$10.00`).
- **Slide to Friendly Ten** scrub slider, plus an **Auto-Slide (−$1.70)** button. Both glide the two markers left together onto `$10.00` and `$20.00`, which shows that the gap never changes: `a − b = (a − k) − (b − k)`.
- **Parallel Bar-Chop diagram.** Tender and Bill are drawn as stacked bars on the same scale, colour-coded by **Base note** (emerald), **Odd dollars** (amber) and **Cents** (cyan). Sliding, or pressing **⚡ Zap Overhang**, slices the matching `$1` and `70c` blocks off both bars at the same moment. The gap bracket underneath stays the same width.

### 2. POS "Drawer Already Open" Coin-Fusion Bucket
The register has already shown `$8.30` change when the customer finds `$1.70` in coins. **⚡ Fuse!** animates:
1. `30c + 70c → $1.00`
2. `$8.00 + $1.00 + $1.00 → $10.00`
3. `1× $10 note`. This is the greedy minimum, compared with the 5 pieces you would otherwise count out.

The verdict under the animation is honest about whether fusing actually helps:
- **✅ Fewer pieces.** When the late coins cancel the bill's odd cents, as in the default example, it reports "That's 4 pieces fewer".
- **⚠️ Saves nothing.** When fusing gives the same number of pieces, it says so.
- **⚠️ Clunkier.** When the late coins make the change worse, it says how many more pieces they cost. For example, $1.70 offered on an $11.75 bill gives 8 pieces instead of 4.

In the last two cases the box turns red. It then explains the **Rescue rule**: only accept late coins that cancel the bill's odd cents, and otherwise hand them back. Where it helps, it also shows the coins that would have worked (for example, "75c would make the change $9.00 in 3 pieces").

### 3. Timed Cashier Speed Drill
- **🧾 5-Customer Daily Shift**: serve 5 customers against the clock.
- **🔥 60-Second Rush**: serve as many customers as you can in a minute.
- Both modes have a **millisecond timer** and a tap-to-build cash drawer.
- **Greedy minimum-note verification.** Your answer must be the right amount *and* use the fewest pieces:
  - ⚡ **Snap**: fewest pieces in under 3 s (150 pts)
  - ✅ **Exact**: fewest pieces (100 pts)
  - 🟨 **Clunky**: right amount but more pieces than needed (40 pts)
  - ❌ **Miss**: wrong amount (0 pts)
- **Procedural Web Audio** effects: coin clinks, note rustles, zaps and fanfares are all synthesised live, with no audio files.
- **📋 Copy Emoji Scorecard** copies the result in one click:

```
SNAPCHANGE ⚡ Daily Shift (AUD)
⚡✅⚡🟨⚡
⏱ 14.380s · 🎯 4/5 exact · ⚡ 3 snaps
🏆 640 pts · 🔥 best streak 3
https://ob1d.github.io/snapchange/?view=drill&mode=shift&currency=AUD
```

Personal bests are stored per mode and currency in `localStorage`.

---

## Core engineering rules

### Strict integer-cents engine
Every amount is stored and calculated as an **integer number of cents/pence**. For example, `$21.70` is `2170` and `$11.70` is `1170`.

- `parseCents()` parses user input with **string arithmetic only**: `"11.7"` → `11 * 100 + 70`. The number is never written as `11.7`.
- `fmt()` formats with `Math.floor(c / 100)` and `c % 100`.
- `greedy()` breaks change into the minimum number of pieces with integer division. Every supported denomination set is canonical, so greedy is optimal. The test suite checks this by brute force against a dynamic-programming minimum, for every payable amount up to $200 in all five currencies.
- For 5c-minimum currencies (AUD and CAD), cash rounding goes to the nearest 5c: endings of 1–2c and 6–7c round down, and 3–4c and 8–9c round up.

No IEEE 754 drift is possible, because no fractional currency value ever exists. The pure engine is exposed as `window.SnapChange` for console tinkering and tests.

### Multi-currency
The header has five instant presets, which the **Currency** dropdown in the scenario panel mirrors:

| Header | Code | Notes / bills | Coins | Cash rounding |
|---|---|---|---|---|
| `A$` | AUD | $50 $20 $10 $5 | $2 $1 50c 20c 10c 5c | to 5c |
| `US$` | USD | $50 $20 $10 $5 **$1** bills | 25c 10c 5c 1c | none (1c exists) |
| `C$` | CAD | $50 $20 $10 $5 | $2 **toonie**, $1 **loonie**, 25c 10c 5c | to 5c (no penny since 2013) |
| `£` | GBP | £50 £20 £10 £5 | £2 £1 50p 20p 10p 5p 2p 1p | none |
| `€` | EUR | €50 €20 €10 €5 | €2 €1 50c 20c 10c 5c 2c 1c | none |

Whether a denomination is paper or metal is set per currency. For example, `$1` is a **bill** in USD but a **coin** in AUD and CAD, and the tray, drawer pad, sounds and wording ("1× $10 bill" vs "1× $10 note") follow that. Canadian coins use their nicknames in tooltips, screen-reader labels and breakdowns. All five sets are canonical, so the greedy breakdown is always the true minimum. For example:

- US $8.30 is `$5 bill + 3×$1 bill + 25c + 5c`.
- CA $8.30 is `$5 note + $2 toonie + $1 loonie + 25c + 5c`.

If you switch currency while the tendered note doesn't exist in the new one (such as a US $1 bill going to AUD), the app picks the smallest real note that still covers the sale.

### URL deep-linking
Every scenario can be shared as a link:

```
https://ob1d.github.io/snapchange/?bill=11.70&note=20&extra=1.70&currency=AUD
```

| Param | Meaning | Example |
|---|---|---|
| `bill` | Sale total | `11.70` |
| `note` | Note / bill handed over | `20` |
| `extra` | Late extra coins | `1.70` |
| `currency` | `AUD` `USD` `CAD` `GBP` `EUR` (or `$` `£` `€`) | `GBP` |
| `view` | Open tab: `line` · `fusion` · `drill` | `fusion` |
| `mode` | Drill mode: `shift` · `rush` | `rush` |

The URL bar updates live as you edit, and **🔗 Copy share link** copies it. Invalid links are rejected with a message and the default scenario is used instead.

### Share QR Code
The **Share QR Code** button in the header opens a dialog with a QR code for `https://ob1d.github.io/snapchange/`, so a friend can scan it straight onto their phone. The dialog also has **Copy link**, the native **Share…** sheet (where the browser supports it), **Install app** (when the browser offers installation) and **Print Cheat Sheet**.

The QR code is a static inline SVG (version 3, error-correction level M, 29×29 modules plus a 4-module quiet zone). It is encoded once ahead of time, so there's no QR library at runtime. If the site moves, regenerate the code and update both the `<path d>` inside `#qrSvg` and `APP_URL` in `index.html`. For example, with Node.js `qrcode`, use `QRCode.create(url, { errorCorrectionLevel: 'M' })` and draw one `h`-run per row of dark modules, offset by 4 for the quiet zone. The printed cheat sheet clones this same SVG, so there is only one copy to update.

### Print Cheat Sheet
**🖨️ Print Cheat Sheet** prints a clean, one-page poster for the staff room or the till. You can press it in the scenario panel or in the share dialog, and **Ctrl/Cmd + P** prints the same poster. It contains three panels:

1. **The $1.70 Constant-Difference Shortcut.** A number-line diagram where $11.70 and $21.70 both slide −$1.70 onto $10.00 and $20.00, with the unchanged $10.00 change-gap beam and the rule.
2. **POS Late-Coin Rescue.** The open-drawer `$8.30` screen, the steps `30c + 70c → $1.00` and `$8.00 + $1.00 + $1.00 → $10.00`, hand over **1× $10** instead of 5 pieces, and the rescue rule (including "if they don't match, hand them back").
3. **The 3-second routine**, plus the QR code to `https://ob1d.github.io/snapchange/`.

How it's built:
- The poster is generated from the integer-cents engine, so it follows the selected currency. You get "30p + 70p → £1.00" in GBP and "1× $10 bill, not 6 pieces" in USD.
- It is a print-only `@media print` layout sized in mm with 11 mm page margins.
- It always prints on a light background, even when the device is in dark mode.
- The test suite renders it to PDF and confirms it is **exactly one page on both A4 and US Letter**, in light and dark mode, across currencies.

---

## Files

```
index.html                      the whole app: HTML + CSS + vanilla ES2020 JS + inline SVG + Web Audio
manifest.json                   installable PWA manifest (icons, shortcuts to each view)
sw.js                           offline-first service worker (precache + stale-while-revalidate)
icon.svg, icon-192.png, icon-512.png   app icons (512 is also the maskable icon)
.github/workflows/deploy.yml    deploys the repo root to GitHub Pages on every push to main
```

There is no build step, bundler, framework or CDN. It is ~95 KB of hand-written HTML/CSS/JS.

---

## Run locally

Service workers need `http://localhost` or HTTPS, so serve the folder rather than opening the file directly:

```bash
python -m http.server 8080        # or: npx serve .
# open http://localhost:8080/
```

Opening `index.html` from disk also works. Only the offline cache is skipped in that case.

---

## Deploy to GitHub Pages (live deployment guide)

1. **Push to `main`.** `.github/workflows/deploy.yml` uploads the repository root as a Pages artifact and deploys it.
2. **One-time setup.** Set the Pages source to **GitHub Actions**, in one of two ways:
   - UI: *Settings → Pages → Build and deployment → Source: GitHub Actions*
   - CLI:
     ```bash
     gh api -X POST repos/OB1D/snapchange/pages -f build_type=workflow
     # if Pages already exists:
     gh api -X PUT  repos/OB1D/snapchange/pages -f build_type=workflow
     ```
3. Watch the run in the **Actions** tab, or with `gh run watch`. The site is served at `https://<user>.github.io/<repo>/`.
4. **Forking?** All paths are relative (`./sw.js`, `./manifest.json`), so the app works at any sub-path with no config changes.

### Shipping updates
Browsers serve the cached shell first and refresh it in the background. When you change `index.html` or the icons, **bump `CACHE_VERSION` in `sw.js`** (currently `snapchange-v2.3.0`; next would be `snapchange-v2.3.1`). The new worker then installs, removes the old cache and takes over on the next visit.

### Why it scales
The app is a static file on GitHub's CDN. It has no server, database or API calls, and is roughly 95 KB. After the first visit, every load comes from the service-worker cache, so millions of users cost the same as one.

---

## Accessibility & UX
- Mobile-first layout with 44 px+ touch targets, safe-area insets and no horizontal scroll at 320 px.
- Diagrams render SVG at true pixel scale, so labels stay legible on phones.
- Light and dark themes follow the system preference.
- Respects `prefers-reduced-motion`.
- ARIA tabs with arrow/Home/End keys, live regions for results, and `<title>`/`<desc>` on every diagram.
- Drill keyboard shortcuts: **Enter** give change · **Backspace** undo · **Esc** clear.
- Mute toggle, remembered between visits.
