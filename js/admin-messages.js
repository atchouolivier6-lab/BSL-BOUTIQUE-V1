(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  const { esc } = ADM;
  let ALL = [], filter = "unread", openId = null;

  $("#acontent").innerHTML = `
    <h1>Messages</h1>
    <div class="tools"><input id="mq" type="search" placeholder="Rechercher un message ou un nom..." autocomplete="off"></div>
    <div class="chips" id="mchips"></div>
    <div id="mlist"><p class="muted">Chargement...</p></div>`;

  const r = await sb.from("messages").select("id,name,contact,body,is_read,is_done,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (r.error) { $("#mlist").innerHTML = `<p class="msg err">Erreur : ${esc(r.error.message)}</p>`; return; }
  ALL = r.data || [];
  $("#mq").addEventListener("input", draw);
  $("#mlist").addEventListener("click", onClick);
  draw();

  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function when(d) { return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

  function intl(digits) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits.startsWith("229") ? digits : "229" + digits;
  }
  function replyButtons(m) {
    const c = (m.contact || "").trim();
    const first = (m.name || "").trim().split(" ")[0];
    const hello = `Bonjour ${first}, merci pour votre message à BSL La Puissance Zénith. `;
    if (c.includes("@"))
      return `<a class="btn sm" href="mailto:${esc(c)}?subject=${encodeURIComponent("Réponse à votre message")}&body=${encodeURIComponent(hello)}">Répondre par e-mail</a>`;
    const d = c.replace(/\D/g, "");
    if (d.length >= 8) {
      const num = intl(d);
      return `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent(hello)}">Répondre sur WhatsApp</a>
              <a class="btn ghost sm" href="tel:+${num}">Appeler</a>`;
    }
    return "";
  }

  function updateBadge() {
    const n = ALL.filter(m => !m.is_read).length, d = $("#unread");
    if (d) { d.hidden = !n; d.textContent = n; }
  }

  function draw() {
    const cnt = { unread: ALL.filter(m => !m.is_read).length, todo: ALL.filter(m => !m.is_done).length, done: ALL.filter(m => m.is_done).length, all: ALL.length };
    $("#mchips").innerHTML = [["unread", "Non lus"], ["todo", "À traiter"], ["done", "Traités"], ["all", "Tous"]]
      .map(([k, l]) => `<button class="${filter === k ? "on" : ""}" data-k="${k}">${l} (${cnt[k]})</button>`).join("");
    $("#mchips").querySelectorAll("button").forEach(b => (b.onclick = () => { filter = b.dataset.k; draw(); }));

    const q = norm($("#mq").value).trim();
    const list = ALL.filter(m =>
      (filter === "all" || (filter === "unread" && !m.is_read) || (filter === "todo" && !m.is_done) || (filter === "done" && m.is_done)) &&
      (!q || norm((m.name || "") + " " + (m.contact || "") + " " + m.body).includes(q)));

    $("#mlist").innerHTML = list.length ? list.map(m => {
      const open = openId === m.id;
      return `<div class="msgc ${m.is_read ? "" : "unread"}">
        <div class="msgh" data-open="${esc(m.id)}">
          <div class="grow"><div class="nm">${esc(m.name || "Anonyme")}</div><small>${esc(m.body.replace(/\s+/g, " ").slice(0, 90))}</small></div>
          ${m.is_done ? '<span class="pill ok">Traité</span>' : (m.is_read ? "" : '<span class="pill promo">Nouveau</span>')}
          <small>${when(m.created_at)}</small>
        </div>
        ${open ? `<div class="msgb"><p>${esc(m.body)}</p>
          <div class="btns">${replyButtons(m)}
            <button class="btn ghost sm" data-act="done" data-id="${esc(m.id)}">${m.is_done ? "Rouvrir" : "Marquer traité"}</button>
            <button class="btn ghost sm" data-act="read" data-id="${esc(m.id)}">${m.is_read ? "Marquer non lu" : "Marquer lu"}</button>
            <button class="btn danger sm" data-act="del" data-id="${esc(m.id)}">Supprimer</button></div>
          <div class="meta">Contact : ${esc(m.contact || "non renseigné")}</div></div>` : ""}
      </div>`;
    }).join("") : `<p class="muted-empty">${filter === "unread" ? "Aucun message non lu." : "Aucun message."}</p>`;
    updateBadge();
  }

  async function patch(m, fields) {
    const { error } = await sb.from("messages").update(fields).eq("id", m.id);
    if (error) return ADM.toast("Action impossible : " + error.message, "err");
    Object.assign(m, fields);
    draw();
  }

  async function onClick(e) {
    const head = e.target.closest("[data-open]");
    if (head) {
      const m = ALL.find(x => x.id === head.dataset.open);
      openId = openId === m.id ? null : m.id;
      if (openId && !m.is_read) return patch(m, { is_read: true });   // ouvrir = lu
      return draw();
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const m = ALL.find(x => x.id === b.dataset.id);
    if (b.dataset.act === "read") return patch(m, { is_read: !m.is_read });
    if (b.dataset.act === "done") return patch(m, { is_done: !m.is_done, is_read: true });
    if (b.dataset.act === "del") {
      if (!confirm("Supprimer définitivement ce message ?")) return;
      const { error } = await sb.from("messages").delete().eq("id", m.id);
      if (error) return ADM.toast("Suppression impossible : " + error.message, "err");
      ALL = ALL.filter(x => x.id !== m.id); openId = null;
      ADM.toast("Message supprimé.");
      draw();
    }
  }
})();
