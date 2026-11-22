// Headless-Chrome smoke test for Word Counter BD.
// Drives the Playwright-cached headless_shell over CDP with Node's built-in
// WebSocket (no npm deps). Run from the project root:
//   node tests/smoke.mjs [1280|390]
// Exits 0 only if every check passes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9231;
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = WIDTH <= 480 ? 844 : 800;
const URL = 'file://' + path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('timeout waiting for ' + label);
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT,
  '--window-size=' + WIDTH + ',' + HEIGHT,
  'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
      break;
    } catch { await sleep(250); }
  }
  if (!targets) throw new Error('DevTools endpoint never came up');

  const pageTarget = targets.find((t) => t.type === 'page');
  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const failedReqs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Network.loadingFailed') {
      failedReqs.push(msg.params.errorText);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  const setText = async (value) => {
    await evalJs(`document.getElementById("textInput").value = ${JSON.stringify(value)}`);
    await evalJs(`document.getElementById("textInput").dispatchEvent(new Event("input", { bubbles: true }))`);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 480 });
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'page load');
  await sleep(500);
  // Start from a clean slate (a previous smoke run may have persisted text).
  await evalJs('localStorage.clear()');
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'reload');
  await sleep(500);
  // Stub confirm() so sample/clear flows never block.
  await evalJs('window.confirm = () => true');

  console.log(`smoke @ ${WIDTH}x${HEIGHT}: ${URL}`);
  check('page title', (await evalJs('document.title')).includes('Word Counter BD'));
  check('app heading rendered', (await evalJs('document.querySelector("h1").textContent')) === 'Word Counter BD');
  check('words start at 0', (await evalJs('document.getElementById("statWords").textContent')) === '0');
  check('chars start at 0', (await evalJs('document.getElementById("statChars").textContent')) === '0');
  check('reading time starts at 0 sec', (await evalJs('document.getElementById("statReading").textContent')) === '0 sec');
  check('longest word empty dash', (await evalJs('document.getElementById("statLongestWord").textContent')) === '—');
  check('keywords empty message visible', (await evalJs('document.getElementById("keywordsEmpty").offsetParent !== null')));
  check('goal none message visible', (await evalJs('document.getElementById("goalStatus").textContent')).includes('No goal set'));
  check('no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests on load', failedReqs.length === 0, failedReqs.join(' | '));

  // Type a short English sentence.
  await setText('Hello world. How are you?');
  await sleep(300);
  check('words = 5', (await evalJs('document.getElementById("statWords").textContent')) === '5');
  check('chars = 25', (await evalJs('document.getElementById("statChars").textContent')) === '25');
  check('chars no spaces = 21', (await evalJs('document.getElementById("statCharsNoSpaces").textContent')) === '21');
  check('sentences = 2', (await evalJs('document.getElementById("statSentences").textContent')) === '2');
  check('paragraphs = 1', (await evalJs('document.getElementById("statParagraphs").textContent')) === '1');
  check('lines = 1', (await evalJs('document.getElementById("statLines").textContent')) === '1');
  check('reading time = 2 sec', (await evalJs('document.getElementById("statReading").textContent')) === '2 sec',
    await evalJs('document.getElementById("statReading").textContent'));
  check('longest word = Hello', (await evalJs('document.getElementById("statLongestWord").textContent')) === 'Hello');
  check('keywords table visible', (await evalJs('document.getElementById("keywordsTable").offsetParent !== null')));

  // Bangla text: danda sentence counting + Bengali digits after toggle (later).
  await setText('আমি ভাত খাই। তুমি কি খাও?');
  await sleep(300);
  check('bangla words = 6', (await evalJs('document.getElementById("statWords").textContent')) === '6');
  check('bangla sentences = 2', (await evalJs('document.getElementById("statSentences").textContent')) === '2');
  check('bangla longest word = তুমি', (await evalJs('document.getElementById("statLongestWord").textContent')) === 'তুমি',
    await evalJs('document.getElementById("statLongestWord").textContent'));

  // Load the labelled sample (81 words, 8 sentences, 2 paragraphs).
  await evalJs('document.getElementById("sampleBtn").click()');
  await sleep(300);
  check('sample words = 81', (await evalJs('document.getElementById("statWords").textContent')) === '81',
    await evalJs('document.getElementById("statWords").textContent'));
  check('sample sentences = 8', (await evalJs('document.getElementById("statSentences").textContent')) === '8');
  check('sample paragraphs = 2', (await evalJs('document.getElementById("statParagraphs").textContent')) === '2');
  check('sample reading = 24 sec', (await evalJs('document.getElementById("statReading").textContent')) === '24 sec',
    await evalJs('document.getElementById("statReading").textContent'));
  check('sample speaking = 32 sec', (await evalJs('document.getElementById("statSpeaking").textContent')) === '32 sec',
    await evalJs('document.getElementById("statSpeaking").textContent'));
  check('top keyword is read x2', (await evalJs('document.querySelector("#keywordsBody tr:first-child td:first-child").textContent')) === 'read',
    await evalJs('document.querySelector("#keywordsBody tr:first-child td:first-child").textContent'));
  check('top keyword count is 2', (await evalJs('document.querySelector("#keywordsBody tr:first-child td.num").textContent')) === '2');

  // Goal: set 100 -> 19 to go, 81% bar; bad goal shows error; remove goal.
  await evalJs('document.getElementById("goalInput").value = "100"');
  await evalJs('document.getElementById("goalSetBtn").click()');
  await sleep(300);
  check('goal status 19 words to go', (await evalJs('document.getElementById("goalStatus").textContent')) === '19 words to go',
    await evalJs('document.getElementById("goalStatus").textContent'));
  check('goal progress 81 / 100', (await evalJs('document.getElementById("goalProgressText").textContent')) === '81 / 100');
  check('goal bar 81%', (await evalJs('document.getElementById("goalBar").style.width')) === '81%');
  await evalJs('document.getElementById("goalInput").value = "abc"');
  await evalJs('document.getElementById("goalSetBtn").click()');
  await sleep(300);
  check('bad goal shows error', (await evalJs('document.getElementById("goalError").style.display')) !== 'none');
  check('bad goal keeps old status', (await evalJs('document.getElementById("goalStatus").textContent')) === '19 words to go');
  await evalJs('document.getElementById("goalClearBtn").click()');
  await sleep(300);
  check('goal removed shows none message', (await evalJs('document.getElementById("goalStatus").textContent')).includes('No goal set'));

  // Persistence across reload.
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'reload');
  await sleep(500);
  check('text persists across reload', (await evalJs('document.getElementById("statWords").textContent')) === '81');
  // Reload wipes the confirm stub (fresh JS context) — re-apply it before
  // the clear flow below, or native confirm() blocks the page forever.
  await evalJs('window.confirm = () => true');

  // Language toggle to Bangla.
  await evalJs('document.getElementById("langBtn").click()');
  await sleep(300);
  check('BN title after toggle', (await evalJs('document.querySelector("h1").textContent')) === 'ওয়ার্ড কাউন্টার বিডি',
    await evalJs('document.querySelector("h1").textContent'));
  check('BN words use Bengali digits', (await evalJs('document.getElementById("statWords").textContent')) === '৮১',
    await evalJs('document.getElementById("statWords").textContent'));
  check('BN reading time', (await evalJs('document.getElementById("statReading").textContent')) === '২৪ সেকেন্ড',
    await evalJs('document.getElementById("statReading").textContent'));
  await evalJs('document.getElementById("langBtn").click()');
  await sleep(300);
  check('back to EN title', (await evalJs('document.querySelector("h1").textContent')) === 'Word Counter BD');

  // Clear flow (confirm stubbed true).
  await evalJs('document.getElementById("clearBtn").click()');
  await sleep(300);
  check('clear empties words', (await evalJs('document.getElementById("statWords").textContent')) === '0');
  check('keywords empty again', (await evalJs('document.getElementById("keywordsEmpty").offsetParent !== null')));

  // No horizontal overflow at this viewport.
  const overflow = await evalJs('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  check('no horizontal overflow', overflow === 0, 'overflow=' + overflow);

  check('no console errors during whole run', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests during whole run', failedReqs.length === 0, failedReqs.join(' | '));

  // Screenshot for the run log (local only, not pushed).
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'tests', `smoke-${WIDTH}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log(`screenshot saved: tests/smoke-${WIDTH}.png`);
} catch (e) {
  console.log('  FAIL smoke harness error :: ' + (e && e.message ? e.message : e));
  fail++;
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  chrome.kill();
}

console.log(`\nsmoke @ ${WIDTH}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
