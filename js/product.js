(async function () {
  const $ = s => document.querySelector(s);
  const { esc, fmt } = BSL;
  const root = $("#pbox");
  let IMGS = [], cur = 0, S = null;

  await BSL.ready;
  const id = new URLSearchParams(location.search).get("id");

  /* ----- Accès réservé aux membres ----- */
  if (!BSL.user) {
    const open = () => {
      BSL.pendingUrl = location.href; // après inscription/connexion : retour sur cette fiche
      BSL.openAuth("signup", "Inscrivez-vous gratuitement pour voir les détails de ce produit.");
    };
    window.PROD = { gate: open };
    root.innerHTML = `<div class="card gate"><h2>🔒 Réservé aux membres</h2>
      <p class="muted">Créez un compte gratuit pour voir les photos, la description, la disponibilité et commander sur WhatsApp.</p>
      <div class="row"><button class="btn" onclick="PROD.gate()">Créer mon compte</button>
      <button class="btn ghost" onclick="BSL.pendingUrl=location.href;BSL.openAuth('login')">J'ai déjà un compte</button></div></div>`;
    open();
    return;
  }

  /* ----- Chargement ----- */
  if (!id) return notFound();
  const { data: p, error } = await sb.from("v_products").select("*").eq("id", id).maybeSingle();
  if (error || !p) return notFound();
  const uid = BSL.user.id;
  const [imgRes, likeRes, favRes] = await Promise.all([
    sb.from("product_images").select("url").eq("product_id", id)
      .order("is_cover", { ascending: false }).order("position"),
    sb.from("product_likes").select("product_id").eq("product_id", id).eq("user_id", uid).maybeSingle(),
    sb.from("product_favorites").select("product_id").eq("product_id", id).eq("user_id", uid).maybeSingle(),
  ]);
  IMGS = (imgRes.data || []).map(i => i.url);
  S = {
    like:  { on: !!likeRes.data, n: p.likes_count || 0,  table: "product_likes" },
    fav:   { on: !!favRes.data,  n: p.favs_count || 0,   table: "product_favorites" },
    share: { n: p.shares_count || 0 },
    view:  { n: p.views_count || 0 },
  };

  document.title = p.name + " — BSL Zénith";
  if (logEvent("view")) S.view.n++;   // cette visite compte (une fois par session)
  render(p);
  loadRelated(p);

  /* ----- Affichage ----- */
  function render(p) {
    const stockMap = {
      in_stock: ["", "Disponible en boutique"],
      low: ["low", "Stock limité" + (p.quantity ? ` (${p.quantity} restant${p.quantity > 1 ? "s" : ""})` : "")],
      out: ["out", "Actuellement en rupture de stock"],
    };
    const [sc, st] = stockMap[p.stock] || stockMap.in_stock;
    const save = p.on_promo ? Math.round((1 - p.final_price / p.price) * 100) : 0;
    const until = p.on_promo && p.promo_ends_at
      ? `<div class="until">Promotion jusqu'au ${new Date(p.promo_ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>` : "";
    const price = p.on_promo
      ? `<span class="big">${fmt(p.final_price)}</span> <span class="old">${fmt(p.price)}</span><span class="save">-${save}%</span>${until}`
      : `<span class="big">${fmt(p.final_price)}</span>`;
    const waLabel = p.stock === "out" ? "💬 Me prévenir sur WhatsApp" : "💬 Commander sur WhatsApp";

    root.innerHTML = `
      <a class="back" href="index.html#produits">← Retour aux produits</a>
      <div class="pgrid">
        <div>
          <div class="gmain" id="gmain">${IMGS.length ? `<img id="gimg" src="${esc(IMGS[0])}" alt="${esc(p.name)}">` : "📦"}
            ${p.on_promo ? '<span class="badge">PROMO</span>' : ""}${p.is_new ? '<span class="badge new">NOUVEAU</span>' : ""}</div>
          ${IMGS.length > 1 ? `<div class="thumbs">${IMGS.map((u, k) =>
            `<button class="th ${k ? "" : "on"}" onclick="PROD.show(${k})" aria-label="Photo ${k + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
          <div class="social" id="social"></div>
        </div>
        <div class="info">
          ${p.is_published ? "" : '<span class="draft">Brouillon — non visible du public</span><br>'}
          <h1>${esc(p.name)}</h1>
          <p class="cat">${esc(p.category_name || "")}</p>
          <div>${price}</div>
          <div class="stock ${sc}"><span class="dot"></span>${st}</div>
          ${p.description ? `<div class="desc">${esc(p.description).replace(/\n/g, "<br>")}</div>` : ""}
          <div class="actions">
            <a class="btn wa" id="waBtn" href="${waUrl(p)}" target="_blank" rel="noopener">${waLabel}</a>
          </div>
        </div>
      </div>
      <section id="rel"></section>`;

    paint();
    $("#waBtn").addEventListener("click", () => logEvent("whatsapp_click"));
    // Balayage tactile de la galerie
    const g = $("#gmain");
    let x0 = null;
    g.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    g.addEventListener("touchend", e => {
      if (x0 === null || IMGS.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) PROD.show((cur + (dx < 0 ? 1 : -1) + IMGS.length) % IMGS.length);
      x0 = null;
    }, { passive: true });
  }

  function waUrl(p) {
    const s = BSL.shop;
    const name = [BSL.profile && BSL.profile.first_name, BSL.profile && BSL.profile.last_name].filter(Boolean).join(" ");
    const msg = `Bonjour BSL Zénith 👋\nJe suis intéressé(e) par : ${p.name} — ${fmt(p.final_price)}\n${location.href}` + (name ? `\nNom : ${name}` : "");
    return s.whatsapp_number
      ? `https://wa.me/${encodeURIComponent(s.whatsapp_number)}?text=${encodeURIComponent(msg)}`
      : (s.whatsapp_link || "#");
  }

  // Barre sociale sous la photo : J'aime / Favori / Partager / vues
  function paint() {
    const el = $("#social");
    if (!el || !S) return;
    el.innerHTML = `
      <button class="sbtn ${S.like.on ? "on" : ""}" onclick="PROD.toggle('like')" aria-pressed="${S.like.on}">
        <span class="ic">${S.like.on ? "❤️" : "🤍"}</span> J'aime <b>${BSL.n(S.like.n)}</b></button>
      <button class="sbtn ${S.fav.on ? "on" : ""}" onclick="PROD.toggle('fav')" aria-pressed="${S.fav.on}">
        <span class="ic">${S.fav.on ? "⭐" : "☆"}</span> Favori <b>${BSL.n(S.fav.n)}</b></button>
      <button class="sbtn" onclick="PROD.share()"><span class="ic">🔗</span> Partager <b>${BSL.n(S.share.n)}</b></button>
      <span class="views">👁 <b>${BSL.n(S.view.n)}</b> vue${S.view.n > 1 ? "s" : ""}</span>`;
  }

  async function toggle(k) {
    const s = S[k];
    if (s.busy) return;
    s.busy = true;
    const was = s.on;
    s.on = !was; s.n += was ? -1 : 1; paint();           // affichage immédiat
    const { error } = was
      ? await sb.from(s.table).delete().eq("user_id", BSL.user.id).eq("product_id", id)
      : await sb.from(s.table).insert({ user_id: BSL.user.id, product_id: id });
    if (error) {                                          // échec : on annule
      s.on = was; s.n += was ? 1 : -1; paint();
      alert("Action impossible pour le moment. Réessayez.");
    }
    s.busy = false;
  }

  // Retourne true si l'événement a bien été enregistré
  function logEvent(type) {
    if (type === "view") {
      try { if (sessionStorage.getItem("v" + id)) return false; sessionStorage.setItem("v" + id, "1"); } catch (e) {}
    }
    sb.from("events").insert({ type, product_id: id }).then(() => {});
    return true;
  }

  async function loadRelated(p) {
    if (!p.category_id) return;
    const { data } = await sb.from("v_products").select("id,name,final_price,price,on_promo,is_new,cover_url,category_name")
      .eq("category_id", p.category_id).eq("is_published", true).neq("id", p.id).limit(4);
    if (!data || !data.length) return;
    $("#rel").innerHTML = `<h2>Dans la même catégorie</h2><div class="grid">${data.map(r => `
      <a class="pcard" href="produit.html?id=${encodeURIComponent(r.id)}">
        <div class="im">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="${esc(r.name)}" loading="lazy">` : "📦"}
          ${r.on_promo ? '<span class="badge">PROMO</span>' : ""}${r.is_new ? '<span class="badge new">NOUVEAU</span>' : ""}</div>
        <div class="b"><span class="n">${esc(r.name)}</span>
          <div><span class="price">${fmt(r.final_price)}</span>${r.on_promo ? `<span class="old">${fmt(r.price)}</span>` : ""}</div></div>
      </a>`).join("")}</div>`;
  }

  function notFound() {
    root.innerHTML = `<div class="card gate"><h2>Produit introuvable</h2>
      <p class="muted">Ce produit n'existe plus ou n'est pas disponible.</p>
      <a class="btn" href="index.html#produits">Voir les produits</a></div>`;
  }

  window.PROD = {
    show(k) {
      cur = k;
      const img = $("#gimg");
      if (img) img.src = IMGS[k];
      document.querySelectorAll(".th").forEach((b, i) => b.classList.toggle("on", i === k));
    },
    toggle,
    async share() {
      const data = { title: document.title, url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); alert("Lien copié !"); }
        logEvent("share"); S.share.n++; paint();          // compté seulement si le partage a abouti
      } catch (e) {}
    },
  };
})();
