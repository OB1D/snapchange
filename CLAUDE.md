# Project: SNAPCHANGE — The 3-Second Visual Cash Change Trainer

## Goal
Build a zero-dependency, mobile-first Progressive Web App (PWA) designed to scale to millions of users on GitHub Pages.

## Files to Generate
1. `index.html` — Standalone single-file app (HTML5, embedded CSS/Tailwind, vanilla ES6+ JS, inline SVG/Canvas visuals, Web Audio API synth).
2. `manifest.json` — Installable PWA Web App Manifest.
3. `sw.js` — Offline-first Service Worker caching `index.html` and `manifest.json`.
4. `.github/workflows/deploy.yml` — GitHub Actions workflow deploying the repository root to GitHub Pages on every push to `main`.
5. `README.md` — Documentation and live deployment guide.

## Core Engineering Rules
- **Strict Integer-Cents Engine:** Store and calculate all currency amounts in integer cents (`$21.70` = `2170`, `$11.70` = `1170`) to prevent IEEE 754 floating-point drift.
- **Multi-Currency Support:** Instant toggle between `$` (AUD/USD/CAD: $50, $20, $10, $5 notes; $2, $1, 50c, 20c, 10c, 5c coins), `£` (GBP), and `€` (EUR).
- **URL Deep-Linking:** Support query parameters (`?bill=11.70&note=20&extra=1.70&currency=AUD`) for instant sharing.

## 3 Synchronized Interactive Views
1. **View 1: Constant-Difference Number Line & Bar-Chop (.EDU / .GOV Visual)**
   - **Open Number Line:** Connect Bill (`$11.70`) and Tender (`$21.70`) with a rigid emerald "CHANGE GAP" beam (`$10.00`). Add a "Slide to Friendly Ten" scrub slider and "Auto-Slide (-$1.70)" button that smoothly glides both markers left by `-$1.70` onto `$10.00` and `$20.00`, visually proving the gap never changes.
   - **Parallel Bar-Chop Diagram:** Two stacked horizontal bars (Tender vs. Bill) color-coded by Base Note (emerald), Odd Dollars (amber), and Cents (cyan). Sliding or clicking "Zap Overhang" slices off the matching `$1.00` and `70c` blocks simultaneously.
2. **View 2: POS "Drawer Already Open" Coin-Fusion Bucket**
   - Visually combine the POS screen change (`$8.30`) with the customer's late extra coins (`$1.70`), animating `30c + 70c -> $1.00` and `$8.00 + $1.00 + $1.00 -> 1x $10 Note`.
3. **View 3: Timed Cashier Speed Drill**
   - 5-Customer Daily Shift & 60-Second Rush with a millisecond timer, greedy minimum-note verification, procedural Web Audio effects, and a 1-click "Copy Emoji Scorecard" button.
