// Cadre commun de toutes les pages admin (admin.html, admin-*.html)
// Charge APRÈS config.js et supabase.js. Chaque page attend : await ADM.ready
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = (window.ADM = {
    esc,
    fmt: n => Number(n).toLocaleString("fr-FR") + " FCFA",
    n: n => Number(n || 0).toLocaleString("fr-FR"),
    date: d => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }),
    user: null, profile: null, isStaff: false, isAdmin: false, cfg: {},
  });

  // [fichier, icône, libellé, disponible, rôle requis]
  const SECTIONS = [
    ["admin.html", "", "Dashboard", true, "staff"],
    ["admin-produits.html", "", "Produits", true, "staff"],
    ["admin-categories.html", "", "Catégories", true, "staff"],
    ["admin-promotions.html", "", "Promotions", true, "staff"],
    ["admin-contenu.html", "", "Annonces & FAQ", true, "staff"],
    ["admin-messages.html", "", "Messages", true, "staff"],
    ["admin-stats.html", "", "Statistiques", true, "staff"],
    ["admin-membres.html", "", "Membres", true, "admin"],
    ["admin-parametres.html", "", "Paramètres", true, "admin"],
  ];

  /* ---------- Petits outils partagés ---------- */
  A.toast = function (msg, type) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "toast show " + (type || "");
    clearTimeout(A._t); A._t = setTimeout(() => (t.className = "toast"), 3200);
  };
  A.denyAdmin = function () {
    $("#acontent").innerHTML = `<div class="card" style="max-width:480px"><h2 style="margin-top:0">Réservé à l'administrateur</h2>
      <p class="muted">Cette section est accessible uniquement au propriétaire de la boutique.</p>
      <a class="btn" href="admin.html">Retour au dashboard</a></div>`;
  };
  A.requireAdmin = function () { if (!A.isAdmin) { A.denyAdmin(); return false; } return true; };

  /* ---------- Démarrage : session, rôle, paramètres ---------- */
  A.ready = (async () => {
    const [sess, set] = await Promise.all([
      sb.auth.getSession(),
      sb.from("settings").select("value").eq("key", "shop").maybeSingle(),
    ]);
    A.cfg = (set.data && set.data.value) || {};
    A.user = sess.data.session ? sess.data.session.user : null;
    if (A.user) {
      const r = await sb.from("profiles").select("first_name,last_name,role,avatar_url").eq("id", A.user.id).maybeSingle();
      A.profile = r.data || null;
    }
    A.isStaff = !!A.profile && ["staff", "admin"].includes(A.profile.role);
    A.isAdmin = !!A.profile && A.profile.role === "admin";

    if (!A.user) { renderLogin(); return false; }
    if (!A.isStaff) { renderDenied(); return false; }
    await renderShell();
    return true;
  })();

  /* ---------- Écran de connexion admin ---------- */
  function logoHtml(url, cls) {
    return url ? `<img class="${cls}" src="${esc(url)}" alt="Logo" onerror="this.outerHTML='<span class=&quot;mono ${cls}&quot;>BSL</span>'">`
               : `<span class="mono ${cls}">BSL</span>`;
  }
  function renderLogin() {
    $("#adm").innerHTML = `<div class="loginwrap"><div class="card loginbox">
      ${logoHtml(A.cfg.logo_login, "biglogo")}
      <h1>Espace administration</h1>
      <p class="muted">Réservé à l'équipe BSL La Puissance Zénith.</p>
      <p class="msg err" id="lerr" hidden></p>
      <form id="lform">
        <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
        <label>Mot de passe<input name="pass" type="password" required autocomplete="current-password"></label>
        <button class="btn" type="submit" style="width:100%">Se connecter</button>
      </form>
      <p style="margin:14px 0 0"><a href="#" id="lforgot" style="text-decoration:underline;font-size:14px">Mot de passe oublié ?</a>
        · <a href="index.html" style="text-decoration:underline;font-size:14px">Retour au site</a></p>
      <p><button class="btn ghost sm" data-theme-btn>Sombre</button></p></div></div>`;
    BSLTheme.init();
    const err = t => { const e = $("#lerr"); e.textContent = t; e.hidden = !t; e.className = "msg " + (t && t.startsWith("") ? "good" : "err"); };
    $("#lform").onsubmit = async e => {
      e.preventDefault(); err("");
      const f = e.target, b = f.querySelector("button");
      b.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pass.value });
      b.disabled = false;
      if (error) return err(/invalid login/i.test(error.message) ? "E-mail ou mot de passe incorrect." : error.message);
      location.reload();
    };
    $("#lforgot").onclick = async e => {
      e.preventDefault();
      const em = $("#lform").email.value.trim();
      if (!em) return err("Saisissez d'abord votre e-mail ci-dessus.");
      const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: new URL("reinitialiser.html", location.href).href });
      err(error ? error.message : "Si cet e-mail est inscrit, un lien vient d'être envoyé.");
    };
  }

  function renderDenied() {
    $("#adm").innerHTML = `<div class="loginwrap"><div class="card loginbox">
      <h1>Accès refusé</h1>
      <p class="muted">Votre compte n'a pas les droits pour accéder à l'administration. Contactez le propriétaire de la boutique pour être nommé employé.</p>
      <a class="btn" href="index.html">Retour au site</a>
      <button class="btn ghost" id="lo">Déconnexion</button></div></div>`;
    $("#lo").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  }

  /* ---------- Cadre : en-tête + menu ---------- */
  async function renderShell() {
    const file = location.pathname.split("/").pop() || "admin.html";
    const name = [A.profile.first_name, A.profile.last_name].filter(Boolean).join(" ") || A.user.email;
    const links = SECTIONS.filter(s => s[4] === "staff" || A.isAdmin).map(([f, ic, label, ok]) =>
      ok ? `<a href="${f}" class="${f === file ? "on" : ""}">${label}${f === "admin-messages.html" ? '<i class="dot" id="unread" hidden></i>' : ""}</a>`
         : `<a class="soon" title="Bientôt disponible">${label}<small>bientôt</small></a>`).join("");

    $("#adm").innerHTML = `
      <header class="topbar"><div class="container wide">
        <a class="brand" href="admin.html">${logoHtml(A.cfg.logo_shop, "lg")}<span class="name">Administration</span></a>
        <span class="spacer"></span>
        <button class="btn ghost sm" data-theme-btn aria-label="Changer le thème">Sombre</button>
        <button class="menubtn" id="menuBtn" type="button" aria-label="Menu" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      </div></header>
      <div class="menupanel" id="userMenu" hidden>
        <div class="mhead">
          <span class="avatar">${A.profile.avatar_url ? `<img src="${esc(A.profile.avatar_url)}" alt="">` : esc((name[0] || "?").toUpperCase())}</span>
          <div style="min-width:0"><div class="nm">${esc(name)}</div><span class="mrole ${A.isAdmin ? "admin" : "staff"}">${A.isAdmin ? "Administrateur" : "Employé"}</span>
          <small>${esc(A.user.email || "")}</small></div>
        </div>
        <a href="profil.html">Mon profil</a>
        <a href="index.html">Voir le site</a>
        <button class="mi out" type="button" id="alogout">Déconnexion</button>
      </div>
      <div class="admwrap"><nav class="admnav">${links}</nav><main class="admmain" id="acontent"></main></div>`;
    BSLTheme.init();
    const mb = $("#menuBtn"), mp = $("#userMenu");
    const setMenu = open => {
      if (open) mp.style.top = (mb.getBoundingClientRect().bottom + 8) + "px";
      mp.hidden = !open; mb.setAttribute("aria-expanded", String(open));
    };
    mb.onclick = e => { e.stopPropagation(); setMenu(mp.hidden); };
    document.addEventListener("click", e => { if (!mp.hidden && !mp.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    $("#alogout").onclick = async () => { await sb.auth.signOut(); location.href = "admin.html"; };

    // Pastille « messages non lus »
    sb.from("messages").select("id", { count: "exact", head: true }).eq("is_read", false)
      .then(r => { const d = $("#unread"); if (d && r.count) { d.hidden = false; d.textContent = r.count; } });
  }
})();
