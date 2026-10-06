(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc, n, date } = ADM;
  const c = $("#acontent");
  c.innerHTML = `<h1>Dashboard</h1><div class="kpis" id="kpis"><p class="muted">Chargement…</p></div><div class="panels" id="panels"></div>`;

  const cnt = (t, f) => { let q = sb.from(t).select("*", { count: "exact", head: true }); return f ? f(q) : q; };
  const [prodRes, unread, wa, searches, members, msgsRes, recent] = await Promise.all([
    sb.from("v_products").select("id,name,stock,quantity,is_published,on_promo,views_count,likes_count,favs_count,shares_count").limit(1000),
    cnt("messages", q => q.eq("is_read", false)),
    cnt("events", q => q.eq("type", "whatsapp_click")),
    cnt("events", q => q.eq("type", "search")),
    ADM.isAdmin ? cnt("profiles") : Promise.resolve({ count: null }),
    sb.from("messages").select("name,body,created_at,is_read").order("created_at", { ascending: false }).limit(4),
    ADM.isAdmin ? sb.from("profiles").select("first_name,last_name,email,role,created_at").order("created_at", { ascending: false }).limit(5)
                : Promise.resolve({ data: [] }),
  ]);
  if (prodRes.error) {
    $("#kpis").innerHTML = `<p class="msg err">Impossible de charger les données : ${esc(prodRes.error.message)}</p>`;
    return;
  }
  const P = prodRes.data || [];
  const sum = k => P.reduce((a, p) => a + (p[k] || 0), 0);
  const low = P.filter(p => p.stock === "low"), out = P.filter(p => p.stock === "out");

  const kpi = (v, l, href, warn) =>
    `<${href ? `a href="${href}"` : "div"} class="kpi ${warn ? "warn" : ""}"><div class="v">${v}</div><div class="l">${l}</div></${href ? "a" : "div"}>`;
  $("#kpis").innerHTML = [
    kpi(`${P.filter(p => p.is_published).length}<small class="muted" style="font-size:14px"> / ${P.length}</small>`, "Produits publiés", "admin-produits.html"),
    kpi(P.filter(p => p.on_promo).length, "Promotions actives", "admin-promotions.html"),
    kpi(out.length, "En rupture", "admin-produits.html", out.length > 0),
    kpi(low.length, "Stock limité"),
    kpi(n(sum("views_count")), "Vues totales"),
    kpi(n(sum("likes_count")), "J'aime"),
    kpi(n(wa.count), "Clics WhatsApp"),
    kpi(n(searches.count), "Recherches"),
    kpi(n(unread.count), "Messages non lus", null, unread.count > 0),
    ADM.isAdmin ? kpi(n(members.count), "Membres inscrits", "admin-membres.html") : "",
  ].join("");

  /* Panneaux */
  const top = [...P].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);
  const max = Math.max(1, ...(top.map(p => p.views_count || 0)));
  const panels = [];

  panels.push(`<div class="panel"><h2>Produits les plus vus</h2>${
    top.length && max > 0 && top[0].views_count
      ? top.map(p => `<div class="row2"><div class="grow"><div class="t">${esc(p.name)}</div>
          <div class="bar"><i style="width:${(p.views_count || 0) / max * 100}%"></i></div></div>
          <small>${n(p.views_count)} vues · ${n(p.likes_count)} j'aime</small></div>`).join("")
      : '<div class="muted-empty">Pas encore de visites.</div>'}</div>`);

  const alerts = [...out, ...low].slice(0, 6);
  panels.push(`<div class="panel"><h2>Alertes stock</h2>${
    alerts.length
      ? alerts.map(p => `<div class="row2"><div class="grow t">${esc(p.name)}</div>
          <span class="pill ${p.stock}">${p.stock === "out" ? "Rupture" : "Limité" + (p.quantity != null ? " (" + p.quantity + ")" : "")}</span></div>`).join("")
      : '<div class="muted-empty">Aucun problème de stock.</div>'}</div>`);

  const msgs = msgsRes.data || [];
  panels.push(`<div class="panel"><h2>Derniers messages</h2>${
    msgs.length
      ? msgs.map(m => `<div class="row2"><div class="grow"><div class="t">${m.is_read ? "" : "(nouveau) "}${esc(m.name || "Anonyme")}</div>
          <small>${esc((m.body || "").slice(0, 70))}${(m.body || "").length > 70 ? "…" : ""}</small></div><small>${date(m.created_at)}</small></div>`).join("")
      : '<div class="muted-empty">Aucun message pour le moment.</div>'}</div>`);

  if (ADM.isAdmin) {
    const R = { admin: "Admin", staff: "Employé", member: "Membre" };
    const rec = recent.data || [];
    panels.push(`<div class="panel"><h2>Derniers inscrits</h2>${
      rec.length
        ? rec.map(m => `<div class="row2"><div class="grow"><div class="t">${esc((m.first_name + " " + m.last_name).trim() || m.email)}</div>
            <small>${date(m.created_at)}</small></div><span class="pill ${m.role}">${R[m.role]}</span></div>`).join("")
        : '<div class="muted-empty">Aucun inscrit.</div>'}
      <p style="margin:12px 0 0"><a class="btn ghost sm" href="admin-membres.html">Gérer les membres</a></p></div>`);
  }
  $("#panels").innerHTML = panels.join("");
})();
