(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  if (!ADM.requireAdmin()) return;
  const { esc } = ADM;

  const r = await sb.from("settings").select("value").eq("key", "shop").maybeSingle();
  const S = (r.data && r.data.value) || {};
  const ph = S.phones || [];

  const field = (id, label, val, extra) =>
    `<label>${label}<input id="${id}" value="${esc(val || "")}" ${extra || ""}></label>`;

  $("#acontent").innerHTML = `
    <div class="head"><h1>Paramètres</h1></div>
    <p class="msg" id="smsg" hidden></p>
    <form class="settingsform" id="sform">

      <div class="fieldset"><h2>La boutique</h2>
        ${field("s_name", "Nom de la boutique", S.name, "required maxlength='80'")}
        ${field("s_tag", "Slogan", S.tagline, "maxlength='160'")}
        ${field("s_addr", "Adresse", S.address, "maxlength='160'")}
        ${field("s_hours", "Horaires", S.hours, "maxlength='120'")}
      </div>

      <div class="fieldset"><h2>Contacts</h2>
        <div class="g2f">
          ${field("s_p1", "Téléphone 1", ph[0], "inputmode='tel' placeholder='+2290191156651'")}
          ${field("s_p2", "Téléphone 2 (facultatif)", ph[1], "inputmode='tel'")}
        </div>
        ${field("s_wan", "Numéro WhatsApp pour les commandes", S.whatsapp_number, "inputmode='numeric' placeholder='2290191156651'")}
        <div class="smallhint" style="margin:-8px 0 12px">Chiffres seulement, avec l'indicatif du pays (229 pour le Bénin), sans le signe +.</div>
        ${field("s_wal", "Lien WhatsApp général", S.whatsapp_link, "placeholder='https://wa.me/message/...'")}
      </div>

      <div class="fieldset"><h2>Réseaux sociaux</h2>
        ${field("s_fb", "Lien Facebook", S.facebook, "placeholder='https://www.facebook.com/...'")}
        ${field("s_tt", "Lien TikTok", S.tiktok, "placeholder='https://tiktok.com/@...'")}
      </div>

      <div class="fieldset"><h2>Logos</h2>
        ${logoBlock("logo_shop", "Logo de la boutique (en-tête du site)", S.logo_shop)}
        ${logoBlock("logo_login", "Logo de la page de connexion admin", S.logo_login)}
      </div>

      <div class="fieldset"><h2>Carte</h2>
        ${field("s_map", "Position exacte (facultatif)", S.map_query, "placeholder='7.0123,2.4567'")}
        <div class="smallhint">Dans Google Maps, appuyez longuement sur l'emplacement de la boutique, puis copiez les deux nombres affichés (latitude, longitude). Laissé vide, la carte utilise l'adresse.</div>
      </div>

      <div><button class="btn" type="submit" id="ssave">Enregistrer les paramètres</button></div>
    </form>`;

  function logoBlock(key, label, url) {
    return `<div class="logoed" data-key="${key}">
      ${url ? `<img src="${esc(url)}" alt="" id="prev_${key}">` : `<span class="mono" id="prev_${key}">BSL</span>`}
      <div class="grow"><label style="margin:0">${label}<input id="u_${key}" value="${esc(url || "")}" placeholder="https://..."></label>
        <div style="margin-top:8px"><label class="btn ghost sm" style="display:inline-block;cursor:pointer;margin:0">Importer depuis le téléphone
          <input type="file" accept="image/*" data-up="${key}" hidden></label></div></div></div>`;
  }

  document.querySelectorAll("[data-up]").forEach(inp => (inp.onchange = () => inp.files[0] && uploadLogo(inp.dataset.up, inp.files[0])));
  $("#sform").onsubmit = save;

  function note(t, cls) { const m = $("#smsg"); m.textContent = t; m.className = "msg " + (cls || ""); m.hidden = !t; if (t) scrollTo({ top: 0, behavior: "smooth" }); }

  function resize(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const png = file.type === "image/png";
        c.toBlob(b => (b ? resolve({ blob: b, ext: png ? "png" : "jpg", type: png ? "image/png" : "image/jpeg" }) : reject(new Error("Image illisible"))),
          png ? "image/png" : "image/jpeg", 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
      img.src = url;
    });
  }

  async function uploadLogo(key, file) {
    ADM.toast("Envoi du logo...");
    try {
      const o = await resize(file, 600);
      const path = `branding/${key}-${Date.now()}.${o.ext}`;
      const up = await sb.storage.from("products").upload(path, o.blob, { contentType: o.type });
      if (up.error) throw up.error;
      const url = sb.storage.from("products").getPublicUrl(path).data.publicUrl;
      $("#u_" + key).value = url;
      const prev = $("#prev_" + key);
      prev.outerHTML = `<img src="${esc(url)}" alt="" id="prev_${key}">`;
      ADM.toast("Logo importé. Pensez à enregistrer.");
    } catch (e) {
      ADM.toast("Import impossible : " + (e.message || "réessayez."), "err");
    }
  }

  const cleanUrl = v => v.trim();
  const isUrl = v => !v || /^https?:\/\//i.test(v);

  async function save(e) {
    e.preventDefault();
    note("");
    const phone = v => v.replace(/[\s.\-()]/g, "");
    const phones = [$("#s_p1").value, $("#s_p2").value].map(x => phone(x.trim())).filter(Boolean);
    const wan = $("#s_wan").value.replace(/\D/g, "");
    const urls = { whatsapp_link: cleanUrl($("#s_wal").value), facebook: cleanUrl($("#s_fb").value), tiktok: cleanUrl($("#s_tt").value),
      logo_shop: cleanUrl($("#u_logo_shop").value), logo_login: cleanUrl($("#u_logo_login").value) };
    for (const [k, v] of Object.entries(urls)) if (!isUrl(v)) return note("Le lien « " + k + " » doit commencer par https://", "err");
    if (wan && (wan.length < 8 || wan.length > 15)) return note("Le numéro WhatsApp doit contenir entre 8 et 15 chiffres.", "err");
    const map = $("#s_map").value.trim();
    if (map && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(map)) return note("La position doit être au format : 7.0123,2.4567", "err");

    // On conserve les autres clés éventuelles déjà présentes
    const value = Object.assign({}, S, {
      name: $("#s_name").value.trim(), tagline: $("#s_tag").value.trim(), address: $("#s_addr").value.trim(),
      hours: $("#s_hours").value.trim(), phones, whatsapp_number: wan, map_query: map.replace(/\s/g, ""), ...urls,
    });
    const btn = $("#ssave"); btn.disabled = true;
    const { error } = await sb.from("settings").upsert({ key: "shop", value, updated_at: new Date().toISOString() });
    btn.disabled = false;
    if (error) return note("Enregistrement impossible : " + error.message, "err");
    Object.assign(S, value);
    note("Paramètres enregistrés. Ils sont visibles sur le site immédiatement.", "good");
  }
})();
