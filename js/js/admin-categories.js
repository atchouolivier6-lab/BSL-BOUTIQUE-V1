(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc } = ADM;
  let CATS = [], COUNT = {};

  $("#acontent").innerHTML = `
    <div class="head"><h1>Catégories</h1></div>
    <p class="muted" style="margin-top:0">Les catégories servent à classer les produits et à filtrer le catalogue. L'ordre affiché ici est celui du site.</p>
    <form class="addcat" id="cform">
      <input name="name" placeholder="Nom de la nouvelle catégorie" maxlength="60" required>
      <button class="btn" type="submit">Ajouter</button>
    </form>
    <div id="clist"><p class="muted">Chargement…</p></div>`;

  await load();
  $("#cform").onsubmit = add;

  async function load() {
    const [c, p] = await Promise.all([
      sb.from("categories").select("id,name,slug,position").order("position"),
      sb.from("products").select("category_id").limit(2000),
    ]);
    if (c.error) { $("#clist").innerHTML = `<p class="msg err">Erreur : ${esc(c.error.message)}</p>`; return; }
    CATS = c.data || [];
    COUNT = {};
    (p.data || []).forEach(x => { if (x.category_id) COUNT[x.category_id] = (COUNT[x.category_id] || 0) + 1; });
    draw();
  }

  function draw() {
    $("#clist").innerHTML = CATS.length ? CATS.map((c, i) => `
      <div class="crow">
        <div class="grow"><div class="nm">${esc(c.name)}</div>
          <small class="muted">${COUNT[c.id] || 0} produit${(COUNT[c.id] || 0) > 1 ? "s" : ""}</small></div>
        <div class="acts">
          <button class="btn ghost sm" data-a="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>Monter</button>
          <button class="btn ghost sm" data-a="down" data-i="${i}" ${i === CATS.length - 1 ? "disabled" : ""}>Descendre</button>
          <button class="btn ghost sm" data-a="ren" data-i="${i}">Renommer</button>
          <button class="btn danger sm" data-a="del" data-i="${i}">Supprimer</button>
        </div></div>`).join("") : `<p class="muted-empty">Aucune catégorie. Ajoutez la première ci-dessus.</p>`;
    $("#clist").querySelectorAll("[data-a]").forEach(b => (b.onclick = () => act(b.dataset.a, +b.dataset.i)));
  }

  async function add(e) {
    e.preventDefault();
    const f = e.target, name = f.elements.name.value.trim();
    if (!name) return;
    const base = slugify(name);
    const pos = CATS.length ? Math.max(...CATS.map(c => c.position)) + 1 : 1;
    let res;
    for (let t = 0; t < 4; t++) {
      res = await sb.from("categories").insert({ name, slug: t ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base, position: pos });
      if (!res.error || res.error.code !== "23505") break;
    }
    if (res.error) return ADM.toast(res.error.message, "err");
    f.reset(); ADM.toast("Catégorie ajoutée"); load();
  }

  async function act(a, i) {
    const c = CATS[i];
    if (a === "ren") {
      const name = (prompt("Nouveau nom de la catégorie :", c.name) || "").trim();
      if (!name || name === c.name) return;
      const { error } = await sb.from("categories").update({ name }).eq("id", c.id);
      if (error) return ADM.toast(error.message, "err");
      ADM.toast("Catégorie renommée"); return load();
    }
    if (a === "up" || a === "down") {
      const o = CATS[a === "up" ? i - 1 : i + 1];
      if (!o) return;
      // Positions toutes distinctes avant l'échange (évite deux catégories à la même place)
      const pa = c.position, pb = o.position;
      const r1 = await sb.from("categories").update({ position: pb === pa ? pa + (a === "up" ? -1 : 1) : pb }).eq("id", c.id);
      const r2 = await sb.from("categories").update({ position: pa }).eq("id", o.id);
      if (r1.error || r2.error) return ADM.toast("Déplacement impossible.", "err");
      return load();
    }
    if (a === "del") {
      const n = COUNT[c.id] || 0;
      const msg = n ? `Supprimer "${c.name}" ?\n${n} produit(s) seront conservés mais sans catégorie.` : `Supprimer la catégorie "${c.name}" ?`;
      if (!confirm(msg)) return;
      const { error } = await sb.from("categories").delete().eq("id", c.id);
      if (error) return ADM.toast(error.message, "err");
      ADM.toast("Catégorie supprimée"); load();
    }
  }

  function slugify(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "categorie";
  }
})();
