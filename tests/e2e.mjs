// SnapChange headless Chrome checks. Zero dependencies: Node 22+ (global fetch/WebSocket), Python 3, Chrome.
//   node tests/e2e.mjs            (CHROME_PATH overrides the browser; --keep leaves the temp dir for inspection)
// Serves a temp copy of the app (COUNTER_API_URL pointed at a temp counter.py), the untouched repo copy,
// and intercepts every https://formsubmit.co request so no real email is ever sent.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = process.argv.includes('--keep');
const CHROME = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => existsSync(p));
const PY = process.platform === 'win32' ? 'python' : 'python3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { await fetch(url); return true; } catch { await sleep(150); } } return false; };

if (!CHROME) { console.error('Chrome not found; set CHROME_PATH'); process.exit(2); }
const TMP = mkdtempSync(join(tmpdir(), 'snapchange-e2e-'));
const SITE = join(TMP, 'site'), PROFILE = join(TMP, 'profile'), FEEDBACK = join(TMP, 'feedback.md');
const [pSite, pRepo, pCounter] = [await freePort(), await freePort(), await freePort()];
const SITE_ORIGIN = `http://127.0.0.1:${pSite}`, REPO_ORIGIN = `http://127.0.0.1:${pRepo}`, COUNTER = `http://127.0.0.1:${pCounter}`;

// temp copy of the app with the counter switched on
mkdirSync(SITE);
for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png']) cpSync(join(REPO, f), join(SITE, f));
const html = readFileSync(join(REPO, 'index.html'), 'utf8');
const patched = html.replace(/^const COUNTER_API_URL = '';/m, `const COUNTER_API_URL = '${COUNTER}';`);
if (patched === html) { console.error("index.html: expected the line `const COUNTER_API_URL = '';`"); process.exit(2); }
writeFileSync(join(SITE, 'index.html'), patched);
const CACHE_VERSION = (/const CACHE_VERSION = '([^']+)'/.exec(readFileSync(join(REPO, 'sw.js'), 'utf8')) || [])[1];

const procs = [];
const run = (cmd, args) => { const p = spawn(cmd, args, { stdio: 'ignore' }); procs.push(p); return p; };
run(PY, ['-m', 'http.server', String(pSite), '--bind', '127.0.0.1', '--directory', SITE]);
run(PY, ['-m', 'http.server', String(pRepo), '--bind', '127.0.0.1', '--directory', REPO]);
run(PY, [join(REPO, 'counter.py'), '--host', '127.0.0.1', '--port', String(pCounter), '--db', join(TMP, 'visits.db'),
  '--feedback-file', FEEDBACK, '--origin', SITE_ORIGIN, '--quiet']);
