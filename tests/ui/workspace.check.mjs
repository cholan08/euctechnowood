// End-to-end check of studio management: sign in, client + project, add a room by
// upload, Generate concepts in a style, Mark & edit "Remove", save a design, the
// room's history, and the presentation board. Driven over the Chrome DevTools Protocol.
// Usage: node tests/ui/workspace.check.mjs <app url> <photo> <screenshot dir> <email> <password>
// Run the app with IMAGE_PROVIDER=mock and a throwaway DATA_DIR so nothing is paid for or kept.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, sleep } from './cdp.mjs';

const [base, photoArg, shotsArg, email, password] = process.argv.slice(2);
const photo = resolve(photoArg);
const shots = resolve(shotsArg);
mkdirSync(shots, { recursive: true });
const c = await connect();
const errors = [];
c.on((m) => {
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
await c.send('Runtime.enable');
await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' · ' + extra : ''}`);
const ev = (js) => c.evaluate(js);
const shot = async (name) => writeFileSync(`${shots}/${name}.png`, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const waitFor = async (js, ms = 10000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await ev(js).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
};
const click = (sel, text) =>
  ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})]; const el = ${text ? `els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}))` : 'els[0]'}; if (!el) return false; el.click(); return true; })()`);
const typeInto = (sel, text) =>
  ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? ''`);
const noScroll = () => ev(`document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1`);
const go = async (url) => {
  const loaded = new Promise((r) => c.on((m) => m.method === 'Page.loadEventFired' && r()));
  await c.send('Page.navigate', { url });
  await loaded;
};
const mouse = (type, x, y) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
// Dialogs from window.prompt (design names) are answered by the CDP helper with "accept"; give them a name.
c.on((m) => m.method === 'Page.javascriptDialogOpening' && m.params.type === 'prompt' && c.send('Page.handleJavaScriptDialog', { accept: true, promptText: 'For the client' }).catch(() => {}));

// ---- sign in (sign out first: the browser may still hold a session from another check)
await go(`${base}/login`);
await ev(`fetch('/api/auth/logout', { method: 'POST' }).then(r => r.status)`);
await go(`${base}/`);
check('signed-out visit goes to the sign-in page', await waitFor(`location.pathname === '/login' && !!document.querySelector('.login-card')`));
check('sign-in page fits one screen', await noScroll());
await shot('w01-login');
await typeInto('input[type=email]', email);
await typeInto('input[type=password]', 'wrong-password-1');
await click('button[type=submit]');
check('wrong password shows a plain message', await waitFor(`document.querySelector('.form-error')?.textContent.includes('do not match')`));
await typeInto('input[type=password]', password);
await click('button[type=submit]');
check('signing in opens Projects', await waitFor(`location.pathname === '/' && document.querySelector('.page-head h1')?.textContent === 'Projects'`));
const nav = await ev(`[...document.querySelectorAll('.appnav-link')].map(a => a.textContent.trim())`);
check('admin sees Projects, Clients, Quick studio and Team', nav.join('|') === 'Projects|Clients|Quick studio|Team', nav.join('|'));
await shot('w02-projects-empty');

// ---- new project with a new client
await click('.page-actions .btn', 'New project');
// Wait for the client list to load, so it does not reset the choice made below.
await waitFor(`[...(document.querySelector('.dialog select')?.options ?? [])].some(o => o.value === 'new')`);
await sleep(300);
await ev(`(() => { const s = document.querySelector('.dialog select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'new'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await waitFor(`document.querySelectorAll('.dialog input').length >= 2`);
await typeInto('.dialog input[placeholder^="e.g. Mr."]', 'Mr. & Mrs. Raman');
await typeInto('.dialog input[placeholder^="e.g. 3BHK"]', 'Anna Nagar 3BHK');
await click('.dialog button[type=submit]');
check('creating a project opens it', await waitFor(`location.pathname.startsWith('/projects/') && document.querySelector('.page-head h1')?.textContent.includes('Anna Nagar 3BHK')`));
check('project shows its client and owner', (await text('.eyebrow-link')) === 'Mr. & Mrs. Raman' && (await text('.project-bar')).includes('Test Admin'));

// ---- add a room by uploading its photo
await click('.page-actions .btn', 'Add room');
await waitFor(`!!document.querySelector('.room-drop input[type=file]')`);
const { root } = await c.send('DOM.getDocument');
const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.room-drop input[type=file]' });
await c.send('DOM.setFileInputFiles', { nodeId, files: [photo] });
check('the photo previews in the dialog', await waitFor(`!!document.querySelector('.room-drop img')`));
await ev(`(() => { const s = document.querySelector('.dialog select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'living'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await typeInto('.dialog input[placeholder^="e.g. Master"]', 'Living room');
await shot('w03-add-room');
await click('.dialog button[type=submit]');
check('adding the room opens it', await waitFor(`location.pathname.startsWith('/rooms/') && document.querySelector('.page-head h1')?.textContent === 'Living room'`, 15000));
check('the history holds the original photo', await waitFor(`document.querySelectorAll('.history .image-card').length === 1`));
const roomPath = await ev('location.pathname');

// ---- Generate concepts in a style
await click('.page-actions a', 'Open in studio');
check('the room opens in the studio', await waitFor(`!!document.querySelector('.mode-switch') && !!document.querySelector('.crumb-link')`, 15000));
check('the breadcrumb leads back to the room', (await text('.crumb-link')).includes('Mr. & Mrs. Raman · Living room'));
const modes = await ev(`[...document.querySelectorAll('.mode-switch label')].map(l => l.textContent.trim())`);
check('three ways of working', modes.join('|') === 'Mark & edit|Standard|Generate', modes.join('|'));
await click('.mode-switch label', 'Generate');
check('Generate shows the style cards', await waitFor(`document.querySelectorAll('.style-card').length === 7`));
await click('.style-card', 'Luxury');
const combos = await ev(`[...document.querySelectorAll('.palette.on')].map(p => p.textContent.trim())`);
check('a style starts with two colour combinations as concepts', combos.length === 2, combos.join(', '));
await click('.palette', 'Emerald & walnut');
check('ticking a third combination adds a concept', (await text('.panel-foot .btn-accent')).includes('Generate 3 concepts'));
await click('.gen-head', 'Customise materials');
check('each concept lists its parts with the style filled in', await waitFor(`[...document.querySelectorAll('.el .el-value')].some(v => v.textContent.includes('Velvet'))`));
await click('.gen-head', 'Furniture');
await waitFor(`document.querySelectorAll('.ideas li').length > 3`);
await click('.ideas label', 'Three-seater sofa');
await click('.ideas label', 'Coffee table');
check('furniture can be picked', (await text('.gen-sec.open .gen-value')) === '2 picked');
check('studio still fits one screen', await noScroll());
await shot('w04-generate-panel');
await click('.panel-foot .btn-accent', 'Generate');
check('three concepts come back', await waitFor(`document.querySelectorAll('.choose-opt').length === 3`, 20000));
check('every result is saved to the room', await waitFor(`document.querySelector('.save-note.ok')?.textContent.includes('saved in the room history')`, 15000));
await click('.choose-opt', '2');
await sleep(300);
await shot('w05-concepts');

// ---- Save design
await click('.stage-actions .btn', 'Save design');
check('Save design names it and marks it saved', await waitFor(`[...document.querySelectorAll('.stage-actions .btn')].some(b => b.textContent.trim() === 'Saved')`, 8000));

// ---- Mark & edit: Remove
await click('.mode-switch label', 'Mark & edit');
await waitFor(`!!document.querySelector('.action-switch')`);
await click('.action-switch label', 'Remove');
check('Remove hides the part list', await ev(`!document.querySelector('.parts')`));
const fr = await ev(`(() => { const r = document.querySelector('.marking').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const at = (fx, fy) => [fr.x + fr.w * fx, fr.y + fr.h * fy];
await mouse('mousePressed', ...at(0.3, 0.7));
for (let i = 1; i <= 15; i++) await mouse('mouseMoved', ...at(0.3 + 0.02 * i, 0.7 + (i % 2) * 0.02));
await mouse('mouseReleased', ...at(0.6, 0.7));
await sleep(200);
check('the mark registers', (await text('.step-done')).includes('Marked'));
await typeInto('#remove-what', 'the bottles');
await click('.btn', 'Remove it');
check('the removal is added to the changes', await waitFor(`[...document.querySelectorAll('.changes li')].some(l => l.textContent.includes('Removed'))`, 15000));
await waitFor(`document.querySelector('.save-note.ok')`, 15000);
await shot('w06-removed');

// ---- the room: history and saved designs
await go(`${base}${roomPath}`);
check('the room shows the saved design', await waitFor(`document.querySelector('.tab[aria-selected=true]')?.textContent.includes('Saved designs') && document.querySelectorAll('.card-grid .image-card').length === 1`));
await click('.page-tabs .tab', 'Image history');
const kinds = await ev(`[...document.querySelectorAll('.history .kind-chip')].map(k => k.textContent)`);
check('the history holds the original, 3 concepts and the removal', kinds.length === 5 && kinds.filter((k) => k === 'Generated concept').length === 3 && kinds.includes('Mark & edit'), kinds.join(', '));
await shot('w07-history');

// ---- presentation board
await click('.page-actions .btn', 'Presentation board');
check('the board is drawn', await waitFor(`!!document.querySelector('.board-preview img')`, 15000));
await sleep(300);
await shot('w08-board');
await click('.dialog .btn', 'Save to room');
check('the board is kept in the room', await waitFor(`[...document.querySelectorAll('.dialog .btn')].some(b => b.textContent.includes('Saved to room'))`, 10000));
await click('.dialog-x');

// ---- team page
await go(`${base}/team`);
check('team page lists staff', await waitFor(`document.querySelectorAll('.table tbody tr').length >= 1`));
await click('.page-tabs .tab', 'Usage');
// At least the 4 made here (3 concepts + 1 removal); other checks may share the server.
check('usage shows the images made', await waitFor(`Number(document.querySelector('.stat strong')?.textContent) >= 4`), await text('.stat strong'));
await shot('w09-usage');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
c.close();
process.exit(failed ? 1 : 0);
