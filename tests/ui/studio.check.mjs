// End-to-end check of the studio (Mark & edit, Standard, Final 2K), driven over the Chrome DevTools Protocol.
// Usage (see README): node tests/ui/studio.check.mjs <app url> <photo> <screenshot dir> <browser download dir>
// Run the app with IMAGE_PROVIDER=mock so no AI images are paid for.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { connect, sleep } from './cdp.mjs';
import { resolve } from 'node:path';
// Chrome needs absolute paths for uploads and downloads.
const [base, photo, shots, dl] = process.argv.slice(2).map((a, i) => (i === 0 ? a : resolve(a)));
mkdirSync(shots, { recursive: true });
const c = await connect();
const errors = [];
c.on((m) => {
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
await c.send('Runtime.enable');
await c.send('Page.enable');
await c.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' · ' + extra : ''}`); };
const shot = async (name) => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${shots}/${name}.png`, Buffer.from(r.data, 'base64')); };
const size = (w, h, mobile = false) => c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const ev = (js) => c.evaluate(js);
const click = (sel, text) => ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})]; const el = ${text ? `els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}))` : 'els[0]'}; if (!el) return false; el.click(); return true; })()`);
const noScroll = () => ev(`document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1`);
const rect = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const mouse = (type, x, y) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const move = (x, y) => c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
const typeInto = (sel, text) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const proto = i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const ideas = (scope) => ev(`[...document.querySelectorAll('${scope} .pbar-idea')].map(b => b.textContent.trim())`);
const waitFor = async (js, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(js)) return true; await sleep(100); } return false; };

await size(1280, 720);
// Wait for the new page to load: the tab may already show the same start screen.
const loaded = new Promise((r) => c.on((m) => m.method === 'Page.loadEventFired' && r()));
await c.send('Page.navigate', { url: base });
await loaded;
await waitFor(`!!document.querySelector('.drop-tile')`);
await sleep(400);
check('start screen fits 1280x720 without page scroll', await noScroll());
await shot('01-start');

// Upload the photo through the file input.
const { root } = await c.send('DOM.getDocument');
const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.drop-tile input[type=file]' });
await c.send('DOM.setFileInputFiles', { nodeId, files: [photo] });
check('studio opens after upload (Mark & edit)', await waitFor(`!!document.querySelector('.marking')`));
await sleep(300);
check('studio fits 1280x720 without page scroll', await noScroll());
const modes = await ev(`[...document.querySelectorAll('.mode-switch label')].map(l => l.textContent.trim())`);
check('mode switch shows both ways of working', modes.join('|') === 'Mark & edit|Standard', modes.join('|'));
const hint = () => ev(`document.querySelector('.foot-hint')?.textContent`);
check('hint asks for a part', (await hint()) === 'Pick the part to change, then mark it on the photo.', await hint());
check('no prompts before marking', await ev(`document.querySelectorAll('.prompt').length === 0`));
const parts = await ev(`[...document.querySelectorAll('.part')].map(p => p.textContent.trim())`);
check('kitchen part list', parts.length >= 8, parts.join(', '));
await shot('02-studio-empty');

// 1. Part
await click('.part', 'Base cabinets');
check('hint asks for the mark', (await hint()) === 'Mark the base cabinets on the photo.', await hint());
const banner = await ev(`document.querySelector('.mark-banner').textContent`);
check('banner names the part', banner.includes('Paint over the base cabinets'), banner);

// 2. Mark: a brush stroke over the lower cabinets.
const fr = await rect('.marking');
const at = (fx, fy) => [fr.x + fr.w * fx, fr.y + fr.h * fy];
async function stroke(y, x0 = 0.47, x1 = 0.87) {
  await mouse('mousePressed', ...at(x0, y));
  for (let i = 1; i <= 20; i++) await mouse('mouseMoved', ...at(x0 + ((x1 - x0) * i) / 20, y + (i % 2) * 0.03));
  await mouse('mouseReleased', ...at(x1, y));
  await move(...at(0.6, 0.6));
  await sleep(150);
}
await stroke(0.75);
const marked = await ev(`document.querySelector('.step-done')?.textContent ?? ''`);
check('brush stroke registers as a mark', marked.includes('Marked'), marked.trim());
check('brush cursor follows the pointer', await ev(`!!document.querySelector('.brush-cursor')`));

// 3. Prompts appear once marked
const prompts = await ev(`[...document.querySelectorAll('.prompt')].map(p => p.textContent.trim())`);
check('suggested prompts appear after marking', prompts.length >= 6, prompts.slice(0, 3).join(' | '));
check('first prompt reads as a change', prompts[0] === 'Sage green laminate, super-matte', prompts[0]);
check('hint says to click a change', (await hint()) === 'Click a change above to make it.', await hint());
check('each suggestion has an adjust button', (await ev(`document.querySelectorAll('.prompt-adjust').length`)) === prompts.length);

// Corners tool: four corners, then click the first one to close.
await click('.tool', 'Corners');
const corners = [at(0.45, 0.66), at(0.9, 0.66), at(0.9, 0.92), at(0.45, 0.92)];
for (const p of corners) { await mouse('mousePressed', ...p); await mouse('mouseReleased', ...p); await sleep(60); }
check('corners show while drawing', await ev(`document.querySelectorAll('.shape-dot').length`) === 4);
await sleep(400); // not a double-click
await mouse('mousePressed', ...corners[0]); await mouse('mouseReleased', ...corners[0]);
await sleep(150);
check('closing on the first corner adds a shape', await ev(`!document.querySelector('.shape-layer')`));
const marked2 = await ev(`document.querySelector('.step-done')?.textContent ?? ''`);
await shot('03-marked-prompts');

// Ctrl+Z takes back the shape and keeps the brush stroke.
await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', modifiers: 2, windowsVirtualKeyCode: 90 });
await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', modifiers: 2, windowsVirtualKeyCode: 90 });
await sleep(150);
const afterUndo = await ev(`document.querySelector('.step-done')?.textContent ?? ''`);
check('Ctrl+Z takes back the last stroke', afterUndo !== marked2 && afterUndo.includes('Marked'), afterUndo.trim());

// Click a prompt: the change is made straight away (mock AI returns the image unchanged after ~1-2 s).
await click('.prompt', 'Sage green laminate, super-matte');
check('loading card while the AI works', await waitFor(`!!document.querySelector('.loading-card')`, 2000));
await shot('04-loading');
check('compare view after the change', await waitFor(`!!document.querySelector('.compare')`, 15000));
await sleep(300);
let changes = await ev(`[...document.querySelectorAll('.changes li')].map(l => l.textContent.trim())`);
check('change listed with its finish', changes.length === 1 && changes[0].includes('Base cabinets') && changes[0].includes('Sage green · Laminate · Super-matte'), changes.join(' | '));
check('draft cleared after the change', (await hint()) === 'Pick the part to change, then mark it on the photo.');
check('part ticked as done', await ev(`!!document.querySelector('.part svg')`));
check('save note shown before download', await ev(`!!document.querySelector('.save-note')`));
check('studio still fits after a change', await noScroll());
await shot('05-compare');

// Undo brings the change back into the panel.
await click('.stage-actions .btn', 'Undo');
await sleep(200);
check('undo removes the change', await ev(`document.querySelectorAll('.changes li').length`) === 0);
check('undo restores the part and mark', (await ev(`document.querySelector('.part[aria-checked="true"]')?.textContent`)) === 'Base cabinets' && (await ev(`!!document.querySelector('.step-done')`)));
check('undo returns to mark view', await ev(`!!document.querySelector('.marking')`));

// Adjust a suggestion: it opens in Custom finish, ready to change and add details.
await click('.prompt-adjust');
check('adjust opens the suggestion in Custom finish', (await ev(`document.querySelector('.custom.open .step-value')?.textContent`)) === 'Sage green · Laminate · Super-matte');
await click('.custom .opt', 'Acrylic');
await click('.custom .sw[aria-label="Navy blue"]');
const customValue = await ev(`document.querySelector('.custom .step-value')?.textContent`);
check('custom finish summary', customValue === 'Navy blue · Acrylic · High gloss', customValue);
// Details with AI help: empty bar = ideas for this finish.
check('details bar in Custom finish', await ev(`!!document.querySelector('#custom-details')`));
await click('.custom .pbar-ai');
check('AI help suggests details', await waitFor(`document.querySelectorAll('.custom .pbar-idea').length === 3`, 5000), (await ideas('.custom')).join(' | '));
// Scroll only the panel (scrollIntoView would also move the app shell).
await ev(`(() => { const b = document.querySelector('.panel-body'); const p = document.querySelector('.custom .pbar'); b.scrollTop += p.getBoundingClientRect().top - b.getBoundingClientRect().top - 180; return true; })()`);
check('panel has no sideways scroll', await ev(`[...document.querySelectorAll('.panel-body')].every(b => b.scrollWidth <= b.clientWidth + 1)`));
await shot('03b-ai-help');
const idea = (await ideas('.custom'))[0];
await click('.custom .pbar-idea');
check('picking an idea fills the bar', (await ev(`document.querySelector('#custom-details').value`)) === idea && (await ev(`document.querySelectorAll('.custom .pbar-idea').length === 0`)), idea);
check('details show in the finish summary', ((await ev(`document.querySelector('.custom .step-value')?.textContent`)) ?? '').includes('“'));
await click('.custom .btn', 'Apply custom finish');
check('custom finish applied', await waitFor(`document.querySelectorAll('.changes li').length === 1 && !document.querySelector('.loading-card')`, 15000));
const withDetails = await ev(`document.querySelector('.changes li').textContent`);
check('change keeps its details', withDetails.includes('Navy blue · Acrylic · High gloss · “'), withDetails);

// Own words, without picking a part.
await click('.view-toggle label', 'Mark');
await click('.tool', 'Brush');
await stroke(0.5, 0.3, 0.6);
check('own-words box shown without a part', await ev(`!!document.querySelector('#own-words')`));
await typeInto('#own-words', 'remove the bottles from the counter');
await click('.own-words .pbar-ai');
check('AI help rewrites own words', await waitFor(`document.querySelectorAll('.own-words .pbar-idea').length === 3`, 5000), (await ideas('.own-words')).join(' | '));
await click('.own-words .pbar-idea');
check('picked rewrite in the bar', (await ev(`document.querySelector('#own-words').value`)) === 'Remove the bottles from the counter');
await click('.own-words .pbar-go');
check('own words applied as a second change', await waitFor(`document.querySelectorAll('.changes li').length === 2 && !document.querySelector('.loading-card')`, 15000));
changes = await ev(`[...document.querySelectorAll('.changes li')].map(l => l.textContent.trim())`);
check('own-words change listed', changes[1]?.includes('Marked area') && changes[1]?.includes('Remove the bottles'), changes[1]);
await click('.stage-actions .btn', 'Try again');
check('try again shows loading', await waitFor(`!!document.querySelector('.loading-card')`, 2000));
check('try again replaces the last change', await waitFor(`!document.querySelector('.loading-card') && document.querySelectorAll('.changes li').length === 2`, 15000));
await sleep(300);
await shot('06-two-changes');

// Item from a photo ("put this sofa here"): mark where it goes, attach the photo, place it.
await click('.view-toggle label', 'Mark');
await stroke(0.85, 0.1, 0.3);
check('item photo button once marked', await ev(`!!document.querySelector('.attach input[type=file]')`));
{
  const { root: r2 } = await c.send('DOM.getDocument');
  const { nodeId: n2 } = await c.send('DOM.querySelector', { nodeId: r2.nodeId, selector: '.attach input[type=file]' });
  await c.send('DOM.setFileInputFiles', { nodeId: n2, files: [photo] });
}
check('item photo attached', await waitFor(`!!document.querySelector('.attached img')`, 3000));
check('place works without words', await ev(`!document.querySelector('.own-words .pbar-go').disabled`));
await shot('06b-item-photo');
await click('.own-words .pbar-go');
check('item loading text', await waitFor(`document.querySelector('.loading-card strong')?.textContent === 'Putting the item from your photo in place…'`, 2000));
check('item placed as a change', await waitFor(`document.querySelectorAll('.changes li').length === 3 && !document.querySelector('.loading-card')`, 15000));
const itemChange = await ev(`document.querySelectorAll('.changes li')[2].textContent`);
check('item change listed', itemChange.includes('Item from photo') && itemChange.includes('Placed from the photo'), itemChange);
await click('.stage-actions .btn', 'Undo');
await sleep(200);
check('undo brings the item photo back', (await ev(`!!document.querySelector('.attached img')`)) && (await ev(`document.querySelectorAll('.changes li').length`)) === 2);
await click('.attached .link', 'Remove');
check('item photo removed', await ev(`!document.querySelector('.attached')`));

// Download the edited image.
await click('.stage-actions .btn', 'Download');
await sleep(800);
let files = readdirSync(dl).filter((f) => f.startsWith('euc-kitchen-2-changes'));
check('edited image downloaded', files.length >= 1, files.join(', '));
check('save note gone after download', await ev(`!document.querySelector('.save-note')`));

// Final 2K
await click('.stage-actions .btn-accent', 'Final 2K image');
const loadingText = (await waitFor(`!!document.querySelector('.loading-card')`, 2000)) && (await ev(`document.querySelector('.loading-card strong').textContent`));
check('final shows its own loading text', loadingText === 'Making the final 2K image…', loadingText);
check('final view after the 2K pass', await waitFor(`!!document.querySelector('.compare') && [...document.querySelectorAll('.stage-actions .btn')].some(b => b.textContent.includes('Download 2K'))`, 15000));
const finalTag = await ev(`document.querySelector('.compare .tag-right').textContent`);
check('final tag shows the real size', /^Final · \d+×\d+$/.test(finalTag), finalTag);
check('Final 2K in the view toggle', await ev(`[...document.querySelectorAll('.view-toggle label')].some(l => l.textContent.includes('Final 2K'))`));
await shot('07-final');
await click('.stage-actions .btn', 'Download 2K');
await sleep(800);
files = readdirSync(dl).filter((f) => f.startsWith('euc-kitchen-final-2k'));
check('final 2K downloaded', files.length >= 1, files.join(', '));
await click('.stage-actions .btn', 'Back to editing');
check('back to editing', await ev(`!!document.querySelector('.marking')`));
check('final button now opens the final image', await ev(`[...document.querySelectorAll('.stage-actions .btn')].some(b => b.textContent.includes('View final 2K'))`));

// ---------------------------------------------------------------- Standard
await click('.mode-switch label', 'Standard');
await sleep(200);
check('standard panel: options, tabs, generate', await ev(`!!document.querySelector('.variants') && !!document.querySelector('.tabs') && !!document.querySelector('.panel-foot .btn-accent')`));
check('render toggle shown in Standard', await ev(`!!document.querySelector('.source .segmented')`));
check('generate disabled with no changes', await ev(`document.querySelector('.panel-foot .btn-accent').disabled`));
check('standard fits 1280x720', await noScroll());
await click('.el-head', 'Base cabinets');
await click('.el-body .opt', 'Laminate');
await click('.el-body .sw[aria-label="Sage green"]');
const elValue = await ev(`document.querySelector('.el.changed .el-value')?.textContent`);
check('part spec shown in the list', elValue === 'Sage green · Laminate · Matte', elValue);
check('details bar in the part editor', await ev(`!!document.querySelector('.el-body .pbar input')`));
await typeInto('.el-body .pbar input', 'gold edge on top');
await click('.el-body .pbar-ai');
check('AI help in Standard', await waitFor(`document.querySelectorAll('.el-body .pbar-idea').length === 3`, 5000));
await click('.el-body .pbar-idea');
const elWithDetails = await ev(`document.querySelector('.el.changed .el-value')?.textContent`);
check('part details in the spec', elWithDetails === 'Sage green · Laminate · Matte · “Gold edge on top”', elWithDetails);
await click('.variant-add');
await click('.el-body .sw[aria-label="Navy blue"]');
check('two options', await ev(`document.querySelectorAll('.variant').length`) === 2);
const genLabel = await ev(`document.querySelector('.panel-foot .btn-accent').textContent.trim()`);
check('generate label counts options', genLabel === 'Generate 2 options', genLabel);
await shot('08-standard');
await click('.panel-foot .btn-accent');
check('standard loading card', await waitFor(`!!document.querySelector('.loading-card')`, 2000));
check('standard design added on top', await waitFor(`!document.querySelector('.loading-card') && document.querySelectorAll('.changes li').length === 3`, 15000));
check('option letters to switch', (await ev(`document.querySelectorAll('.choose-opt').length`)) === 2);
await click('.choose-opt', 'B');
check('option B chosen', await ev(`document.querySelector('.choose-opt[aria-checked="true"]').textContent === 'B'`));
check('replace note in Standard foot', ((await hint()) ?? '').startsWith('Replaces the last Standard design'), await hint());
check('final is stale after a new change', await ev(`[...document.querySelectorAll('.stage-actions .btn')].some(b => b.textContent.includes('Final 2K image'))`));
await shot('09-standard-result');
await click('.panel-foot .btn-accent');
check('generate again replaces the design', await waitFor(`!document.querySelector('.loading-card') && document.querySelectorAll('.changes li').length === 3`, 15000));
await click('.stage-actions .btn', 'Undo');
await sleep(200);
check('undo of a design brings its spec back', (await ev(`document.querySelectorAll('.changes li').length`)) === 2 && (await ev(`document.querySelectorAll('.variant').length`)) === 2);

// Only one: pick a place on the image. (The part may still be open from before.)
if (!(await ev(`!!document.querySelector('.el.open')`))) await click('.el-head', 'Base cabinets');
await click('.el-body .opt', 'Only one: pick on image');
check('pick banner shows', await waitFor(`!!document.querySelector('.pick-banner')`, 1000));
const pr = await rect('.pick-surface');
await mouse('mousePressed', pr.x + pr.w * 0.7, pr.y + pr.h * 0.8); await mouse('mouseReleased', pr.x + pr.w * 0.7, pr.y + pr.h * 0.8);
await sleep(150);
check('marker placed', await ev(`!!document.querySelector('.marker')`));

// Designer's note with AI help.
await click('.tab', 'Light & extras');
await click('.notes .pbar-ai');
check('AI help ideas for the note', await waitFor(`document.querySelectorAll('.notes .pbar-idea').length === 3`, 5000));
await click('.notes .pbar-idea');
check('note filled from an idea', ((await ev(`document.querySelector('#designer-note').value`)) ?? '').length > 10);
await shot('09b-standard-note');

// Back to Mark & edit keeps the stack.
await click('.mode-switch label', 'Mark & edit');
check('mark mode again, stack kept', (await ev(`!!document.querySelector('.marking')`)) && (await ev(`document.querySelectorAll('.changes li').length`)) === 2);

// Larger desktop and phone
await size(1920, 960);
await sleep(400);
check('studio fits 1920x960 without page scroll', await noScroll());
await shot('10-1920');
await size(390, 844, true);
await sleep(400);
check('phone: no sideways scroll', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`));
await shot('11-phone');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 2000, deviceScaleFactor: 1, mobile: true });
await sleep(300);
await shot('12-phone-full');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
c.close();
