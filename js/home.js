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
    const first = BSL.profile && BSL.profile.first_name ? BSL.profile.first_name : "";
    if (BSL.user) {
      $("#heroTitle").textContent = first ? `Bienvenue, ${first} 👋` : "Bienvenue 👋";
      $("#heroText").textContent =
        "Merci de faire partie de BSL Zénith. Découvrez tous nos produits, nos nouveautés et nos promotions, et commandez directement sur WhatsApp.";
    } else {
      $("#heroTitle").innerHTML = "L'énergie et la technologie<br>à votre service";
      $("#heroText").textContent =
        "Solutions d'énergie solaire, électronique, télécommunications et commerce général. Ouvert 24h/24 à Baname.";
    }
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

  const card = BSL.card;

  window.HOME = { tab(t) { TAB = t; renderProducts(); } };
})();
