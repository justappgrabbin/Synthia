(() => {
  'use strict';
  // v0.4.8: notification UI belongs to the tray app in synthia-local.js.
  // Keep a tiny compatibility surface for older code without injecting floating UI.
  window.SynthiaSyncConnector = Object.freeze({
    version: '0.4.8',
    base: location.protocol === 'file:' ? 'http://127.0.0.1:3000' : '',
    async request(path, options = {}) {
      const response = await fetch(this.base + path, {
        cache: 'no-store',
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) throw new Error(body.error || `Synthia sync request failed (${response.status})`);
      return body;
    }
  });
})();
