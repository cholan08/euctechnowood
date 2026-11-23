// Minimal Chrome DevTools Protocol client (Node 22 has WebSocket built in).
// Usage: const page = await connect(); await page.evaluate('document.title');
export async function connect(port = 9333) {
  const targets = await (await fetch(`http://localhost:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else {
      // Accept "Leave page?" and other dialogs, so a page with undownloaded results can't block navigation.
      if (msg.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      listeners.forEach((l) => l(msg));
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  return { send, evaluate, on: (f) => listeners.push(f), close: () => ws.close() };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
