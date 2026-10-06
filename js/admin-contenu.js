(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc, date } = ADM;
  let tab = "ann", ANN = [], FAQ = [];

  $("#acontent").innerHTML = `
    <div class="head"><h1>Annonces et FAQ</h1></div>
    <div class="tabs2" id="tabs"></div>
    <div id="body"><p class="muted">Chargement...</p></div>`;

  await load();

  async function load() {
    const [a, f] = await Promise.all([
      sb.from("announcements").select("id,title,body,is_published,created_at").order("created_at", { ascending: false }),
      sb.from("faqs").select("id,question,answer,position,is_published").order("position"),
    ]);
    if (a.error || f.error) {
      $("#body").innerHTML = `<p class="msg err">Erreur : ${esc((a.error || f.error).message)}. Avez-vous exécuté step6.sql ?</p>`;
      return;
    }
    ANN = a.data || []; FAQ = f.data || [];
    draw();
  }

  /* ----- Fenêtre de saisie réutilisable ----- */
  function askForm(title, fields, vals) {
    return new Promise(resolve => {
      const m = document.createElement("div");
      m.className = "modal2";
      m.innerHTML = `<div class="mbox"><h2>${esc(title)}</h2><form>${fields.map(f =>
        f.type === "check"
          ? `<label class="chk"><input type="checkbox" name="${f.k}" ${vals[f.k] ? "checked" : ""}> ${esc(f.label)}</label>`
          : `<label>${esc(f.label)}${f.type === "area"
              ? `<textarea name="${f.k}" rows="5" maxlength="${f.max || 2000}" ${f.req ? "required" : ""}>${esc(vals[f.k] || "")}</textarea>`
              : `<input name="${f.k}" maxlength="${f.max || 200}" ${f.req ? "required" : ""} value="${esc(vals[f.k] || "")}">`}</label>`).join("")}
        <div class="formacts"><button type="button" class="btn ghost" data-x>Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form></div>`;
      document.body.appendChild(m);
      const close = v => { m.remove(); resolve(v); };
      m.querySelector("[data-x]").onclick = () => close(null);
      m.addEventListener("click", e => { if (e.target === m) close(null); });
      m.querySelector("form").onsubmit = e => {
        e.preventDefault();
        const out = {};
        fields.forEach(f => (out[f.k] = f.type === "check" ? e.target[f.k].checked : e.target[f.k].value.trim()));
        close(out);
      };
      const first = m.querySelector("input:not([type=checkbox]),textarea");
      if (first) first.focus();
    });
  }
  const fail = (e, msg) => ADM.toast((msg || "Action impossible") + " : " + e.message, "err");

  function draw() {
    $("#tabs").innerHTML = [["ann", `Annonces (${ANN.length})`], ["faq", `FAQ (${FAQ.length})`]]
      .map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("");
    $("#tabs").querySelectorAll("button").forEach(b => (b.onclick = () => { tab = b.dataset.k; draw(); }));
    tab === "ann" ? drawAnn() : drawFaq();
  }

  /* ================= ANNONCES ================= */
  function drawAnn() {
    $("#body").innerHTML = `
      <p class="muted" style="margin-top:0">Les annonces s'affichent dans la section « Nouveautés du site » de l'accueil (les 3 plus récentes).</p>
      <p><button class="btn" id="addA">Nouvelle annonce</button></p>
      ${ANN.length ? ANN.map(a => `<div class="item">
        <div class="grow"><div class="nm">${esc(a.title)}</div>${a.body ? `<p>${esc(a.body)}</p>` : ""}<small>${date(a.created_at)}</small></div>
        <div class="acts">
          <span class="pill ${a.is_published ? "ok" : "draft"}">${a.is_published ? "Publiée" : "Masquée"}</span>
          <button class="btn ghost sm" data-a="edit" data-id="${esc(a.id)}">Modifier</button>
          <button class="btn ghost sm" data-a="pub" data-id="${esc(a.id)}">${a.is_published ? "Masquer" : "Publier"}</button>
          <button class="btn danger sm" data-a="del" data-id="${esc(a.id)}">Supprimer</button>
        </div></div>`).join("") : '<p class="muted-empty">Aucune annonce.</p>'}`;
    $("#addA").onclick = addAnn;
    $("#body").querySelectorAll("[data-a]").forEach(b => (b.onclick = () => actAnn(b.dataset.a, ANN.find(x => x.id === b.dataset.id))));
  }
  const ANN_FIELDS = [
    { k: "title", label: "Titre", req: true, max: 120 },
    { k: "body", label: "Texte (facultatif)", type: "area", max: 600 },
    { k: "is_published", label: "Visible sur le site", type: "check" },
  ];
  async function addAnn() {
    const v = await askForm("Nouvelle annonce", ANN_FIELDS, { is_published: true });
    if (!v) return;
    const { error } = await sb.from("announcements").insert({ title: v.title, body: v.body || null, is_published: v.is_published });
    if (error) return fail(error);
    ADM.toast("Annonce ajoutée."); await load();
  }
  async function actAnn(a, x) {
    if (a === "edit") {
      const v = await askForm("Modifier l'annonce", ANN_FIELDS, x);
      if (!v) return;
      const { error } = await sb.from("announcements").update({ title: v.title, body: v.body || null, is_published: v.is_published }).eq("id", x.id);
      if (error) return fail(error);
      ADM.toast("Annonce modifiée.");
    } else if (a === "pub") {
      const { error } = await sb.from("announcements").update({ is_published: !x.is_published }).eq("id", x.id);
      if (error) return fail(error);
    } else if (a === "del") {
      if (!confirm("Supprimer cette annonce ?")) return;
      const { error } = await sb.from("announcements").delete().eq("id", x.id);
      if (error) return fail(error);
      ADM.toast("Annonce supprimée.");
    }
    await load();
  }

  /* ================= FAQ ================= */
  function drawFaq() {
    $("#body").innerHTML = `
      <p class="muted" style="margin-top:0">Ces questions s'affichent sur la page FAQ, dans l'ordre ci-dessous.</p>
      <p><button class="btn" id="addF">Nouvelle question</button></p>
      ${FAQ.length ? FAQ.map((f, i) => `<div class="item">
        <div class="grow"><div class="nm">${esc(f.question)}</div><p>${esc(f.answer)}</p></div>
        <div class="acts">
          <span class="pill ${f.is_published ? "ok" : "draft"}">${f.is_published ? "Publiée" : "Masquée"}</span>
          <button class="btn ghost sm" data-a="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>Monter</button>
          <button class="btn ghost sm" data-a="down" data-i="${i}" ${i === FAQ.length - 1 ? "disabled" : ""}>Descendre</button>
          <button class="btn ghost sm" data-a="edit" data-i="${i}">Modifier</button>
          <button class="btn ghost sm" data-a="pub" data-i="${i}">${f.is_published ? "Masquer" : "Publier"}</button>
          <button class="btn danger sm" data-a="del" data-i="${i}">Supprimer</button>
        </div></div>`).join("") : '<p class="muted-empty">Aucune question.</p>'}`;
    $("#addF").onclick = addFaq;
    $("#body").querySelectorAll("[data-a]").forEach(b => (b.onclick = () => actFaq(b.dataset.a, +b.dataset.i)));
  }
  const FAQ_FIELDS = [
    { k: "question", label: "Question", req: true, max: 200 },
    { k: "answer", label: "Réponse", type: "area", req: true, max: 1200 },
    { k: "is_published", label: "Visible sur le site", type: "check" },
  ];
  async function addFaq() {
    const v = await askForm("Nouvelle question", FAQ_FIELDS, { is_published: true });
    if (!v) return;
    const pos = FAQ.reduce((m, f) => Math.max(m, f.position), 0) + 1;
    const { error } = await sb.from("faqs").insert({ question: v.question, answer: v.answer, is_published: v.is_published, position: pos });
    if (error) return fail(error);
    ADM.toast("Question ajoutée."); await load();
  }
  async function actFaq(a, i) {
    const f = FAQ[i];
    if (a === "edit") {
      const v = await askForm("Modifier la question", FAQ_FIELDS, f);
      if (!v) return;
      const { error } = await sb.from("faqs").update({ question: v.question, answer: v.answer, is_published: v.is_published }).eq("id", f.id);
      if (error) return fail(error);
      ADM.toast("Question modifiée.");
    } else if (a === "pub") {
      const { error } = await sb.from("faqs").update({ is_published: !f.is_published }).eq("id", f.id);
      if (error) return fail(error);
    } else if (a === "del") {
      if (!confirm("Supprimer cette question ?")) return;
      const { error } = await sb.from("faqs").delete().eq("id", f.id);
      if (error) return fail(error);
      ADM.toast("Question supprimée.");
    } else if (a === "up" || a === "down") {
      const j = a === "up" ? i - 1 : i + 1, g = FAQ[j];
      if (!g) return;
      // Échange de position avec la voisine ; si égales, on les sépare
      const pf = f.position, pg = g.position === f.position ? f.position + (a === "up" ? -1 : 1) : g.position;
      const r1 = await sb.from("faqs").update({ position: pg }).eq("id", f.id);
      const r2 = await sb.from("faqs").update({ position: pf }).eq("id", g.id);
      if (r1.error || r2.error) return fail(r1.error || r2.error);
    }
    await load();
  }
})();