const chrome = run(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${PROFILE}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--mute-audio', 'about:blank']);

let browserWs, ws;
const cleanup = async () => {
  try { browserWs && browserWs.send(JSON.stringify({ id: 1, method: 'Browser.close' })); } catch {}
  await sleep(600);
  for (const p of procs) { try { p.kill(); } catch {} }
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' });
  await sleep(400);
  if (!KEEP) { try { rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {} }
  else console.log('kept ' + TMP);
};

const watchdog = setTimeout(async () => { console.log('FAIL  harness: timed out after 150 s'); await cleanup(); process.exit(1); }, 150000);

try {
  if (!(await waitHttp(SITE_ORIGIN + '/')) || !(await waitHttp(REPO_ORIGIN + '/')) || !(await waitHttp(COUNTER + '/health'))) throw new Error('servers did not start');
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = readFileSync(join(PROFILE, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { await sleep(100); } }
  if (!port) throw new Error('Chrome did not start');
  browserWs = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await Promise.all([browserWs, ws].map((s) => (s.readyState === 1 ? null : new Promise((r) => s.addEventListener('open', r)))));

  let id = 0; const pending = new Map(); const events = []; const formsubmit = []; let formsubmitMode = 'ok';
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const CORS = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'content-type, accept' },
    { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' }, { name: 'Content-Type', value: 'application/json' }];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Fetch.requestPaused') { // fake FormSubmit: never reach the real service
      const r = msg.params.request;
      if (r.method !== 'OPTIONS') formsubmit.push({ url: r.url, method: r.method, body: r.postData });
      const ok = formsubmitMode === 'ok';
      const body = r.method === 'OPTIONS' ? '' : JSON.stringify(ok ? { success: 'true', message: 'The form was submitted successfully.' } : { success: 'false', message: 'boom' });
      ws.send(JSON.stringify({ id: ++id, method: 'Fetch.fulfillRequest', params: { requestId: msg.params.requestId,
        responseCode: r.method === 'OPTIONS' ? 204 : (ok ? 200 : 500), responseHeaders: CORS, body: Buffer.from(body).toString('base64') } }));
      return;
    }
    if (msg.method) events.push(msg);
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('eval: ' + ((r.result.exceptionDetails.exception || {}).description || '').slice(0, 300));
    return r.result.result.value;
  };
  const waitFor = async (expr, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100); } return false; };
  const nav = async (url) => { events.length = 0; await send('Page.navigate', { url }); await waitFor('document.readyState === "complete"'); };
  const requests = () => events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request.url);
  const jsErrors = () => events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
    .map((e) => JSON.stringify(e.params).slice(0, 200));
  const stats = async () => (await fetch(COUNTER + '/stats')).json();
  const hidden = (elId) => ev(`document.getElementById(${JSON.stringify(elId)}).hidden`);
  const feedbackFile = () => (existsSync(FEEDBACK) ? readFileSync(FEEDBACK, 'utf8') : '');

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://formsubmit.co/*', requestStage: 'Request' }] });

  // ---- A. visitor counter on (temp copy) ----
  await nav(SITE_ORIGIN + '/');
  check('A1 badge appears when the counter replies', await waitFor('!document.getElementById("visitBadge").hidden'));
  const badge = await ev('document.getElementById("visitBadge").textContent');
  check('A2 badge text from /hit', badge === '👀 1 visit · 1 today', badge);
  check('A3 first load sent /hit', requests().includes(COUNTER + '/hit'));
  check('A4 no JS errors', jsErrors().length === 0, jsErrors().join(' | '));
  await nav(SITE_ORIGIN + '/');
  await waitFor('!document.getElementById("visitBadge").hidden');
  check('A5 reload in the same session reads /stats only', requests().includes(COUNTER + '/stats') && !requests().includes(COUNTER + '/hit'));
  check('A6 reload did not add a visit', (await stats()).count === 1);
  const swCache = await ev(`(async()=>{await navigator.serviceWorker.ready;for(let i=0;i<30;i++){const k=await caches.keys();if(k.length)return k.join(',');await new Promise(r=>setTimeout(r,200));}return ''})()`);
  check(`A7 service worker cache is ${CACHE_VERSION}`, swCache === CACHE_VERSION, swCache);

  // ---- S. 5-customer shift + support card ----
  await nav(SITE_ORIGIN + '/?view=drill&mode=shift');
  check('S1 support card hidden before a shift', await hidden('shiftSupport'));
  await ev('document.getElementById("startBtn").click()');
  for (let n = 0; n < 5; n++) {
    await waitFor('!!document.querySelector("#ticket .tl b")');
    await ev(`(() => {
      const num = (t) => window.SnapChange.parseCents(t.replace(/[^0-9.]/g, ''));
      const tls = [...document.querySelectorAll('#ticket .tl')];
      const bill = num(tls[0].querySelector('b').textContent), tender = num(tls[2].lastElementChild.textContent);
      const C = window.SnapChange.CURRENCIES[window.SnapChange.state.cur];
      const g = window.SnapChange.greedy(tender - bill, C.notes.concat(C.coins));
      for (const p of g.parts) for (let i = 0; i < p.n; i++) document.querySelector('#pad button[data-d="' + p.d + '"]').click();
      document.getElementById('submitBtn').click();
    })()`);
  }
  check('S2 shift results shown', await waitFor('!document.getElementById("drillDone").hidden', 3000));
  const emoji = await ev('document.getElementById("resEmoji").textContent');
  check('S3 engine-driven answers all exact', [...emoji.matchAll(/⚡|✅/gu)].length === 5, emoji);
  check('S4 support card shown after a completed shift', !(await hidden('shiftSupport')));
  await ev('document.getElementById("againBtn").click()'); await sleep(150);
  await ev('document.getElementById("quitBtn").click()'); await sleep(150);
  check('S5 quitting early never shows the card', await hidden('drillDone'));

  // ---- F. feedback dialog ----
  await nav(SITE_ORIGIN + '/?bill=11.70&note=20&extra=1.70&currency=AUD');
  const href0 = await ev('location.href');
  await ev('document.getElementById("feedbackBtn").click()');
  check('F1 footer Feedback button opens the dialog', await ev('document.getElementById("fbDialog").open'));
  check('F2 dialog shows the scenario it will send', /AUD · bill \$11\.70 · note \$20\.00 · extra \$1\.70/.test(await ev('document.getElementById("fbCtx").textContent')));
  await ev('document.getElementById("fbSendBtn").click()'); await sleep(200);
  check('F3 empty form is refused, nothing sent', formsubmit.length === 0 && /Pick a type/.test(await ev('document.getElementById("fbStatus").textContent')));
  await ev(`document.querySelector('input[name="fbType"][value="Bug"]').click(); document.getElementById('fbMsg').value = 'E2E: the 70c chop label overlaps at 320px'; document.getElementById('fbEmail').value = 'not-an-email'`);
  await ev('document.getElementById("fbSendBtn").click()'); await sleep(200);
  check('F4 bad reply email is refused, nothing sent', formsubmit.length === 0 && (await ev('document.getElementById("fbEmail").getAttribute("aria-invalid")')) === 'true');
  await ev(`document.getElementById('fbEmail').value = 'tester@example.com'`);
  await ev('document.getElementById("fbSendBtn").click()');
  check('F5 in-app confirmation shown', await waitFor('!document.getElementById("fbDone").hidden && document.getElementById("fbForm").hidden', 8000));
  const sent = formsubmit[0] || {}; let body = {};
  try { body = JSON.parse(sent.body || '{}'); } catch {}
  check('F6 posted once to the FormSubmit AJAX endpoint', formsubmit.length === 1 && sent.method === 'POST' && sent.url === 'https://formsubmit.co/ajax/0418665007mal@gmail.com', sent.url);
  check('F7 locked fields: _subject, _captcha, _honey', body._subject === 'SnapChange' && body._captcha === 'false' && body._honey === '', JSON.stringify({ s: body._subject, c: body._captcha, h: body._honey }));
  check('F8 type, message, reply, currency and scenario sent', body.type === 'Bug' && /70c chop/.test(body.message) && body.email === 'tester@example.com'
    && body._replyto === 'tester@example.com' && body.currency === 'AUD' && /bill \$11\.70/.test(body.scenario) && /bill=11\.70/.test(body.page || ''), JSON.stringify(body).slice(0, 160));
  check('F9 copy also stored by counter.py /feedback', /\| Bug \| fb-[0-9a-f]+/.test(feedbackFile()) && feedbackFile().includes('> E2E: the 70c chop label overlaps at 320px'));
  check('F10 page did not navigate', (await ev('location.href')) === href0);
  await ev('document.getElementById("fbCloseBtn").click()');
  check('F11 Done closes the dialog', !(await ev('document.getElementById("fbDialog").open')));
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  await ev('document.getElementById("feedbackBtn").click()');
  await sleep(200);
  const fit = await ev(`(()=>{const d=document.getElementById('fbDialog');return {sw:d.scrollWidth,cw:d.clientWidth,page:document.documentElement.scrollWidth}})()`);
  check('F12 dialog fits a 320px phone', fit.sw <= fit.cw && fit.page <= 320, JSON.stringify(fit));
  if (KEEP) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(TMP, 'feedback-320.png'), Buffer.from(shot.result.data, 'base64'));
  }
  await ev('document.getElementById("fbCancelBtn").click()');
  await send('Emulation.clearDeviceMetricsOverride');

  // counter.py /feedback hardening, straight over HTTP
  const post = (origin, obj) => fetch(COUNTER + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(obj) });
  const before = feedbackFile();
  const honey = await post(SITE_ORIGIN, { type: 'Praise', message: 'buy cheap pills', _honey: 'http://spam' });
  check('F13 honeypot submission accepted silently and dropped', honey.status === 200 && feedbackFile() === before);
  check('F14 unknown origin refused', (await post('https://evil.example', { type: 'Bug', message: 'hello there' })).status === 403);
  check('F15 invalid type refused', (await post(SITE_ORIGIN, { type: 'Hack', message: 'hello there' })).status === 400);

  // triage.py reads what counter.py wrote
  const t = spawnSync(PY, [join(REPO, 'triage.py'), 'fetch', '--source', 'local', '--feedback-file', FEEDBACK,
    '--out', join(TMP, 'inbox.json'), '--md', join(TMP, 'inbox.md')], { encoding: 'utf8' });
  let inbox = { items: [] }; try { inbox = JSON.parse(readFileSync(join(TMP, 'inbox.json'), 'utf8')); } catch {}
  check('T1 triage.py fetch parses the feedback.md entry', t.status === 0 && inbox.items.length === 1 && inbox.items[0].type === 'Bug'
    && inbox.items[0].reply === 'tester@example.com' && /70c chop/.test(inbox.items[0].message), (t.stdout + t.stderr).trim());
  const k = spawnSync(PY, [join(REPO, 'triage.py'), 'ack', '--in', join(TMP, 'inbox.json')], { encoding: 'utf8' });
  check('T2 triage.py ack archives it', k.status === 0 && !/fb-[0-9a-f]+/.test(feedbackFile()) && /70c chop/.test(readFileSync(join(TMP, 'feedback.archive.md'), 'utf8')), (k.stdout + k.stderr).trim());

  // ---- B. the shipped file (counter off) ----
  formsubmitMode = 'fail';
  await nav(REPO_ORIGIN + '/');
  await sleep(2000);
  const foreign = requests().filter((u) => !u.startsWith(REPO_ORIGIN + '/') && !u.startsWith('data:'));
  check('B1 shipped page makes no cross-origin requests on load', foreign.length === 0, foreign.join(','));
  check('B2 shipped badge stays hidden', await hidden('visitBadge'));
  await ev('document.getElementById("feedbackBtn").click()');
  await ev(`document.querySelector('input[name="fbType"][value="Praise"]').click(); document.getElementById('fbMsg').value = 'Love it'`);
  await ev('document.getElementById("fbSendBtn").click()');
  await waitFor('/Couldn/.test(document.getElementById("fbStatus").textContent)', 8000);
  check('B3 failed send keeps the form and says so', (await hidden('fbDone')) && /Couldn.t send/.test(await ev('document.getElementById("fbStatus").textContent')));
  check('B4 shipped page has no JS errors', jsErrors().length === 0, jsErrors().join(' | '));

  // ---- C. origin outside the counter's CORS list ----
  await nav(`http://localhost:${pSite}/`);
  await sleep(2000);
  check('C1 disallowed origin: badge hidden', await hidden('visitBadge'));
  check('C2 disallowed origin: no uncaught exception', !events.some((e) => e.method === 'Runtime.exceptionThrown'));
} catch (e) {
  fail++; console.log('FAIL  harness: ' + e.message);
} finally {
  clearTimeout(watchdog);
  console.log(`\n${pass} passed, ${fail} failed`);
  try { ws && ws.close(); } catch {}
  await cleanup();
  process.exit(fail ? 1 : 0);
}
