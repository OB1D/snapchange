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
counter.py                      optional self-hosted visitor counter + feedback inbox (Python 3 stdlib only)
triage.py, triage.ps1           feedback triage: fetch from Gmail / feedback.md, sandboxed Claude run, push guard
tests/e2e.mjs                   headless Chrome checks (Node 22+, Python 3, Chrome; no npm packages)
.github/workflows/deploy.yml    deploys the repo root to GitHub Pages on every push to main
.github/FUNDING.yml             the repo's Sponsor button (GitHub Sponsors + Ko-fi)
```

There is no build step, bundler, framework or CDN. It is ~100 KB of hand-written HTML/CSS/JS.

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
Browsers serve the cached shell first and refresh it in the background. When you change `index.html` or the icons, **bump `CACHE_VERSION` in `sw.js`** (currently `snapchange-v2.5.0`; next would be `snapchange-v2.5.1`). The new worker then installs, removes the old cache and takes over on the next visit.

### Why it scales
The app is a static file on GitHub's CDN and is roughly 100 KB. It needs no server, database or API. On its own it makes no network calls. The exceptions are the optional visitor-counter ping, which is off until you set a URL, and the feedback form, which only sends when someone presses **Send**. After the first visit, every load comes from the service-worker cache, so millions of users cost the same as one.

---

## Visitor counter (optional)

`counter.py` is a tiny self-hosted visit counter. It needs only Python 3, using `http.server` and `sqlite3` from the standard library, and it stores its numbers in `visits.db`, which is git-ignored.

| Endpoint | What it does |
|---|---|
| `GET /hit` | Counts one visit and returns `{"count": 1234, "unique_today": 56}` |
| `GET /stats` | Read-only totals: all-time visits, today's visits and uniques, and the last 7 days |
| `GET /health` | `{"ok": true}` |

CORS allows `https://ob1d.github.io`. Add more origins with `--origin`, which you can repeat.

```powershell
python counter.py                                   # serve on http://127.0.0.1:8797
python counter.py --stats                           # print visitor totals in PowerShell
python counter.py --stats --json                    # the same, as JSON
python counter.py --host 0.0.0.0 --trust-proxy      # behind your own HTTPS reverse proxy / tunnel
```

**Wiring it up.** Set `COUNTER_API_URL` near the top of the script in `index.html` to the counter's public **HTTPS** address, then bump `CACHE_VERSION`. A page served over HTTPS can't call a plain `http://` server. While `COUNTER_API_URL` is empty, which is the default, the app makes no request at all.

When the counter is reachable, the footer shows a small badge such as `👀 1,234 visits · 56 today`. If the counter is offline or blocked, the badge stays hidden and nothing else changes. Each browser session sends one counted `/hit`. Reloads in the same session only read `/stats`.

It also accepts `POST /feedback` from the in-app form, as described below. The default port is `8797`; pass `--port` to change it.

**Try it locally:**

```powershell
python -m http.server 8080                                  # terminal 1: the app
python counter.py --origin http://localhost:8080            # terminal 2: the counter
# set COUNTER_API_URL = 'http://localhost:8797' in index.html, then open http://localhost:8080/
```

**Privacy.** The counter sets no cookies and never stores an IP address. "Unique today" compares `sha256(daily random salt + IP + User-Agent)`. At midnight (server time) the salt and every hash are deleted, so past days keep only two numbers: visits and uniques. The request log leaves out IP addresses. Use `--trust-proxy` only when a reverse proxy you control sets `X-Forwarded-For`, because anyone can forge that header.

---

## Feedback

The **💬 Feedback** button in the footer opens an in-app form with three fields:
- **Type:** Bug, Improvement or Praise.
- **Message:** up to 2,000 characters.
- **Reply email:** optional.

On submit, the form `POST`s JSON to the FormSubmit AJAX endpoint (`FEEDBACK_URL` in `index.html`). The thank-you message appears in place, and the page never navigates away.

Each submission includes these fields:

| Field | Value |
|---|---|
| `_subject` | `SnapChange`, fixed. Triage filters on it. |
| `_captcha` | `false` |
| `_honey` | A hidden honeypot. Bots fill it in and FormSubmit drops those messages. |
| `type`, `message` | What the person wrote. |
| `email` / `_replyto` | Only when a reply email is given. |
| `currency`, `scenario`, `page` | The active currency, the bill / note / extra / view, and a share link that reproduces it. |

When `COUNTER_API_URL` is set, the same payload also goes to `counter.py`'s `POST /feedback`, which appends it to `feedback.md` (git-ignored). That endpoint accepts allowed origins only, drops honeypot hits silently, validates every field, and allows at most 5 per visitor per 10 minutes.

