(() => {
  "use strict";
  const POLL_MS = 30000;
  let notices = [];
  let rpcBusy = false;

  async function local(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Synthia local request failed (${response.status})`);
    return body;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function install() {
    if (document.getElementById("synthia-admin-button")) return;
    const style = document.createElement("style");
    style.textContent = `
      #synthia-admin-button{position:fixed;right:12px;top:12px;z-index:2147483000;width:42px;height:42px;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:#211629;color:#fff;box-shadow:0 9px 26px rgba(0,0,0,.35);font:700 17px system-ui}
      #synthia-inbox-badge{position:absolute;right:-5px;top:-6px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#ec4899;color:#fff;font:700 11px/19px system-ui;text-align:center}
      #synthia-inbox{position:fixed;right:12px;top:62px;z-index:2147483001;display:none;width:min(420px,calc(100vw - 24px));max-height:min(72vh,650px);overflow:auto;border:1px solid #3d2b4a;border-radius:18px;background:#120d17;color:#f7eef9;box-shadow:0 20px 60px rgba(0,0,0,.55);font-family:system-ui}
      #synthia-inbox.open{display:block}
      .synthia-inbox-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px 14px 11px;background:#120d17;border-bottom:1px solid #2f2238}.synthia-inbox-head h2{font-size:16px;margin:0}.synthia-inbox-head small{display:block;margin-top:2px;color:#96879e;font-size:10px}.synthia-inbox-head button,.synthia-action{border:0;border-radius:10px;padding:9px 12px;background:#2a2031;color:#f7eef9;font-weight:650}
      #synthia-inbox-content{padding:8px 12px 14px}.synthia-card{margin:8px 0;padding:12px;border:1px solid #392b43;border-radius:14px;background:#1a1320}.synthia-card h3{font-size:14px;margin:0 0 6px}.synthia-card p{font-size:12px;line-height:1.4;color:#cbbfd0;margin:0 0 10px}.synthia-meta{font-size:10px;color:#918398;margin-bottom:9px}.synthia-actions{display:flex;gap:8px}.synthia-action.approve{background:#8b5cf6;color:#fff}.synthia-action.reject{background:#302331;color:#f6a8bd}.synthia-empty{padding:30px 10px;text-align:center;color:#9d90a4}.synthia-error{margin:8px 12px;padding:10px;border-radius:12px;background:#351823;color:#ffb1c2;font-size:12px}.synthia-syncline{padding:8px 14px;color:#8f8198;font-size:10px;border-bottom:1px solid #241a2b}
    `;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.id = "synthia-admin-button";
    button.setAttribute("aria-label", "Open Synthia Admin Inbox");
    button.innerHTML = `⚙<span id="synthia-inbox-badge" hidden></span>`;
    document.body.appendChild(button);

    const inbox = document.createElement("section");
    inbox.id = "synthia-inbox";
    inbox.innerHTML = `<div class="synthia-inbox-head"><div><h2>Admin · Inbox</h2><small>Connections, Synthia changes, and sync</small></div><button id="synthia-inbox-close">Close</button></div><div id="synthia-syncline" class="synthia-syncline">Checking Synthia…</div><div id="synthia-inbox-content"><div class="synthia-empty">Checking for requests…</div></div>`;
    document.body.appendChild(inbox);

    button.onclick = () => { inbox.classList.toggle("open"); if (inbox.classList.contains("open")) refresh(true); };
    document.getElementById("synthia-inbox-close").onclick = () => inbox.classList.remove("open");
    document.addEventListener("click", e => { if (!inbox.contains(e.target) && e.target !== button && !button.contains(e.target)) inbox.classList.remove("open"); });

    refresh(true);
    setInterval(() => { if (!document.hidden && navigator.onLine) refresh(false); }, POLL_MS);
    addEventListener("online", () => refresh(true));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(true); });
  }

  function render(error) {
    const badge = document.getElementById("synthia-inbox-badge");
    if (badge) { badge.hidden = notices.length === 0; badge.textContent = notices.length > 99 ? "99+" : String(notices.length); }
    const content = document.getElementById("synthia-inbox-content");
    if (!content) return;
    if (error) { content.innerHTML = `<div class="synthia-error">${escapeHtml(error.message || error)}</div>`; return; }
    if (!notices.length) { content.innerHTML = '<div class="synthia-empty">Nothing waiting.</div>'; return; }
    content.innerHTML = notices.map(n => {
      const actionable = n.notification_type === "connection.requested" || n.notification_type === "change.approval_requested";
      return `<article class="synthia-card" data-id="${n.notification_id}"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p><div class="synthia-meta">${new Date(n.created_at).toLocaleString()}</div>${actionable ? `<div class="synthia-actions"><button class="synthia-action approve" data-decision="approved">Approve</button><button class="synthia-action reject" data-decision="rejected">Reject</button></div>` : `<button class="synthia-action" data-read="true">Mark read</button>`}</article>`;
    }).join("");
    content.querySelectorAll("[data-decision]").forEach(btn => btn.addEventListener("click", decide));
    content.querySelectorAll("[data-read]").forEach(btn => btn.addEventListener("click", markRead));
  }

  async function refresh(forcePoll) {
    if (rpcBusy) return;
    rpcBusy = true;
    try {
      if (forcePoll) await local("/sync/poll", { method: "POST", body: "{}" });
      const [notifications, status] = await Promise.all([local("/sync/notifications"), local("/sync/status")]);
      notices = notifications.notifications || [];
      const line = document.getElementById("synthia-syncline");
      if (line) line.textContent = status.connected ? `Synced · workspace ${status.last_seen_version ?? 0}${status.last_error ? ` · ${status.last_error}` : ""}` : `Offline${status.last_error ? ` · ${status.last_error}` : ""}`;
      render();
    } catch (error) { render(error); }
    finally { rpcBusy = false; }
  }

  async function decide(event) {
    const card = event.currentTarget.closest(".synthia-card");
    const notice = notices.find(n => String(n.notification_id) === card.dataset.id);
    if (!notice) return;
    card.querySelectorAll("button").forEach(b => b.disabled = true);
    try {
      await local("/sync/decision", { method: "POST", body: JSON.stringify({ notification: notice, decision: event.currentTarget.dataset.decision }) });
      await refresh(true);
    } catch (error) { render(error); }
  }

  async function markRead(event) {
    const card = event.currentTarget.closest(".synthia-card");
    const notice = notices.find(n => String(n.notification_id) === card.dataset.id);
    if (!notice) return;
    try { await local("/sync/mark-read", { method: "POST", body: JSON.stringify({ notification_id: notice.notification_id }) }); await refresh(false); }
    catch (error) { render(error); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
