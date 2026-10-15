(function () {
  const $ = s => document.querySelector(s);
  const rows = [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let gotPrompt = false;
  addEventListener("beforeinstallprompt", () => { gotPrompt = true; });

  function add(label, state, detail) { rows.push({ label, state, detail }); draw(); }
  function draw() {
    $("#diag").innerHTML = rows.map(r => `<div class="drow ${r.state === "ok" ? "" : r.state}">
      <span class="tag">${r.state === "ok" ? "OK" : r.state === "bad" ? "A CORRIGER" : "INFO"}</span>
      <div><b>${esc(r.label)}</b><small>${esc(r.detail || "")}</small></div></div>`).join("");
  }
  const get = async (u) => { const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }); return r; };

  (async () => {
    const ua = navigator.userAgent;

    // 0. Base de données et comptes (Supabase)
    const C = window.BSL_CONFIG || {};
    if (!C.SUPABASE_URL || !C.SUPABASE_KEY) {
      add("Fichier js/config.js", "bad", "Adresse ou clé de Supabase absente : recollez le contenu complet de js/config.js.");
    } else {
      add("Fichier js/config.js", "ok", "Adresse : " + C.SUPABASE_URL.replace("https://", ""));
      const H = { apikey: C.SUPABASE_KEY };
      const probe = async (label, path, okText) => {
        try {
          const r = await fetch(C.SUPABASE_URL + path, { headers: H, cache: "no-store" });
          const t = (await r.text()).slice(0, 240);
          add(label, r.ok ? "ok" : "bad", r.ok ? okText : "Code " + r.status + " : " + t);
        } catch (e) {
          add(label, "bad", "Aucune réponse du serveur (" + (e.message || e) + "). Le projet Supabase est peut-être en pause : ouvrez-le et appuyez sur Restore.");
        }
      };
      await probe("Base de données : le serveur répond", "/rest/v1/settings?select=key&limit=1", "Oui.");
      await probe("Produits visibles avant connexion (v_teaser)", "/rest/v1/v_teaser?select=id&limit=1", "Lecture possible.");
      await probe("Service de comptes (Auth)", "/auth/v1/health", "Le service répond.");
      try {
        const r = await fetch(C.SUPABASE_URL + "/auth/v1/settings", { headers: H, cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          add("Inscriptions ouvertes", j.disable_signup ? "bad" : "ok", j.disable_signup
            ? "Les inscriptions sont désactivées. Supabase, Authentication, Sign In / Providers : activez « Allow new users to sign up »." : "Oui.");
          add("Confirmation par e-mail à l'inscription", "info", j.mailer_autoconfirm
            ? "Non requise : l'inscription est immédiate."
            : "Requise : un nouveau membre doit d'abord cliquer sur un e-mail. Pour une inscription immédiate, désactivez « Confirm email » dans Authentication, Sign In / Providers, Email.");
        }
      } catch (e) {}
    }

    // 1. Fichier layout.js à jour ?
    try {
      const t = await (await get("js/layout.js")).text();
      const ok = t.includes("showInstallHelp");
      add("Fichier js/layout.js à jour (bouton permanent)", ok ? "ok" : "bad", ok ? "Version récente en ligne." : "L'ancienne version est en ligne : remplacez js/layout.js dans GitHub.");
    } catch (e) { add("Fichier js/layout.js", "bad", "Introuvable."); }

    // 1b. Partie 2 de layout.js
    try {
      const r = await get("js/layout-app.js"), t = await r.text();
      const ok = r.ok && t.includes("buildModal");
      add("Fichier js/layout-app.js (partie 2 du layout)", ok ? "ok" : "bad", ok ? "Présent." : "Introuvable ou incomplet : créez js/layout-app.js dans GitHub.");
    } catch (e) { add("Fichier js/layout-app.js", "bad", "Introuvable."); }

    // 2. Manifest
    let man = null;
    try {
      const r = await get("manifest.webmanifest"), txt = await r.text();
      if (!r.ok) add("Fichier manifest.webmanifest", "bad", "Introuvable (code " + r.status + "). Vérifiez le nom et l'emplacement (racine du dépôt).");
      else {
        try { man = JSON.parse(txt); add("Fichier manifest.webmanifest valide", man.name && man.icons && man.icons.length ? "ok" : "bad", man.name ? "Nom : " + man.name : "Contenu incomplet."); }
        catch (e) { add("Fichier manifest.webmanifest valide", "bad", "Le fichier est vide ou mal recopié. Collez à nouveau son contenu."); }
      }
    } catch (e) { add("Fichier manifest.webmanifest", "bad", "Introuvable."); }

    // 3. Icônes
    if (man && man.icons) {
      for (const ic of man.icons) {
        try {
          const r = await get(ic.src);
          const ok = r.ok && (r.headers.get("content-type") || "").includes("image");
          add("Icône " + ic.sizes + " (" + ic.src + ")", ok ? "ok" : "bad", ok ? "Présente." : "Introuvable (code " + r.status + ") : importez-la dans le dossier icons.");
        } catch (e) { add("Icône " + ic.src, "bad", "Introuvable."); }
      }
    }

    // 4. Service worker
    try {
      const r = await get("sw.js"), t = await r.text();
      const ok = r.ok && t.includes("addEventListener");
      add("Fichier sw.js", ok ? "ok" : "bad", ok ? "Présent et lisible." : "Introuvable ou vide (code " + r.status + "). Ouvrez-le avec le crayon et collez son contenu.");
    } catch (e) { add("Fichier sw.js", "bad", "Introuvable."); }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      add("Service worker actif sur ce navigateur", regs.length ? "ok" : "bad",
        regs.length ? regs.length + " enregistrement(s). " + (navigator.serviceWorker.controller ? "Il contrôle cette page." : "Rechargez la page une fois pour qu'il la contrôle.") : "Aucun : rechargez la page, puis relancez ce diagnostic.");
    } else add("Service worker", "bad", "Ce navigateur ne le gère pas.");

    // 5. Navigateur
    const inApp = /FBAN|FBAV|Instagram|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|; wv\)/i.test(ua);
    const chrome = /Chrome\//.test(ua) && !/EdgA|OPR\//.test(ua);
    add("Navigateur", inApp ? "bad" : (chrome || /SamsungBrowser/.test(ua) ? "ok" : "info"),
      inApp ? "Vous êtes dans le navigateur intégré d'une application (Facebook, TikTok...). Ouvrez le lien dans Chrome." : (chrome ? "Chrome : l'installation est possible." : ua));

    // 6. Mode d'affichage
    const sa = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    add("Mode d'affichage", "info", sa ? "Vous êtes DANS l'application installée (plein écran). C'est normal que le navigateur ne propose plus l'installation ici." : "Vous êtes dans le navigateur (page web normale).");
    let flag = "non"; try { flag = localStorage.getItem("bslInstalled") === "1" ? "oui" : "non"; } catch (e) {}
    add("Installation déjà détectée sur ce navigateur", "info", flag);

    // 7. Signal d'installation du navigateur (attente 6 s)
    add("Signal d'installation du navigateur", "info", "Attente pendant 6 secondes...");
    setTimeout(() => {
      rows.pop();
      add("Signal d'installation du navigateur", gotPrompt ? "ok" : "info",
        gotPrompt ? "Reçu : le bouton « Installer l'application » lancera l'installation directe." :
        "Non reçu. Causes possibles : l'application est déjà installée sur ce téléphone, vous êtes dans une fenêtre temporaire (croix X en haut à gauche, ouverte depuis une autre application), ou vous avez refusé l'installation plusieurs fois (le navigateur attend alors quelques semaines). Dans ce cas, utilisez le menu de Chrome (trois points) puis « Installer l'application ».");
    }, 6000);
  })();

  $("#bInstall").onclick = () => BSL.install();
  $("#bReset").onclick = async () => {
    $("#dnote").textContent = "Nettoyage en cours...";
    try {
      if ("serviceWorker" in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
      if (window.caches) (await caches.keys()).forEach(k => caches.delete(k));
    } catch (e) {}
    $("#dnote").textContent = "Terminé. La page va se recharger.";
    setTimeout(() => (location.href = "diagnostic.html?r=" + Date.now()), 900);
  };
})();
