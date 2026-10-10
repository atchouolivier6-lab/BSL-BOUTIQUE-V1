(async function () {
  const $ = s => document.querySelector(s);
  const { esc, fmt } = BSL;
  const box = $("#cbox");
  let ITEMS = [];

  await BSL.ready;
  document.title = "Mon panier - BSL Zénith";

  /* ----- Réservé aux membres : le panier est enregistré sur le compte ----- */
  if (!BSL.user) {
    box.innerHTML = `<div class="card gate2" style="max-width:480px;margin:40px auto"><h2 style="margin-top:0">Mon panier</h2>
      <p class="muted">Créez un compte gratuit ou connectez-vous : votre panier est enregistré sur votre compte et vous le retrouvez à chaque visite, sur votre téléphone ou un autre appareil.</p>
      <button class="btn" onclick="BSL.openAuth('signup')">Créer mon compte</button>
      <button class="btn ghost" onclick="BSL.openAuth('login')">Connexion</button></div>`;
    document.addEventListener("bsl-auth", () => location.reload());
    return;
  }

  box.addEventListener("click", onClick);
  await load();

  async function load() {
    const r = await sb.from("cart_items").select("product_id,quantity,added_at")
      .eq("user_id", BSL.user.id).order("added_at", { ascending: false });
    if (r.error) { box.innerHTML = `<p class="msg err">Impossible de charger le panier : ${esc(r.error.message)}. Avez-vous exécuté step11.sql ?</p>`; return; }
    const rows = r.data || [];
    let prods = [];
    if (rows.length) {
      const pr = await sb.from("v_products")
        .select("id,name,price,final_price,on_promo,stock,quantity,cover_url,category_name")
        .in("id", rows.map(x => x.product_id)).eq("is_published", true);
      prods = pr.data || [];
    }
    ITEMS = rows.map(x => ({ id: x.product_id, qty: x.quantity, p: prods.find(p => p.id === x.product_id) || null }));
    BSL.setCartCount(ITEMS.length);
    render();
  }

  function avail() { return ITEMS.filter(i => i.p); }
  function total() { return avail().reduce((a, i) => a + Number(i.p.final_price) * i.qty, 0); }
  function units() { return avail().reduce((a, i) => a + i.qty, 0); }

  function waUrl() {
    const s = BSL.shop;
    const name = [BSL.profile && BSL.profile.first_name, BSL.profile && BSL.profile.last_name].filter(Boolean).join(" ");
    const lines = avail().map((i, k) =>
      `${k + 1}. ${i.p.name} x${i.qty} - ${fmt(Number(i.p.final_price) * i.qty)}` + (i.p.stock === "out" ? " (rupture annoncée)" : ""));
    const msg = `Bonjour BSL Zénith,\nJe souhaite discuter de ma commande :\n${lines.join("\n")}\n\nTotal estimé : ${fmt(total())}` + (name ? `\nNom : ${name}` : "");
    return s.whatsapp_number
      ? `https://wa.me/${encodeURIComponent(s.whatsapp_number)}?text=${encodeURIComponent(msg)}`
      : (s.whatsapp_link || "#");
  }

  function lineHtml(i) {
    if (!i.p) {
      return `<div class="citem cgone" data-id="${esc(i.id)}"><div class="cimg">Indisponible</div>
        <div><div class="cname">Ce produit n'est plus disponible</div><div class="cmeta">Il a été retiré du catalogue.</div></div>
        <div class="crow"><span></span><button class="btn ghost sm" data-act="rm">Retirer</button></div></div>`;
    }
    const p = i.p, href = "produit.html?id=" + encodeURIComponent(p.id);
    const price = p.on_promo
      ? `<span class="price">${fmt(p.final_price)}</span><span class="old">${fmt(p.price)}</span>`
      : `<span class="price">${fmt(p.final_price)}</span>`;
    const note = p.stock === "out" ? '<div class="cnote out">Rupture de stock annoncée : confirmez avec la boutique</div>'
      : p.stock === "low" ? '<div class="cnote low">Stock limité</div>' : "";
    return `<div class="citem" data-id="${esc(p.id)}">
      <a class="cimg" href="${href}">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.name)}" loading="lazy">` : "Pas de photo"}</a>
      <div><a class="cname" href="${href}">${esc(p.name)}</a><div class="cmeta">${esc(p.category_name || "")}</div><div>${price}</div>${note}</div>
      <div class="crow">
        <div class="cqty"><button data-act="dec" aria-label="Diminuer" ${i.qty <= 1 ? "disabled" : ""}>-</button><span>${i.qty}</span><button data-act="inc" aria-label="Augmenter" ${i.qty >= 99 ? "disabled" : ""}>+</button></div>
        <span class="ctotal">${fmt(Number(p.final_price) * i.qty)}</span>
        <button class="btn ghost sm" data-act="rm">Retirer</button>
      </div></div>`;
  }

  function render() {
    if (!ITEMS.length) {
      box.innerHTML = `<div class="cwrap"><h1>Mon panier</h1><div class="card cempty"><h2>Votre panier est vide</h2>
        <p class="muted">Ajoutez des produits depuis le catalogue pour les retrouver ici et discuter de votre commande avec la boutique.</p>
        <a class="btn" href="catalogue.html">Voir le catalogue</a></div></div>`;
      return;
    }
    const n = avail().length;
    box.innerHTML = `<div class="cwrap"><h1>Mon panier</h1>
      <div class="muted">${ITEMS.length} produit${ITEMS.length > 1 ? "s" : ""} enregistré${ITEMS.length > 1 ? "s" : ""} sur votre compte</div>
      <div class="clayout">
        <div id="clines">${ITEMS.map(lineHtml).join("")}</div>
        <aside class="card csum"><h2>Récapitulatif</h2>
          <div class="srow"><span>Produits</span><b>${n}</b></div>
          <div class="srow"><span>Quantité totale</span><b>${units()}</b></div>
          <div class="srow big"><span>Total estimé</span><span>${fmt(total())}</span></div>
          ${n ? `<a class="btn wa" id="waOrder" href="${waUrl()}" target="_blank" rel="noopener">Discuter de ma commande sur WhatsApp</a>` : ""}
          <a class="btn ghost" href="catalogue.html">Continuer mes achats</a>
          <button class="btn ghost" data-act="clear" type="button">Vider le panier</button>
          <p class="chint">Aucun paiement en ligne. Les prix sont indicatifs : la boutique confirme prix et disponibilité avec vous sur WhatsApp.</p>
        </aside></div></div>`;
    const wa = $("#waOrder");
    if (wa) wa.addEventListener("click", () => {
      const rows = avail().slice(0, 20).map(i => ({ type: "whatsapp_click", product_id: i.id }));
      if (rows.length) sb.from("events").insert(rows).then(() => {});
    });
  }

  async function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "clear") {
      if (!confirm("Vider tout le panier ?")) return;
      const { error } = await sb.from("cart_items").delete().eq("user_id", BSL.user.id);
      if (error) return BSL.toast("Action impossible, réessayez.");
      ITEMS = []; BSL.setCartCount(0); render(); return;
    }
    const row = b.closest(".citem");
    const it = ITEMS.find(x => x.id === row.dataset.id);
    if (!it) return;
    if (act === "rm") {
      const { error } = await sb.from("cart_items").delete().eq("user_id", BSL.user.id).eq("product_id", it.id);
      if (error) return BSL.toast("Action impossible, réessayez.");
      ITEMS = ITEMS.filter(x => x !== it); BSL.setCartCount(ITEMS.length); render(); return;
    }
    if (act === "inc" || act === "dec") {
      const q = Math.max(1, Math.min(99, it.qty + (act === "inc" ? 1 : -1)));
      if (q === it.qty) return;
      const old = it.qty;
      it.qty = q; render();                                   // affichage immédiat
      const { error } = await sb.from("cart_items").update({ quantity: q }).eq("user_id", BSL.user.id).eq("product_id", it.id);
      if (error) { it.qty = old; render(); BSL.toast("Action impossible, réessayez."); }
    }
  }
})();
