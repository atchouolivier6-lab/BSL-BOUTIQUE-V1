(async function () {
  const $ = s => document.querySelector(s);
  const { esc } = BSL;
  const box = $("#pbox");
  const ROLES = { member: "Membre", staff: "Employé", admin: "Administrateur" };

  await BSL.ready;
  document.title = "Mon profil - BSL Zénith";

  if (!BSL.user) {
    box.innerHTML = `<div class="card gate2" style="max-width:460px;margin:40px auto"><h2 style="margin-top:0">Mon profil</h2>
      <p class="muted">Connectez-vous pour gérer votre profil et votre photo.</p>
      <button class="btn" onclick="BSL.openAuth('login')">Connexion</button>
      <button class="btn ghost" onclick="BSL.openAuth('signup')">Créer un compte</button></div>`;
    document.addEventListener("bsl-auth", () => location.reload());
    return;
  }

  const uid = BSL.user.id;
  const P = BSL.profile || { first_name: "", last_name: "", role: "member", avatar_url: null };
  const [likes, favs] = await Promise.all([
    sb.from("product_likes").select("*", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("product_favorites").select("*", { count: "exact", head: true }).eq("user_id", uid),
  ]);

  render();

  function initials() {
    return ((P.first_name || BSL.user.email || "?")[0] || "?").toUpperCase();
  }
  function avatarHtml() {
    return `<div class="avatar lg">${P.avatar_url ? `<img src="${esc(P.avatar_url)}" alt="Photo de profil">` : esc(initials())}</div>`;
  }
  function note(id, text, cls) {
    const n = $(id); n.textContent = text; n.className = "msg " + (cls || ""); n.hidden = !text;
  }

  function render() {
    box.innerHTML = `<div class="pwrap">
      <h1>Mon profil</h1>

      <div class="card">
        <div class="avrow">
          ${avatarHtml()}
          <div>
            <b>${esc((P.first_name + " " + P.last_name).trim() || "Sans nom")}</b>
            <span class="rolepill ${P.role}">${ROLES[P.role] || "Membre"}</span>
            <div class="muted" style="font-size:14px;margin:2px 0 10px">${esc(BSL.user.email || "")}</div>
            <div class="avbtns">
              <button class="btn sm" id="pickBtn" type="button">${P.avatar_url ? "Changer la photo" : "Importer une photo"}</button>
              ${P.avatar_url ? '<button class="btn ghost sm" id="delBtn" type="button">Retirer la photo</button>' : ""}
              <input type="file" id="pfile" accept="image/*">
            </div>
            <div class="muted" style="font-size:13px;margin-top:6px">La photo est facultative.</div>
          </div>
        </div>
        <p class="msg" id="amsg" hidden style="margin-top:12px"></p>
      </div>

      <div class="card">
        <h2>Mes informations</h2>
        <p class="msg" id="nmsg" hidden></p>
        <form id="nform">
          <div class="row2c">
            <label>Prénom<input name="first" required maxlength="60" value="${esc(P.first_name)}"></label>
            <label>Nom<input name="last" required maxlength="60" value="${esc(P.last_name)}"></label>
          </div>
          <button class="btn" type="submit">Enregistrer</button>
        </form>
      </div>

      <div class="card">
        <h2>Mon activité</h2>
        <div class="statsrow">
          <a href="catalogue.html?f=fav"><b>${likes.count || 0}</b><span class="muted">Produits aimés</span></a>
          <a href="catalogue.html?f=fav"><b>${favs.count || 0}</b><span class="muted">Favoris</span></a>
        </div>
      </div>

      <div class="card">
        <h2>Changer mon mot de passe</h2>
        <p class="msg" id="wmsg" hidden></p>
        <form id="wform">
          <label>Nouveau mot de passe (6 caractères minimum)<input name="p1" type="password" minlength="6" required autocomplete="new-password"></label>
          <label>Confirmer<input name="p2" type="password" minlength="6" required autocomplete="new-password"></label>
          <button class="btn" type="submit">Modifier le mot de passe</button>
        </form>
      </div>

      <div><button class="btn ghost" onclick="BSL.logout()">Déconnexion</button></div>
    </div>`;

    const file = $("#pfile");
    $("#pickBtn").onclick = () => file.click();
    file.onchange = () => file.files[0] && uploadPhoto(file.files[0]);
    const del = $("#delBtn");
    if (del) del.onclick = removePhoto;
    $("#nform").onsubmit = saveNames;
    $("#wform").onsubmit = savePassword;
  }

  /* ----- Photo : recadrage carré 400 px, envoi, mise à jour ----- */
  function squareBlob(file, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? resolve(b) : reject(new Error("Image illisible"))), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
      img.src = url;
    });
  }
  const pathOf = url => { const i = (url || "").indexOf("/avatars/"); return i < 0 ? null : decodeURIComponent(url.slice(i + 9).split("?")[0]); };

  async function uploadPhoto(file) {
    if (!file.type.startsWith("image/")) return note("#amsg", "Choisissez une image.", "err");
    if (file.size > 20 * 1024 * 1024) return note("#amsg", "Image trop lourde (20 Mo maximum).", "err");
    note("#amsg", "Envoi de la photo...");
    try {
      const blob = await squareBlob(file, 400);
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const upd = await sb.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (upd.error) throw upd.error;
      const old = pathOf(P.avatar_url);
      if (old) sb.storage.from("avatars").remove([old]);
      P.avatar_url = url;
      if (BSL.profile) BSL.profile.avatar_url = url;
      BSL.renderAuthZone();
      render();
      note("#amsg", "Photo enregistrée.", "good");
    } catch (e) {
      note("#amsg", "Envoi impossible : " + (e.message || "réessayez."), "err");
    }
  }

  async function removePhoto() {
    if (!confirm("Retirer votre photo de profil ?")) return;
    const upd = await sb.from("profiles").update({ avatar_url: null }).eq("id", uid);
    if (upd.error) return note("#amsg", "Action impossible : " + upd.error.message, "err");
    const old = pathOf(P.avatar_url);
    if (old) sb.storage.from("avatars").remove([old]);
    P.avatar_url = null;
    if (BSL.profile) BSL.profile.avatar_url = null;
    BSL.renderAuthZone();
    render();
    note("#amsg", "Photo retirée.", "good");
  }

  async function saveNames(e) {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button");
    btn.disabled = true;
    const first = f.first.value.trim(), last = f.last.value.trim();
    const { error } = await sb.from("profiles").update({ first_name: first, last_name: last }).eq("id", uid);
    btn.disabled = false;
    if (error) return note("#nmsg", "Enregistrement impossible : " + error.message, "err");
    P.first_name = first; P.last_name = last;
    if (BSL.profile) { BSL.profile.first_name = first; BSL.profile.last_name = last; }
    BSL.renderAuthZone();
    note("#nmsg", "Informations enregistrées.", "good");
  }

  async function savePassword(e) {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value !== f.p2.value) return note("#wmsg", "Les deux mots de passe ne sont pas identiques.", "err");
    f.querySelector("button").disabled = true;
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    f.querySelector("button").disabled = false;
    if (error) return note("#wmsg", /different|same/i.test(error.message) ? "Choisissez un mot de passe différent de l'ancien." : error.message, "err");
    f.reset();
    note("#wmsg", "Mot de passe modifié.", "good");
  }
})();
