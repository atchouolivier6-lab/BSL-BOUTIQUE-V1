// Page ouverte depuis le lien reçu par e-mail (« Mot de passe oublié »)
(function () {
  const $ = s => document.querySelector(s);
  const box = $("#rbox");
  let shown = false;

  // À écouter dès le départ : l'événement arrive quand Supabase lit le lien
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") showForm(); });

  (async () => {
    await BSL.ready;
    // Filet de sécurité : si une session est active après 2,5 s, on propose le formulaire
    setTimeout(() => { if (!shown) (BSL.user ? showForm() : invalid()); }, 2500);
  })();

  function invalid() {
    shown = true;
    box.innerHTML = `<h2 style="margin-top:0">Lien invalide ou expiré</h2>
      <p class="muted">Ce lien ne fonctionne plus. Demandez-en un nouveau depuis « Mot de passe oublié ? ».</p>
      <a class="btn" href="index.html">Retour au site</a>`;
  }

  function showForm() {
    if (shown && $("#rform")) return;
    shown = true;
    box.innerHTML = `<h2 style="margin-top:0">Nouveau mot de passe</h2>
      <p class="msg err" id="rerr" hidden></p>
      <form id="rform">
        <label>Nouveau mot de passe (6 caractères minimum)<input name="p1" type="password" minlength="6" required autocomplete="new-password"></label>
        <label>Confirmer le mot de passe<input name="p2" type="password" minlength="6" required autocomplete="new-password"></label>
        <button class="btn" type="submit" style="width:100%">Enregistrer</button>
      </form>`;
    $("#rform").onsubmit = async e => {
      e.preventDefault();
      const f = e.target, err = $("#rerr");
      if (f.p1.value !== f.p2.value) { err.textContent = "Les deux mots de passe ne sont pas identiques."; err.hidden = false; return; }
      f.querySelector("button").disabled = true;
      const { error } = await sb.auth.updateUser({ password: f.p1.value });
      if (error) {
        err.textContent = /different|same/i.test(error.message) ? "Choisissez un mot de passe différent de l'ancien." : error.message;
        err.hidden = false; f.querySelector("button").disabled = false; return;
      }
      box.innerHTML = `<h2 style="margin-top:0"> Mot de passe modifié</h2><p class="muted">Vous êtes connecté. Redirection…</p>`;
      setTimeout(() => (location.href = "index.html"), 1800);
    };
  }
})();
