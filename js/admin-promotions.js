(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc, fmt } = ADM;
  let P = [], tab = "active";
  const SEL = new Set();

  $("#acontent").innerHTML = `
    <div class="head"><h1>Promotions</h1></div>
    <div class="tool">
      <h2>Appliquer une réduction à plusieurs produits</h2>
      <p class="muted" style="margin-top:0">Cochez les produits dans la liste ci-dessous, indiquez le pourcentage, puis appliquez.</p>
      <div class="toolrow">
        <label>Réduction (%)<input id="bpct" type="number" min="1" max="90" step="1" inputmode="numeric" placeholder="Ex : 15"></label>
        <label>Fin de la promotion (facultatif)<input id="bend" type="date"></label>
        <button class="btn" id="bapply">Appliquer aux produits cochés</button>
      </div>
      <p class="hint" style="margin:10px 0 0">Les prix sont arrondis à 25 FCFA inférieurs. <span id="bsel">0 produit coché</span></p>
    </div>
    <div class="chips" id="ptabs"></div>
    <div id="plist"><p class="muted">Chargement…</p></div>`;

  await load();
  $("#bapply").onclick = bulk;

  async function load() {
    const { data, error } = await sb.from("v_products")
      .select("id,name,price,promo_price,promo_ends_at,on_promo,final_price,is_published,cover_url,category_name")
      .order("name").limit(1000);
    if (error) { $("#plist").innerHTML = `<p class="msg err">Erreur : ${esc(error.message)}</p>`; return; }
    P = data || [];
    draw();
  }

  function state(p) { return p.on_promo ? "active" : (p.promo_price ? "expired" : "none"); }

  function draw() {
    const cnt = { active: 0, expired: 0, none: 0, all: P.length };
    P.forEach(p => cnt[state(p)]++);
    $("#ptabs").innerHTML = [["active", "Actives"], ["expired", "Expirées"], ["none", "Sans promotion"], ["all", "Tous"]]
      .map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-k="${k}">${l} (${cnt[k]})</button>`).join("") +
      (cnt.active + cnt.expired ? `<button data-k="__end" style="color:var(--ko)">Terminer toutes les promotions</button>` : "");
    $("#ptabs").querySelectorAll("button").forEach(b => (b.onclick = () => {
      if (b.dataset.k === "__end") return endAll();
      tab = b.dataset.k; draw();
    }));

    const list = P.filter(p => tab === "all" || state(p) === tab);
    $("#plist").innerHTML = list.length ? list.map(p => {
      const st = state(p);
      return `<div class="promrow" data-id="${esc(p.id)}">
        <input type="checkbox" class="chk" aria-label="Cocher ${esc(p.name)}" ${SEL.has(p.id) ? "checked" : ""}>
        <div class="grow"><div class="nm">${esc(p.name)}</div>
          <small class="muted">Prix normal : ${fmt(p.price)}
          ${st === "active" ? ` <span class="pill promo">Active</span>` : st === "expired" ? ` <span class="pill expired">Expirée</span>` : ""}</small></div>
        <div class="inp">
          <input class="pp" type="number" min="1" step="1" inputmode="numeric" placeholder="Prix promo" value="${p.promo_price || ""}" aria-label="Prix promo">
          <input class="pe" type="date" value="${p.promo_ends_at ? dateInput(p.promo_ends_at) : ""}" aria-label="Fin de la promotion">
        </div>
        <div class="acts"><button class="btn sm" data-a="save">Enregistrer</button>
          ${p.promo_price ? '<button class="btn ghost sm" data-a="clear">Retirer</button>' : ""}</div></div>`;
    }).join("") : `<p class="muted-empty">Aucun produit dans cette liste.</p>`;

    $("#plist").querySelectorAll(".promrow").forEach(r => {
      const id = r.dataset.id;
      r.querySelector(".chk").onchange = e => { e.target.checked ? SEL.add(id) : SEL.delete(id); count(); };
      r.querySelectorAll("[data-a]").forEach(b => (b.onclick = () => rowAct(b.dataset.a, id, r)));
    });
    count();
  }

  function count() { $("#bsel").textContent = `${SEL.size} produit${SEL.size > 1 ? "s" : ""} coché${SEL.size > 1 ? "s" : ""}`; }

  async function rowAct(a, id, r) {
    const p = P.find(x => x.id === id);
    let patch;
    if (a === "clear") patch = { promo_price: null, promo_ends_at: null };
    else {
      const v = r.querySelector(".pp").value, d = r.querySelector(".pe").value;
      if (v === "") patch = { promo_price: null, promo_ends_at: null };
      else {
        const promo = parseInt(v, 10);
        if (!(promo > 0 && promo < p.price)) return ADM.toast(`Le prix promo doit être inférieur à ${fmt(p.price)}.`, "err");
        patch = { promo_price: promo, promo_ends_at: d ? endOfDay(d) : null };
      }
    }
    const { error } = await sb.from("products").update(patch).eq("id", id);
    if (error) return ADM.toast(error.message, "err");
    ADM.toast(patch.promo_price ? "Promotion enregistrée" : "Promotion retirée");
    load();
  }

  async function bulk() {
    const pct = parseInt($("#bpct").value, 10), d = $("#bend").value;
    if (!(pct >= 1 && pct <= 90)) return ADM.toast("Indiquez un pourcentage entre 1 et 90.", "err");
    if (!SEL.size) return ADM.toast("Cochez d'abord au moins un produit.", "err");
    if (!confirm(`Appliquer -${pct}% à ${SEL.size} produit(s) ?`)) return;
    const btn = $("#bapply"); btn.disabled = true;
    let ok = 0, skipped = 0;
    for (const id of SEL) {
      const p = P.find(x => x.id === id);
      const promo = Math.floor(p.price * (100 - pct) / 100 / 25) * 25;
      if (!(promo > 0 && promo < p.price)) { skipped++; continue; }
      const { error } = await sb.from("products").update({ promo_price: promo, promo_ends_at: d ? endOfDay(d) : null }).eq("id", id);
      error ? skipped++ : ok++;
    }
    btn.disabled = false; SEL.clear();
    ADM.toast(`${ok} promotion(s) appliquée(s)` + (skipped ? `, ${skipped} ignorée(s)` : ""), skipped && !ok ? "err" : "");
    load();
  }

  async function endAll() {
    if (!confirm("Terminer TOUTES les promotions (actives et expirées) ?")) return;
    const ids = P.filter(p => p.promo_price).map(p => p.id);
    const { error } = await sb.from("products").update({ promo_price: null, promo_ends_at: null }).in("id", ids);
    if (error) return ADM.toast(error.message, "err");
    ADM.toast("Toutes les promotions sont terminées"); load();
  }

  function endOfDay(d) { return new Date(d + "T23:59:59").toISOString(); }
  function dateInput(iso) {
    const d = new Date(iso), z = x => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
})();
