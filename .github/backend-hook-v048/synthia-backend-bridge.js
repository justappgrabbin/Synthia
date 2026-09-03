(() => {
  "use strict";
  const BASE = "http://127.0.0.1:3000";
  const UI = `${BASE}/studio/apps/mobile-linux/`;
  const SERVER_ORIGIN = location.origin === BASE;
  let promoting = false;
  let timer = null;

  async function request(path, options = {}) {
    const target = /^https?:\/\//i.test(path) ? path : `${BASE}${String(path).startsWith("/") ? path : `/${path}`}`;
    return fetch(target, { cache: "no-store", ...options });
  }

  async function health() {
    try {
      const response = await request("/health");
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function announce(connected) {
    document.documentElement.dataset.synthiaBackend = connected ? "connected" : "starting";
    dispatchEvent(new CustomEvent("synthia:backend", { detail: { connected, base: BASE, ui: UI } }));
  }

  async function promoteToServer() {
    if (SERVER_ORIGIN) {
      announce(true);
      if (timer) clearInterval(timer);
      return true;
    }
    const ready = await health();
    announce(ready);
    if (ready && location.protocol === "file:" && !promoting) {
      promoting = true;
      location.replace(UI);
    }
    return ready;
  }

  window.SynthiaBackend = Object.freeze({ base: BASE, ui: UI, request, health, promoteToServer, serverOrigin: SERVER_ORIGIN });
  window.synthiaCheck = promoteToServer;
  promoteToServer();
  if (!SERVER_ORIGIN) timer = setInterval(promoteToServer, 2500);
})();
