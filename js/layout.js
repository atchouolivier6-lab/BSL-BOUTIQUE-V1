// Partagé par toutes les pages. Charge APRÈS config.js et supabase.js
// Attend dans la page : <div id="header"></div> ... <div id="footer"></div>
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const B = (window.BSL = {
    esc,
    fmt: n => Number(n).toLocaleString("fr-FR") + " FCFA",
    user: null, profile: null, isStaff: false, isAdmin: false,
    shop: {}, pendingUrl: null,
  });

  /* ---------- Données ---------- */
  async function loadShop() {
    try {
      const r = await sb.from("settings").select("value").eq("key", "shop").single();
      if (r.data) B.shop = r.data.value;
    } catch (e) {}
  }
  async function refresh() {
    const { data } = await sb.auth.getSession();
    B.user = data.session ? data.session.user : null;
    B.profile = null;
    if (B.user) {
      const r = await sb.from("profiles").select("first_name,last_name,role").eq("id", B.user.id).single();
      B.profile = r.data || null;
    }
    B.isStaff = !!B.profile && ["staff", "admin"].includes(B.profile.role);
    B.isAdmin = !!B.profile && B.profile.role === "admin";
  }

  /* ---------- En-tête / pied de page ---------- */
  function renderHeader() {
    const logo = B.shop.logo_shop
      ? `<img src="${esc(B.shop.logo_shop)}" alt="Logo" onerror="this.outerHTML='<span class=mono>BSL</span>'">`
      : '<span class="mono">BSL</span>';
    $("#header").innerHTML =
      `<header class="topbar"><div class="container">
        <a class="brand" href="index.html">${logo}<span class="name">BSL Zénith</span></a>
        <span class="spacer"></span>
        <button class="btn ghost sm" data-theme-btn aria-label="Changer le thème">🌙</button>
        <span id="authzone"></span>
      </div>
      <nav class="mainnav"><div class="container" id="navzone"></div></nav></header>`;
    renderAuthZone();
    BSLTheme.init();
  }
  function renderNav() {
    const z = $("#navzone");
    if (!z) return;
    const file = location.pathname.split("/").pop() || "index.html";
    const f = new URLSearchParams(location.search).get("f") || "";
    const items = [
      ["index.html", "", " Accueil"],
      ["catalogue.html", "", "🛍️ Catalogue"],
      ["catalogue.html", "new", "🆕 Nouveautés"],
      ["catalogue.html", "promo", "🏷️ Promotions"],
    ];
    if (B.user) items.push(["catalogue.html", "fav", "⭐ Favoris"]);
    z.innerHTML = items.map(([pg, flt, label]) =>
      `<a href="${pg}${flt ? "?f=" + flt : ""}" class="${file === pg && f === flt ? "on" : ""}">${label}</a>`).join("");
  }
  function renderAuthZone() {
    renderNav();
    const z = $("#authzone");
    if (!z) return;
    if (!B.user) {
      z.innerHTML = `<button class="btn sm" onclick="BSL.openAuth('signup')">S'inscrire</button>
                     <button class="btn ghost sm" onclick="BSL.openAuth('login')">Connexion</button>`;
    } else {
      const name = B.profile && B.profile.first_name ? B.profile.first_name : "";
      z.innerHTML = `<span class="hi muted">Bonjour ${esc(name)}</span>
        ${B.isStaff ? '<a class="btn ghost sm" href="admin/index.html">Admin</a>' : ""}
        <button class="btn ghost sm" onclick="BSL.logout()">Déconnexion</button>`;
    }
  }
  const TT = "M15.2 8v11.2a3.4 3.4 0 1 1-3.4-3.4M15.2 8c.4 2.6 2 4.2 4.6 4.5";
  const ICONS = {
    facebook: '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#1877F2"/><path d="M17.5 26v-8.2h2.8l.5-3.3h-3.3v-2.1c0-.9.4-1.7 1.8-1.7h1.6V7.9c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.6h-2.7v3.3h2.7V26z" fill="#fff"/></svg>',
    tiktok: `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#000"/><g fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${TT}" stroke="#25F4EE" transform="translate(-.9 -.6)"/><path d="${TT}" stroke="#FE2C55" transform="translate(.9 .6)"/><path d="${TT}" stroke="#fff"/></g></svg>`,
    whatsapp: '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#25D366"/><path d="M16 7.5a8.5 8.5 0 0 0-7.3 12.8L7.6 24.5l4.3-1.1A8.5 8.5 0 1 0 16 7.5z" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/><path d="M12.9 12.2c-.3.5-.3 1.2.1 2 .9 1.8 2.3 3.1 4.2 3.9.8.3 1.4.2 1.8-.2l.4-.6c.1-.2.1-.4-.1-.5l-1.3-.8c-.2-.1-.4-.1-.5.1l-.3.4c-.8-.3-1.5-1-1.8-1.8l.4-.3c.2-.1.2-.3.1-.5l-.7-1.3c-.1-.2-.3-.2-.5-.1z" fill="#fff"/></svg>',
  };
  function soc(url, key, label) {
    return url ? `<a class="soc" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}">${ICONS[key]}<span>${label}</span></a>` : "";
  }
  function renderFooter() {
    const s = B.shop, f = $("#footer");
    if (!f) return;
    const phones = (s.phones || []).map(esc).join(" / ");
    f.innerHTML = `<footer class="site"><div class="container">
      <b>${esc(s.name || "BSL La Puissance Zénith")}</b><br>
       ${esc(s.address || "")}<br>🕒 ${esc(s.hours || "")}<br>📞 ${phones}<br>
      <div class="socials">${soc(s.facebook, "facebook", "Facebook")}${soc(s.tiktok, "tiktok", "TikTok")}${soc(s.whatsapp_link, "whatsapp", "WhatsApp")}</div>
    </div></footer>`;
  }

  /* ---------- Fenêtre inscription / connexion ---------- */
  function buildModal() {
    const m = document.createElement("div");
    m.className = "modal"; m.id = "authModal"; m.hidden = true;
    m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">
      <button class="x" aria-label="Fermer" onclick="BSL.closeAuth()">✕</button>
      <h2 id="amTitle"></h2>
      <p id="amInfo" class="msg" hidden></p>
      <div class="tabs">
        <button type="button" id="tSignup" onclick="BSL.openAuth('signup')">Inscription</button>
        <button type="button" id="tLogin" onclick="BSL.openAuth('login')">Connexion</button>
      </div>
      <p id="amErr" class="msg err" hidden></p>

      <form id="fSignup" onsubmit="BSL.signup(event)">
        <div class="row2">
          <label>Prénom<input name="first" required autocomplete="given-name"></label>
          <label>Nom<input name="last" required autocomplete="family-name"></label>
        </div>
        <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
        <label>Mot de passe (6 caractères minimum)<input name="pass" type="password" minlength="6" required autocomplete="new-password"></label>
        <button class="btn" type="submit">Créer mon compte</button>
      </form>

      <form id="fLogin" onsubmit="BSL.login(event)" hidden>
        <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
        <label>Mot de passe<input name="pass" type="password" required autocomplete="current-password"></label>
        <button class="btn" type="submit">Me connecter</button>
      </form>
    </div>`;
    m.addEventListener("click", e => { if (e.target === m) B.closeAuth(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") B.closeAuth(); });
    document.body.appendChild(m);
  }
  function showErr(t) { const e = $("#amErr"); e.textContent = t || ""; e.hidden = !t; }
  function friendly(err) {
    const m = (err && err.message) || "";
    if (/already registered/i.test(m)) return "Cet e-mail est déjà inscrit. Utilisez l'onglet Connexion.";
    if (/invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/password/i.test(m)) return "Mot de passe trop court (6 caractères minimum).";
    if (/rate limit|too many/i.test(m)) return "Trop de tentatives. Réessayez dans quelques minutes.";
    if (/not confirmed/i.test(m)) return "Confirmez d'abord votre e-mail (lien reçu par message).";
    if (/fetch|network/i.test(m)) return "Problème de connexion internet.";
    return m || "Une erreur est survenue.";
  }

  B.openAuth = function (mode, info) {
    mode = mode === "login" ? "login" : "signup";
    $("#authModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#amTitle").textContent = mode === "signup" ? "Rejoignez BSL Zénith" : "Bon retour !";
    $("#fSignup").hidden = mode !== "signup";
    $("#fLogin").hidden = mode !== "login";
    $("#tSignup").classList.toggle("on", mode === "signup");
    $("#tLogin").classList.toggle("on", mode === "login");
    const i = $("#amInfo");
    if (info !== undefined) { i.textContent = info; i.hidden = !info; }
    showErr("");
  };
  B.closeAuth = function () {
    const m = $("#authModal");
    if (m) m.hidden = true;
    document.body.style.overflow = "";
    B.pendingUrl = null;
  };
  async function afterAuth() {
    const go = B.pendingUrl;
    B.closeAuth();
    await refresh();
    renderAuthZone();
    document.dispatchEvent(new Event("bsl-auth"));
    if (go) location.href = go;
  }
  B.signup = async function (e) {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button[type=submit]");
    btn.disabled = true; showErr("");
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(),
      password: f.pass.value,
      options: { data: { first_name: f.first.value.trim(), last_name: f.last.value.trim() } },
    });
    btn.disabled = false;
    if (error) return showErr(friendly(error));
    if (!data.session) {
      // Confirmation e-mail encore activée dans Supabase
      const i = $("#amInfo");
      i.textContent = "Compte créé ! Ouvrez le lien reçu par e-mail pour l'activer, puis connectez-vous.";
      i.hidden = false; B.openAuth("login");
      return;
    }
    afterAuth();
  };
  B.login = async function (e) {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button[type=submit]");
    btn.disabled = true; showErr("");
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pass.value });
    btn.disabled = false;
    if (error) return showErr(friendly(error));
    afterAuth();
  };
  B.logout = async function () { await sb.auth.signOut(); location.href = "index.html"; };

  // Clic sur un produit : membre -> fiche ; visiteur -> invitation à s'inscrire
  B.openProduct = function (id) {
    const url = "produit.html?id=" + encodeURIComponent(id);
    if (B.user) { location.href = url; return; }
    B.pendingUrl = url;
    B.openAuth("signup", "Inscrivez-vous gratuitement pour voir les détails de ce produit.");
  };

  // Nombre compact : 1250 -> 1,3 k
  B.n = n => {
    n = Number(n) || 0;
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",").replace(",0", "") + " k" : String(n);
  };
  // Carte produit commune (accueil, catalogue)
  B.card = function (p) {
    const old = p.old_price != null ? p.old_price : p.price;
    const img = p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.name)}" loading="lazy">` : "📦";
    const price = p.on_promo
      ? `<span class="price">${B.fmt(p.final_price)}</span><span class="old">${B.fmt(old)}</span>`
      : `<span class="price">${B.fmt(p.final_price)}</span>`;
    return `<button class="pcard" onclick="BSL.openProduct('${esc(p.id)}')">
      <div class="im">${img}${p.on_promo ? '<span class="badge">PROMO</span>' : ""}${p.is_new ? '<span class="badge new">NOUVEAU</span>' : ""}</div>
      <div class="b"><span class="n">${esc(p.name)}</span><span class="c">${esc(p.category_name || "")}</span>
      <div>${price}</div>
      <div class="stats"><span>❤️ ${B.n(p.likes_count)}</span><span>👁 ${B.n(p.views_count)}</span></div>
      ${B.user ? "" : '<span class="lock">🔒 Détails après inscription</span>'}</div></button>`;
  };

  /* ---------- Démarrage ---------- */
  buildModal();
  B.ready = (async () => {
    await Promise.all([loadShop(), refresh()]);
    renderHeader();
    renderFooter();
  })();
})();
