(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc, n } = ADM;
  let days = 30;

  $("#acontent").innerHTML = `
    <div class="head"><h1>Statistiques</h1></div>
    <div class="period" id="period"></div>
    <div id="sbody"><p class="muted">Chargement...</p></div>`;

  load();

  function drawPeriod() {
    $("#period").innerHTML = [[7, "7 jours"], [30, "30 jours"], [90, "90 jours"]]
      .map(([d, l]) => `<button class="${days === d ? "on" : ""}" data-d="${d}">${l}</button>`).join("");
    $("#period").querySelectorAll("button").forEach(b => (b.onclick = () => { days = +b.dataset.d; load(); }));
  }

  async function load() {
    drawPeriod();
    $("#sbody").innerHTML = '<p class="muted">Chargement...</p>';
    const [d, p, s] = await Promise.all([
      sb.rpc("stats_daily", { days }),
      sb.rpc("stats_top_products", { days, lim: 10 }),
      sb.rpc("stats_top_searches", { days, lim: 15 }),
    ]);
    const err = d.error || p.error || s.error;
    if (err) {
      $("#sbody").innerHTML = `<p class="msg err">Impossible de charger les statistiques : ${esc(err.message)}.<br>Avez-vous exécuté step9.sql dans Supabase ?</p>`;
      return;
    }
    const rows = (d.data || []).map(r => ({ day: r.day, views: +r.views, whatsapp: +r.whatsapp, searches: +r.searches, shares: +r.shares, signups: +r.signups }));
    const sum = k => rows.reduce((a, r) => a + r[k], 0);
    const views = sum("views"), wa = sum("whatsapp");
    const conv = views ? Math.round((wa / views) * 1000) / 10 : 0;

    const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const top = p.data || [], maxV = Math.max(1, ...top.map(x => +x.views));
    const terms = s.data || [];

    $("#sbody").innerHTML = `
      <div class="kpis">
        ${kpi(n(views), "Vues de produits")}
        ${kpi(n(wa), "Clics WhatsApp")}
        ${kpi(conv.toString().replace(".", ",") + " %", "Clics WhatsApp par vue")}
        ${kpi(n(sum("searches")), "Recherches")}
        ${kpi(n(sum("shares")), "Partages")}
        ${kpi(n(sum("signups")), "Nouveaux membres")}
      </div>

      <div class="chartbox">
        <h2 style="margin-top:0">Activité par jour</h2>
        ${chart(rows)}
        <div class="legend"><span><i style="background:var(--pr)"></i>Vues</span><span><i style="background:var(--ok)"></i>Clics WhatsApp</span></div>
      </div>

      <div class="panels">
        <div class="panel"><h2>Produits les plus consultés</h2>
          ${top.length ? top.map((x, i) => `<div class="tcell"><span class="rk">${i + 1}</span>
            <div class="grow"><div class="t">${esc(x.product_name)}</div><div class="bar"><i style="width:${(+x.views / maxV) * 100}%"></i></div></div>
            <small>${n(x.views)} vues<br>${n(x.whatsapp)} WhatsApp</small></div>`).join("")
            : '<div class="muted-empty">Aucune donnée sur cette période.</div>'}
        </div>
        <div class="panel"><h2>Ce que cherchent les membres</h2>
          ${terms.length ? terms.map((x, i) => `<div class="tcell"><span class="rk">${i + 1}</span>
            <div class="grow"><div class="t">${esc(x.term)}</div></div>
            ${+x.avg_results === 0 ? '<span class="pill none">Sans résultat</span>' : ""}
            <small>${n(x.searches)} fois</small></div>`).join("")
            : '<div class="muted-empty">Aucune recherche sur cette période.</div>'}
          ${terms.some(x => +x.avg_results === 0) ? '<p class="smallhint">Les recherches « sans résultat » indiquent des produits que vos clients attendent : pensez à les ajouter au catalogue.</p>' : ""}
        </div>
      </div>`;
  }

  /* Graphique SVG : barres = vues, courbe = clics WhatsApp */
  function chart(rows) {
    if (!rows.length) return '<p class="muted-empty">Aucune donnée.</p>';
    const W = 600, H = 220, L = 36, R = 8, T = 10, B = 24;
    const max = Math.max(1, ...rows.map(r => Math.max(r.views, r.whatsapp)));
    const top = Math.ceil(max / 4) * 4, N = rows.length;
    const bw = (W - L - R) / N, ph = H - T - B;
    const y = v => T + ph - (v / top) * ph;
    const dm = d => d.slice(8, 10) + "/" + d.slice(5, 7);

    let g = "";
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i, yy = y(v);
      g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="tx" x="${L - 6}" y="${yy + 4}" text-anchor="end">${v}</text>`;
    }
    const bars = rows.map((r, i) => {
      const h = (r.views / top) * ph;
      return `<rect class="bv" x="${L + i * bw + bw * 0.15}" y="${T + ph - h}" width="${bw * 0.7}" height="${Math.max(h, 0)}" rx="2">
        <title>${dm(r.day)} : ${r.views} vues, ${r.whatsapp} clics WhatsApp</title></rect>`;
    }).join("");
    const pts = rows.map((r, i) => `${L + i * bw + bw / 2},${y(r.whatsapp)}`).join(" ");
    const dots = N <= 31 ? rows.map((r, i) => `<circle class="dw" cx="${L + i * bw + bw / 2}" cy="${y(r.whatsapp)}" r="2.6"/>`).join("") : "";
    const idx = [0, Math.floor((N - 1) / 2), N - 1];
    const xl = [...new Set(idx)].map(i => `<text class="tx" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === N - 1 ? "end" : "middle"}">${dm(rows[i].day)}</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique des vues et clics WhatsApp par jour">${g}${bars}<polyline class="lw" points="${pts}"/>${dots}${xl}</svg>`;
  }
})();
