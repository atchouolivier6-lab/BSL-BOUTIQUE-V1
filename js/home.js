(async function () {
  const $ = s => document.querySelector(s);
  const { esc, fmt } = BSL;
  let ALL = [], TAB = "all";

  await BSL.ready;
  renderHero();
  document.addEventListener("bsl-auth", () => { renderHero(); renderProducts(); });
  load();

  function renderHero() {
    const wa = BSL.shop.whatsapp_link || "#";
    $("#heroBtns").innerHTML = BSL.user
      ? `<a class="btn" href="#produits">Voir les produits</a>
         <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`
      : `<button class="btn" onclick="BSL.openAuth('signup')">Créer mon compte gratuit</button>
         <a class="btn ghost" href="#produits">Voir les produits</a>`;
    $("#heroNote").textContent = BSL.user
      ? "Vous avez accès à toute la plateforme."
      : "Parcourez nos produits. L'inscription gratuite vous donne accès à tous les détails.";
  }

  async function load() {
    const [a, p] = await Promise.all([
      sb.from("announcements").select("title,body,created_at").eq("is_published", true)
        .order("created_at", { ascending: false }).limit(3),
      sb.from("v_teaser").select("*").order("created_at", { ascending: false }),
    ]);
    renderNews(a.data || []);
    if (p.error) { $("#plist").innerHTML = `<p class="empty">Impossible de charger les produits.</p>`; return; }
    ALL = p.data || [];
    renderProducts();
  }

  function renderNews(list) {
    const sec = $("#newsSec");
    if (!list.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $("#news").innerHTML = list.map(n =>
      `<div class="card"><h3>${esc(n.title)}</h3><p style="margin:0 0 6px">${esc(n.body || "")}</p>
       <small>${new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</small></div>`
    ).join("");
  }

  function renderProducts() {
    const counts = { all: ALL.length, new: ALL.filter(p => p.is_new).length, promo: ALL.filter(p => p.on_promo).length };
    $("#tabs").innerHTML = [["all", "Tous"], ["new", "Nouveautés"], ["promo", "Promotions"]]
      .map(t => `<button class="${TAB === t[0] ? "on" : ""}" onclick="HOME.tab('${t[0]}')">${t[1]} (${counts[t[0]]})</button>`).join("");
    const list = ALL.filter(p => TAB === "all" || (TAB === "new" ? p.is_new : p.on_promo));
    $("#plist").innerHTML = list.length
      ? `<div class="grid">${list.map(card).join("")}</div>`
      : `<p class="empty">Aucun produit pour le moment.</p>`;
  }

  function card(p) {
    const img = p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.name)}" loading="lazy">` : "📦";
    const price = p.on_promo
      ? `<span class="price">${fmt(p.final_price)}</span><span class="old">${fmt(p.old_price)}</span>`
      : `<span class="price">${fmt(p.final_price)}</span>`;
    return `<button class="pcard" onclick="BSL.openProduct('${esc(p.id)}')">
      <div class="im">${img}${p.on_promo ? '<span class="badge">PROMO</span>' : ""}${p.is_new ? '<span class="badge new">NOUVEAU</span>' : ""}</div>
      <div class="b"><span class="n">${esc(p.name)}</span><span class="c">${esc(p.category_name || "")}</span>
      <div>${price}</div>${BSL.user ? "" : '<span class="lock">🔒 Détails après inscription</span>'}</div></button>`;
  }

  window.HOME = { tab(t) { TAB = t; renderProducts(); } };
})();