**FormSubmit setup (one time).** The first submission makes FormSubmit email an **Activate Form** link to the inbox. Click it, and every submission after that is delivered. FormSubmit can also give you a random alias to use in place of the address in `FEEDBACK_URL`, which keeps the address out of the page source.

## Feedback triage

`triage.ps1` turns the inbox into fixes:

```powershell
$env:GMAIL_APP_PASSWORD = 'xxxx xxxx xxxx xxxx'   # Google account > Security > App passwords
.\triage.ps1 -FetchOnly      # show unread "SnapChange" feedback (no Claude, no cost)
.\triage.ps1                 # triage, fix, test, push
.\triage.ps1 -NoPush         # same, but leave the commits for you to review
```

A run goes through these steps:

1. **Fetch.** `triage.py fetch` reads unread Gmail messages whose subject contains `SnapChange` over IMAP. It uses `GMAIL_USER`, which defaults to the FormSubmit address, and `GMAIL_APP_PASSWORD`. When no password is set, it reads the local `feedback.md` instead. Fetching never marks mail as read. If there's nothing new, the run stops there and Claude is never started.
2. **Triage.** `claude -p` follows the **Feedback triage** rules in `CLAUDE.md`:
   1. Filter out spam and noise.
   2. Collate duplicates.
   3. Keep only changes that improve the maths clarity, the accuracy or the mobile UX without bloat.
   4. Fix those, run `node tests/e2e.mjs`, and commit locally.
3. **Sandbox.** That run is locked down:
   - `--restricted` ignores your user settings and confines file tools to the repo.
   - `--strict-mcp-config` loads no MCP servers.
   - `dontAsk` permissions allow edits to `index.html`, `sw.js`, `README.md` and `manifest.json` only, and allow only the test, git-commit and git-diff commands.
   - It has no web access and no push.
   - `-BudgetUsd` caps the spend. The default is US$1 per run, on `-Model sonnet`.
4. **Ack.** `triage.py ack` marks the fetched mail as read, or moves `feedback.md` entries to `feedback.archive.md`.
5. **Guard.** The push guard comes from `origin/main`, not from the working tree, so a run can't loosen it. It blocks any commit that:
   - touches a file other than the four app files,
   - adds a new host, an external `<script src>`, an iframe, `eval`, a network call or cookies,
   - changes more than 400 lines, or
   - changes `index.html` without bumping `CACHE_VERSION`.
6. **Push.** The headless Chrome tests run again, then `git push origin main`.

If anything fails, the commits stay on local `main` for you to review. The next run refuses to start until you've dealt with them. Reports are saved to `triage/report-<time>.md`.

**Tests.** `node tests/e2e.mjs` covers the visitor counter, the 5-customer shift and its support card, and the feedback dialog. In that dialog it checks validation, the locked fields, the in-app confirmation, the failure path and the fit at 320 px. It also covers the `/feedback` hardening and the `triage.py` fetch/ack round trip. Every FormSubmit request is intercepted, so tests never send email.

---

## Support & contributing

SnapChange is free, ad-free and open source, and it works offline. It is built and maintained by one person. If it helps you or your team give change faster, here's how to help:

- **☕ Tip on Ko-fi:** [ko-fi.com/ob1d](https://ko-fi.com/ob1d). Every coffee goes into more drills, currencies and polish.
- **⭐ Star the repo.** It helps other cashiers, trainers and teachers find it.
- **🐞 Report a bug or suggest an idea** in [Issues](https://github.com/OB1D/snapchange/issues). Wrong change, a confusing screen and a missing currency are all worth a report.
- **🛠 Send a pull request.** Keep to the house rules:
  - Zero dependencies and no build step.
  - Every amount in integer cents.
  - Mobile-first, with 44 px touch targets.
  - Bump `CACHE_VERSION` in `sw.js` when the shell changes.

The **Sponsor** button at the top of the repo comes from `.github/FUNDING.yml`. The app itself asks only once, quietly, after you finish a 5-customer shift, and keeps a single line in the footer.

---

## Accessibility & UX
- Mobile-first layout with 44 px+ touch targets, safe-area insets and no horizontal scroll at 320 px.
- Diagrams render SVG at true pixel scale, so labels stay legible on phones.
- Light and dark themes follow the system preference.
- Respects `prefers-reduced-motion`.
- ARIA tabs with arrow/Home/End keys, live regions for results, and `<title>`/`<desc>` on every diagram.
- Drill keyboard shortcuts: **Enter** give change · **Backspace** undo · **Esc** clear.
- Mute toggle, remembered between visits.
