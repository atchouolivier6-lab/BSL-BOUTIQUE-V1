(async function () {
  const $ = s => document.querySelector(s);
  const PRESET = new URLSearchParams(location.search).get("f") || "";   // "", new, promo, fav
  const TITLES = {
    "": ["Catalogue", "Tous nos produits"],
    new: ["Nouveautés", "Les derniers arrivages"],
    promo: ["Promotions", "Les bonnes affaires du moment"],
    fav: ["Mes favoris", "Les produits que vous avez enregistrés"],
  };
  const PAGE = 12;
  let ALL = [], FAVS = new Set(), cat = "", shown = PAGE, searchTimer = null, logTimer = null;

  await BSL.ready;
  const [title, sub] = TITLES[PRESET] || TITLES[""];
  $("#ctitle").textContent = title;
  $("#csub").textContent = sub;
  document.title = title + " — BSL Zénith";
  document.addEventListener("bsl-auth", () => location.reload());

  /* ----- Favoris : réservé aux membres ----- */
  if (PRESET === "fav" && !BSL.user) {
    $("#ctools").hidden = true;
    $("#clist").innerHTML = `<div class="card catgate"><h2>⭐ Vos favoris</h2>
      <p class="muted">Connectez-vous pour retrouver ici les produits que vous avez enregistrés.</p>
      <button class="btn" onclick="BSL.openAuth('signup')">Créer mon compte</button>
      <button class="btn ghost" onclick="BSL.openAuth('login')">Connexion</button></div>`;
    BSL.openAuth("signup", "Inscrivez-vous pour enregistrer vos produits favoris.");
    return;
  }

  /* ----- Chargement ----- */
  // Membre : vue complète (stock, description). Visiteur : aperçu public.
  const logged = !!BSL.user;
  const query = logged
    ? sb.from("v_products")
        .select("id,name,description,category_name,price,final_price,on_promo,is_new,stock,cover_url,created_at,views_count,likes_count")
        .eq("is_published", true)
    : sb.from("v_teaser").select("*");
  const [prod, cats, favs] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(500),
    sb.from("categories").select("name").order("position"),
    logged ? sb.from("product_favorites").select("product_id").eq("user_id", BSL.user.id) : Promise.resolve({ data: [] }),
  ]);
  if (prod.error) { $("#clist").innerHTML = `<p class="empty">Impossible de charger les produits.</p>`; return; }
  ALL = prod.data || [];
  FAVS = new Set((favs.data || []).map(f => f.product_id));

  /* ----- Interface ----- */
  renderChips(cats.data || []);
  if (!logged) $("#wStock").hidden = true;
  if (PRESET === "new") $("#wNew").hidden = true;
  if (PRESET === "promo") $("#wPromo").hidden = true;

  $("#q").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { shown = PAGE; apply(); }, 150); });
  ["#sort", "#pmin", "#pmax", "#fPromo", "#fNew", "#fStock"].forEach(s =>
    $(s).addEventListener("input", () => { shown = PAGE; apply(); }));
  $("#ftoggle").onclick = () => { const p = $("#fpanel"); p.hidden = !p.hidden; };
  $("#more").onclick = () => { shown += PAGE; apply(); };
  $("#freset").onclick = () => {
    $("#q").value = ""; $("#pmin").value = ""; $("#pmax").value = "";
    ["#fPromo", "#fNew", "#fStock"].forEach(s => ($(s).checked = false));
    cat = ""; renderChips(cats.data || []); shown = PAGE; apply();
  };
  apply();

  /* ----- Recherche tolérante : accents, majuscules, petites fautes ----- */
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 9;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function matches(p, q) {
    const hay = norm(p.name + " " + (p.category_name || "") + " " + (p.description || ""));
    const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
    return q.split(/\s+/).filter(Boolean).every(t =>
      hay.includes(t) || (t.length >= 4 && words.some(w => lev(t, w) <= (t.length >= 7 ? 2 : 1))));
  }

  /* ----- Filtrage, tri, affichage ----- */
  function apply() {
    const q = norm($("#q").value).trim();
    const min = +$("#pmin").value || 0, max = +$("#pmax").value || Infinity;
    const onlyPromo = PRESET === "promo" || $("#fPromo").checked;
    const onlyNew = PRESET === "new" || $("#fNew").checked;
    const onlyStock = $("#fStock").checked;

    const list = ALL.filter(p =>
      (PRESET !== "fav" || FAVS.has(p.id)) &&
      (!cat || p.category_name === cat) &&
      (!onlyPromo || p.on_promo) && (!onlyNew || p.is_new) &&
      (!onlyStock || p.stock !== "out") &&
      p.final_price >= min && p.final_price <= max &&
      (!q || matches(p, q)));

    const sorts = {
      recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      price_asc: (a, b) => a.final_price - b.final_price,
      price_desc: (a, b) => b.final_price - a.final_price,
      popular: (a, b) => (b.likes_count || 0) - (a.likes_count || 0) || (b.views_count || 0) - (a.views_count || 0),
      views: (a, b) => (b.views_count || 0) - (a.views_count || 0),
    };
    list.sort(sorts[$("#sort").value] || sorts.recent);

    $("#count").textContent = `${list.length} produit${list.length > 1 ? "s" : ""}`;
    $("#clist").innerHTML = list.length
      ? `<div class="grid">${list.slice(0, shown).map(BSL.card).join("")}</div>`
      : `<p class="empty">${PRESET === "fav" ? "Aucun favori pour le moment. Ouvrez un produit et appuyez sur ☆ Favori."
        : q ? "Aucun résultat. Essayez un autre mot." : "Aucun produit pour le moment."}</p>`;
    $("#more").hidden = list.length <= shown;
    logSearch(q, list.length);
  }

  // Enregistre ce que les membres cherchent (utile pour les statistiques admin)
  function logSearch(q, n) {
    clearTimeout(logTimer);
    if (!logged || q.length < 3) return;
    logTimer = setTimeout(() => sb.from("events").insert({ type: "search", meta: { q, results: n } }).then(() => {}), 1500);
  }

  function renderChips(categories) {
    const names = ["", ...categories.map(c => c.name)];
    $("#chips").innerHTML = names.map(n =>
      `<button class="${cat === n ? "on" : ""}" data-c="${BSL.esc(n)}">${n ? BSL.esc(n) : "Toutes"}</button>`).join("");
    $("#chips").querySelectorAll("button").forEach(b => (b.onclick = () => {
      cat = b.dataset.c; shown = PAGE; renderChips(categories); apply();
    }));
  }
})();
