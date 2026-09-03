(() => {
  'use strict';
  // v0.4.7.2: infrastructure only. UI is registered in the OS app tray.
  const base = location.protocol === 'file:' ? 'http://127.0.0.1:3000' : '';
  async function request(path, options = {}) {
    const response = await fetch(base + path, {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Synthia request failed (${response.status})`);
    return body;
  }
  window.SynthiaSyncConnector = Object.freeze({ version: '0.4.7.2', base, request });
})();
