// Notifications : cloche dans l'en-tête, alertes en temps réel et notifications du téléphone (Web Push).
// Chargé automatiquement par js/layout.js (pages publiques) et js/admin.js (administration).
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CFG = window.BSL_CONFIG || {};
  const S = { uid: null, items: [], seenAt: 0, pushOn: false, panel: null, btn: null };

  const CSS = `
.bellbtn{position:relative;display:inline-grid;place-items:center;width:40px;height:36px;padding:0;border-radius:10px;border:1px solid var(--bd);background:var(--bg2);color:var(--tx);cursor:pointer;flex:0 0 auto}
.bellbadge{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--ko);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;line-height:1}
.bellbadge[hidden]{display:none}
.bellpanel{position:fixed;right:10px;z-index:61;width:min(360px,calc(100vw - 20px));max-height:72vh;display:flex;flex-direction:column;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.bellpanel[hidden]{display:none}
.bp-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--bd)}
.bp-head button{border:0;background:none;color:var(--pr);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.bp-list{overflow-y:auto;flex:1}
.bp-item{display:block;padding:11px 14px;border-bottom:1px solid var(--bd);color:inherit;text-decoration:none}
.bp-item.unread{background:color-mix(in srgb,var(--pr) 12%,var(--bg))}
.bp-item b{display:block;font-size:14px}
.bp-item span{display:block;font-size:13px;color:var(--mu);margin-top:2px;word-break:break-word}
.bp-item small{display:block;font-size:12px;color:var(--mu);margin-top:3px}
.bp-empty{padding:24px 14px;text-align:center;color:var(--mu);font-size:14px}
.bp-foot{padding:10px 14px;border-top:1px solid var(--bd);font-size:13px;color:var(--mu)}
.bp-foot button{display:block;width:100%;margin-top:6px;padding:9px;border:0;border-radius:10px;background:var(--pr);color:var(--on-pr);font:inherit;font-weight:700;cursor:pointer}
.bp-foot button.ghost{background:var(--bg2);color:var(--tx);border:1px solid var(--bd)}`;

  /* ---------- Notifications du téléphone (Web Push) ---------- */
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const toU8 = b64 => {
    const p = "=".repeat((4 - (b64.length % 4)) % 4), raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  };
  async function status() {
    if (!supported()) return "unsupported";
    if (!CFG.VAPID_PUBLIC_KEY) return "unconfigured";
    if (Notification.permission === "denied") return "denied";
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub && Notification.permission === "granted" ? "on" : "off";
  }
  async function enable() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return perm;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toU8(CFG.VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 200) });
    if (error) throw error;
    S.pushOn = true;
    return "granted";
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    S.pushOn = false;
  }
  window.BSLNotif = { supported, status, enable, disable };

  /* ---------- Cloche ---------- */
  const ago = d => {
    const m = Math.round((Date.now() - new Date(d)) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return "il y a " + m + " min";
    if (m < 1440) return "il y a " + Math.round(m / 60) + " h";
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };
  const unread = () => S.items.filter(n => new Date(n.created_at).getTime() > S.seenAt).length;

  function badge() {
    const b = $("#bellCount"), n = unread();
    if (b) { b.textContent = n > 99 ? "99+" : n; b.hidden = !n; }
  }
  function drawList() {
    const el = $("#bpList");
    if (!el) return;
    el.innerHTML = S.items.length ? S.items.map(n => `<a class="bp-item ${new Date(n.created_at).getTime() > S.seenAt ? "unread" : ""}" href="${esc(n.url || "index.html")}">
      <b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<small>${ago(n.created_at)}</small></a>`).join("")
      : '<div class="bp-empty">Aucune notification pour le moment.</div>';
  }
  async function drawFoot() {
    const f = $("#bpFoot");
    if (!f) return;
    const st = await status();
    const iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) ? " Sur iPhone, installez d'abord l'application sur l'écran d'accueil." : "";
    const html = {
      unsupported: "Ce navigateur ne gère pas les notifications du téléphone." + iosHint,
      unconfigured: "",
      denied: "Notifications bloquées. Autorisez-les dans les réglages du navigateur pour ce site.",
      off: 'Recevez les alertes sur l\'écran de votre téléphone.<button id="bpOn">Activer les notifications</button>',
      on: 'Notifications du téléphone activées.<button id="bpOff" class="ghost">Désactiver sur cet appareil</button>',
    }[st];
    f.hidden = !html;
    f.innerHTML = html || "";
    const on = $("#bpOn"), off = $("#bpOff");
    if (on) on.onclick = async () => { try { await enable(); } catch (e) { toast("Activation impossible : " + (e.message || "réessayez")); } drawFoot(); };
    if (off) off.onclick = async () => { await disable(); drawFoot(); };
  }
  function toast(msg) {
    if (window.BSL && BSL.toast) BSL.toast(msg);
    else if (window.ADM && ADM.toast) ADM.toast(msg);
  }

  async function markRead() {
    S.seenAt = Date.now();
    badge(); drawList();
    await sb.from("notification_reads").upsert({ user_id: S.uid, seen_at: new Date().toISOString() });
  }
  function togglePanel(force) {
    const p = S.panel;
    const open = force !== undefined ? force : p.hidden;
    if (open) { p.style.top = (S.btn.getBoundingClientRect().bottom + 8) + "px"; drawFoot(); }
    p.hidden = !open;
    if (open && unread()) setTimeout(markRead, 1500);      // lues après un court instant d'affichage
  }

  function build(host) {
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const b = document.createElement("button");
    b.className = "bellbtn"; b.id = "bellBtn"; b.type = "button"; b.setAttribute("aria-label", "Notifications");
    b.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="bellbadge" id="bellCount" hidden>0</span>';
    host.before(b);
    const p = document.createElement("div");
    p.className = "bellpanel"; p.hidden = true;
    p.innerHTML = '<div class="bp-head"><b>Notifications</b><button type="button" id="bpRead">Tout marquer comme lu</button></div><div class="bp-list" id="bpList"></div><div class="bp-foot" id="bpFoot" hidden></div>';
    document.body.appendChild(p);
    S.btn = b; S.panel = p;
    b.onclick = e => { e.stopPropagation(); togglePanel(); };
    $("#bpRead").onclick = markRead;
    document.addEventListener("click", e => { if (!p.hidden && !p.contains(e.target) && !b.contains(e.target)) togglePanel(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") togglePanel(false); });
  }

  async function load() {
    const [list, seen] = await Promise.all([
      sb.from("notifications").select("id,kind,title,body,url,created_at").order("created_at", { ascending: false }).limit(30),
      sb.from("notification_reads").select("seen_at").eq("user_id", S.uid).maybeSingle(),
    ]);
    S.items = list.data || [];
    if (seen.data) S.seenAt = new Date(seen.data.seen_at).getTime();
    else { S.seenAt = Date.now(); sb.from("notification_reads").upsert({ user_id: S.uid, seen_at: new Date().toISOString() }); }   // première fois : l'historique n'est pas "non lu"
    badge(); drawList();
  }

  function realtime() {
    sb.channel("bsl-notifs-" + S.uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, p => {
        const n = p.new;
        S.items.unshift(n); S.items = S.items.slice(0, 30);
        badge(); drawList();
        toast(n.title + (n.body ? " : " + n.body : ""));
        // Application en arrière-plan et pas d'abonnement push : alerte locale
        if (document.hidden && !S.pushOn && "Notification" in window && Notification.permission === "granted") {
          navigator.serviceWorker.getRegistration().then(reg => reg && reg.showNotification(n.title, {
            body: n.body || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: n.kind, data: { url: n.url || "index.html" } }));
        }
      })
      .subscribe();
  }
  /* ---------- Invitation automatique à activer les notifications ---------- */
  async function invite() {
    try {
      if ((await status()) !== "off") return;
      if (Date.now() < +(localStorage.getItem("bsl-invite-until") || 0)) return;
    } catch (e) { return; }
    const iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
    if (iosHint) return;   // iPhone : l'appli doit d'abord être installée sur l'écran d'accueil
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:70;max-width:420px;margin:auto;padding:14px;border-radius:16px;background:var(--bg);color:var(--tx);border:1px solid var(--bd);box-shadow:var(--shadow);font-size:14px";
    d.innerHTML = '<b>Restez informé</b><div style="margin:4px 0 10px;color:var(--mu)">Recevez promotions, nouveautés et messages directement sur votre téléphone.</div>' +
      '<div style="display:flex;gap:8px"><button id="invOn" style="flex:1;padding:10px;border:0;border-radius:10px;background:var(--pr);color:var(--on-pr);font:inherit;font-weight:700">Activer</button>' +
      '<button id="invLater" style="padding:10px 14px;border-radius:10px;border:1px solid var(--bd);background:var(--bg2);color:var(--tx);font:inherit">Plus tard</button></div>';
    document.body.appendChild(d);
    d.querySelector("#invLater").onclick = () => {
      localStorage.setItem("bsl-invite-until", Date.now() + 3 * 864e5); d.remove();
    };
    d.querySelector("#invOn").onclick = async () => {
      try { await enable(); toast("Notifications activées"); } catch (e) { toast("Activation impossible : " + (e.message || "réessayez")); }
      d.remove();
    };
        }
  const waitFor = (fn, ms) => new Promise(res => {
    const t0 = Date.now();
    (function tick() { const v = fn(); if (v || Date.now() - t0 > ms) return res(v); setTimeout(tick, 200); })();
  });

  (async function start() {
    if (!window.sb) return;
    const { data } = await sb.auth.getSession();
    if (!data.session) return;                           // visiteur : pas de notifications
    S.uid = data.session.user.id;
    const host = await waitFor(() => $(".topbar .container [data-theme-btn]"), 8000);
    if (!host) return;
    build(host);
    S.pushOn = (await status()) === "on";
    await load();
    realtime();
  })();
})();
