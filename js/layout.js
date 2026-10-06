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
      </div></header>`;
    renderAuthZone();
    BSLTheme.init();
  }
  function renderAuthZone() {
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
  function renderFooter() {
    const s = B.shop, f = $("#footer");
    if (!f) return;
    const phones = (s.phones || []).map(esc).join(" / ");
    f.innerHTML = `<footer class="site"><div class="container">
      <b>${esc(s.name || "BSL La Puissance Zénith")}</b><br>
      📍 ${esc(s.address || "")}<br>🕒 ${esc(s.hours || "")}<br>📞 ${phones}<br>
      ${s.facebook ? `<a href="${esc(s.facebook)}" target="_blank" rel="noopener">Facebook</a> · ` : ""}
      ${s.tiktok ? `<a href="${esc(s.tiktok)}" target="_blank" rel="noopener">TikTok</a> · ` : ""}
      ${s.whatsapp_link ? `<a href="${esc(s.whatsapp_link)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
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

  /* ---------- Démarrage ---------- */
  buildModal();
  B.ready = (async () => {
    await Promise.all([loadShop(), refresh()]);
    renderHeader();
    renderFooter();
  })();
})();
