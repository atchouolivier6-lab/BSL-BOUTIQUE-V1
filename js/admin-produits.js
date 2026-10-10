(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc, fmt, n } = ADM;
  const BUCKET = "products", MAX_IMG = 6;
  let PRODUCTS = [], CATS = [], ED = null;   // ED = produit en cours d'edition

  const NOIMG = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--mu);opacity:.55"><rect x="6" y="9" width="36" height="30" rx="4"/><circle cx="17" cy="20" r="3.5"/><path d="M6 34l10-9 8 7 6-5 12 10"/></svg>';

  $("#acontent").innerHTML = `
    <div class="head"><h1>Produits</h1><button class="btn" id="padd">Ajouter un produit</button></div>
    <div class="tools">
      <input id="pq" type="search" placeholder="Rechercher un produit…" autocomplete="off">
      <select id="pcat" aria-label="Catégorie"></select>
      <select id="pst" aria-label="État">
        <option value="all">Tous les produits</option>
        <option value="pub">Publiés</option>
        <option value="draft">Brouillons (masques)</option>
        <option value="promo">En promotion</option>
        <option value="stock">Rupture ou stock limité</option>
      </select>
    </div>
    <div class="count" id="pcount"></div>
    <div id="plist"><p class="muted">Chargement…</p></div>
    <div class="modal2" id="pmodal" hidden><div class="mbox" id="pbox"></div></div>`;

  await load();
  $("#padd").onclick = () => openForm(null);
  ["#pq", "#pcat", "#pst"].forEach(s => $(s).addEventListener("input", draw));

  /* ---------------- Chargement et liste ---------------- */
  async function load() {
    const [p, c] = await Promise.all([
      sb.from("v_products")
        .select("id,name,category_id,category_name,price,promo_price,final_price,on_promo,stock,quantity,is_new,is_published,cover_url,views_count,likes_count,created_at")
        .order("created_at", { ascending: false }).limit(1000),
      sb.from("categories").select("id,name").order("position"),
    ]);
    if (p.error) { $("#plist").innerHTML = `<p class="msg err">Erreur : ${esc(p.error.message)}</p>`; return; }
    PRODUCTS = p.data || [];
    CATS = c.data || [];
    const cur = $("#pcat").value;
    $("#pcat").innerHTML = `<option value="">Toutes les catégories</option>` + CATS.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    $("#pcat").value = cur;
    draw();
  }

  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

  function draw() {
    const q = norm($("#pq").value).trim(), cat = $("#pcat").value, st = $("#pst").value;
    const list = PRODUCTS.filter(p =>
      (!q || norm(p.name + " " + (p.category_name || "")).includes(q)) &&
      (!cat || p.category_id === cat) &&
      (st === "all" || (st === "pub" && p.is_published) || (st === "draft" && !p.is_published) ||
       (st === "promo" && p.on_promo) || (st === "stock" && p.stock !== "in_stock")));
    $("#pcount").textContent = `${list.length} produit${list.length > 1 ? "s" : ""} sur ${PRODUCTS.length}`;
    $("#plist").innerHTML = list.length ? list.map(row).join("") : `<p class="muted-empty">Aucun produit. Appuyez sur "Ajouter un produit".</p>`;
    $("#plist").querySelectorAll("[data-a]").forEach(b => (b.onclick = () => act(b.dataset.a, b.dataset.id)));
  }

  function row(p) {
    const price = p.on_promo ? `${fmt(p.final_price)}<s>${fmt(p.price)}</s>` : fmt(p.price);
    return `<div class="prow">
      <div class="thumb">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : NOIMG}</div>
      <div class="grow"><div class="nm">${esc(p.name)}</div>
        <small>${esc(p.category_name || "Sans catégorie")}</small>
        <div class="pr">${price}</div>
        <div class="pills">
          <span class="pill ${p.is_published ? "ok" : "draft"}">${p.is_published ? "Publié" : "Brouillon"}</span>
          ${p.stock === "out" ? '<span class="pill out">Rupture</span>' : p.stock === "low" ? `<span class="pill low">Stock limité${p.quantity != null ? " (" + p.quantity + ")" : ""}</span>` : ""}
          ${p.on_promo ? '<span class="pill promo">Promo</span>' : ""}${p.is_new ? '<span class="pill">Nouveau</span>' : ""}
          <small>${n(p.views_count)} vues, ${n(p.likes_count)} j'aime</small>
        </div></div>
      <div class="acts">
        <button class="btn ghost sm" data-a="edit" data-id="${esc(p.id)}">Modifier</button>
        <button class="btn ghost sm" data-a="toggle" data-id="${esc(p.id)}">${p.is_published ? "Masquer" : "Publier"}</button>
        <button class="btn danger sm" data-a="del" data-id="${esc(p.id)}">Supprimer</button>
      </div></div>`;
  }

  async function act(a, id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (a === "edit") return openForm(id);
    if (a === "toggle") {
      const { error } = await sb.from("products").update({ is_published: !p.is_published }).eq("id", id);
      if (error) return ADM.toast(error.message, "err");
      p.is_published = !p.is_published; draw();
      return ADM.toast(p.is_published ? "Produit publié" : "Produit masqué");
    }
    if (a === "del") {
      if (!confirm(`Supprimer définitivement "${p.name}" ?\nSes photos, j'aime et favoris seront aussi supprimés.`)) return;
      const imgs = await sb.from("product_images").select("url").eq("product_id", id);
      const paths = (imgs.data || []).map(i => pathOf(i.url)).filter(Boolean);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      const { error } = await sb.from("products").delete().eq("id", id);
      if (error) return ADM.toast(error.message, "err");
      PRODUCTS = PRODUCTS.filter(x => x.id !== id); draw();
      ADM.toast("Produit supprimé");
    }
  }

  /* ---------------- Formulaire ---------------- */
  async function openForm(id) {
    let p = { name: "", category_id: "", price: "", promo_price: "", promo_ends_at: null, stock: "in_stock", quantity: "", description: "", is_new: false, is_featured: false, is_published: true };
    let imgs = [];
    if (id) {
      const [r, im] = await Promise.all([
        sb.from("products").select("*").eq("id", id).single(),
        sb.from("product_images").select("url").eq("product_id", id).order("position"),
      ]);
      if (r.error) return ADM.toast(r.error.message, "err");
      p = r.data; imgs = (im.data || []).map(i => ({ url: i.url }));
    }
    ED = { id: id || null, imgs, removed: [] };
    const ends = p.promo_ends_at ? dateInput(p.promo_ends_at) : "";
    $("#pbox").innerHTML = `<h2>${id ? "Modifier le produit" : "Nouveau produit"}</h2>
      <form id="pform">
        <label>Nom du produit<input name="name" required maxlength="120" value="${esc(p.name)}"></label>
        <label>Catégorie<select name="cat"><option value="">Sans catégorie</option>
          ${CATS.map(c => `<option value="${esc(c.id)}" ${c.id === p.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <div class="g2">
          <label>Prix (FCFA)<input name="price" type="number" min="1" step="1" inputmode="numeric" required value="${p.price}"></label>
          <label>Prix promo (facultatif)<input name="promo" type="number" min="1" step="1" inputmode="numeric" value="${p.promo_price || ""}"></label>
        </div>
        <label>Fin de la promotion (facultatif)<input name="ends" type="date" value="${ends}"></label>
        <div class="g2">
          <label>Disponibilité<select name="stock">
            <option value="in_stock" ${p.stock === "in_stock" ? "selected" : ""}>En stock</option>
            <option value="low" ${p.stock === "low" ? "selected" : ""}>Stock limité</option>
            <option value="out" ${p.stock === "out" ? "selected" : ""}>Rupture de stock</option></select></label>
          <label>Quantité (facultatif)<input name="qty" type="number" min="0" step="1" inputmode="numeric" value="${p.quantity ?? ""}"></label>
        </div>
        <label>Description<textarea name="desc" rows="5" maxlength="3000">${esc(p.description || "")}</textarea></label>
        <div class="checks2">
          <label><input type="checkbox" name="pub" ${p.is_published ? "checked" : ""}> Visible sur le site</label>
          <label><input type="checkbox" name="isnew" ${p.is_new ? "checked" : ""}> Afficher le badge Nouveau</label>
          <label><input type="checkbox" name="feat" ${p.is_featured ? "checked" : ""}> Mettre en avant</label>
        </div>
        <b>Photos</b> <span class="hint">(${MAX_IMG} maximum, la première est la couverture)</span>
        <div class="imgs" id="imgs"></div>
        <label class="btn ghost sm filebtn">Ajouter des photos<input type="file" id="pfile" accept="image/*" multiple hidden></label>
        <p class="msg err" id="perr" hidden></p>
        <div class="formacts"><button class="btn" type="submit" id="psave">Enregistrer</button>
          <button class="btn ghost" type="button" id="pcancel">Annuler</button></div>
      </form>`;
    $("#pmodal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#pmodal").scrollTop = 0;
    drawImgs();
    $("#pcancel").onclick = closeForm;
    $("#pfile").onchange = e => {
      const room = MAX_IMG - ED.imgs.length;
      const files = [...e.target.files].slice(0, Math.max(0, room));
      if (e.target.files.length > room) ADM.toast(`Maximum ${MAX_IMG} photos.`, "err");
      files.forEach(f => ED.imgs.push({ file: f, blob: URL.createObjectURL(f) }));
      e.target.value = ""; drawImgs();
    };
    $("#pform").onsubmit = save;
  }

  function closeForm() {
    ED.imgs.forEach(i => i.blob && URL.revokeObjectURL(i.blob));
    $("#pmodal").hidden = true; document.body.style.overflow = ""; ED = null;
  }

  function drawImgs() {
    $("#imgs").innerHTML = ED.imgs.map((im, i) => `<div class="itile">
      <img src="${esc(im.blob || im.url)}" alt="Photo ${i + 1}">${i === 0 ? '<span class="cv">Couverture</span>' : ""}
      <div class="ib">${i > 0 ? `<button type="button" data-m="first" data-i="${i}">Première</button>` : ""}
        <button type="button" class="rm" data-m="rm" data-i="${i}">Retirer</button></div></div>`).join("");
    $("#imgs").querySelectorAll("button").forEach(b => (b.onclick = () => {
      const i = +b.dataset.i;
      if (b.dataset.m === "first") ED.imgs.unshift(ED.imgs.splice(i, 1)[0]);
      else { const [x] = ED.imgs.splice(i, 1); if (x.url) ED.removed.push(x.url); if (x.blob) URL.revokeObjectURL(x.blob); }
      drawImgs();
    }));
  }

  /* ---------------- Enregistrement ---------------- */
  async function save(e) {
    e.preventDefault();
    const el = e.target.elements, err = $("#perr"), btn = $("#psave");
    const fail = t => { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: "nearest" }); };
    err.hidden = true;

    const name = el.name.value.trim();
    const price = parseInt(el.price.value, 10);
    const promo = el.promo.value === "" ? null : parseInt(el.promo.value, 10);
    if (!name) return fail("Le nom est obligatoire.");
    if (!(price > 0)) return fail("Indiquez un prix valide.");
    if (promo !== null && !(promo > 0 && promo < price)) return fail("Le prix promo doit etre inférieur au prix normal.");
    const row = {
      name, category_id: el.cat.value || null, description: el.desc.value.trim() || null,
      price, promo_price: promo,
      promo_ends_at: promo && el.ends.value ? new Date(el.ends.value + "T23:59:59").toISOString() : null,
      stock: el.stock.value, quantity: el.qty.value === "" ? null : Math.max(0, parseInt(el.qty.value, 10)),
      is_new: el.isnew.checked, is_featured: el.feat.checked, is_published: el.pub.checked,
    };

    btn.disabled = true; btn.textContent = "Enregistrement…";
    let id = ED.id;
    if (id) {
      const { error } = await sb.from("products").update(row).eq("id", id);
      if (error) { btn.disabled = false; btn.textContent = "Enregistrer"; return fail(error.message); }
    } else {
      let res, base = slugify(name);
      for (let t = 0; t < 4; t++) {
        res = await sb.from("products").insert({ ...row, slug: t ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base }).select("id").single();
        if (!res.error || res.error.code !== "23505") break;
      }
      if (res.error) { btn.disabled = false; btn.textContent = "Enregistrer"; return fail(res.error.message); }
      id = res.data.id;
    }

    // Photos : envoi des nouvelles, puis ordre et couverture
    let failed = 0;
    const pending = ED.imgs.filter(i => i.file);
    let k = 0;
    for (const im of pending) {
      btn.textContent = `Photo ${++k}/${pending.length}…`;
      try {
        const blob = await resize(im.file);
        const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        im.url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      } catch (x) { failed++; im.failed = true; }
    }
    const final = ED.imgs.filter(i => i.url && !i.failed);
    await sb.from("product_images").delete().eq("product_id", id);
    if (final.length) {
      const ins = await sb.from("product_images").insert(final.map((im, i) => ({ product_id: id, url: im.url, position: i, is_cover: i === 0 })));
      if (ins.error) failed += final.length;
    }
    const gone = ED.removed.map(pathOf).filter(Boolean);
    if (gone.length) await sb.storage.from(BUCKET).remove(gone);

    closeForm();
    await load();
    ADM.toast(failed ? `Produit enregistré, mais ${failed} photo(s) n'ont pas pu etre envoyées.` : "Produit enregistré", failed ? "err" : "");
  }

  /* ---------------- Outils ---------------- */
  function slugify(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "produit";
  }
  function pathOf(url) {
    const k = `/object/public/${BUCKET}/`, i = String(url).indexOf(k);
    return i < 0 ? null : decodeURIComponent(String(url).slice(i + k.length).split("?")[0]);
  }
  function dateInput(iso) {
    const d = new Date(iso), z = x => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  // Réduit la photo (1200 px max, JPEG) : envoi rapide même avec peu de connexion
  function resize(file, max = 1200, quality = 0.82) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => (b ? res(b) : rej(new Error("Image illisible"))), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Image illisible")); };
      img.src = url;
    });
  }
})();
