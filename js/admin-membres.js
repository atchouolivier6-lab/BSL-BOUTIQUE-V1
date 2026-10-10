(async function () {
  const $ = s => document.querySelector(s);
  if (!(await ADM.ready)) return;
  if (!ADM.requireAdmin()) return;
  const { esc, date } = ADM;
  const ROLES = { member: "Membre", staff: "Employé", admin: "Admin" };
  let ALL = [], filter = "all";

  $("#acontent").innerHTML = `
    <h1>Membres</h1>
    <div class="help">
      <div><b>Membre</b><br>Voit tous les produits, aime, met en favoris et commande.</div>
      <div><b>Employé</b><br>Comme un membre, et gère les produits, catégories, promotions, annonces et messages.</div>
      <div><b>Admin</b><br>Tout, plus la gestion des membres et les paramètres.</div>
    </div>
    <div class="tools"><input id="mq" type="search" placeholder="Rechercher par nom ou e-mail…" autocomplete="off"></div>
    <div class="chips" id="mchips"></div>
    <div id="mlist"><p class="muted">Chargement…</p></div>`;

  const { data, error } = await sb.from("profiles")
    .select("id,first_name,last_name,email,role,created_at,avatar_url").order("created_at", { ascending: false }).limit(1000);
  if (error) { $("#mlist").innerHTML = `<p class="msg err">Erreur : ${esc(error.message)}</p>`; return; }
  ALL = data || [];
  $("#mq").addEventListener("input", draw);
  draw();

  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function fullName(m) { return ((m.first_name || "") + " " + (m.last_name || "")).trim(); }

  function draw() {
    const counts = { all: ALL.length, admin: 0, staff: 0, member: 0 };
    ALL.forEach(m => counts[m.role]++);
    $("#mchips").innerHTML = [["all", "Tous"], ["admin", "Admins"], ["staff", "Employés"], ["member", "Membres"]]
      .map(([k, l]) => `<button class="${filter === k ? "on" : ""}" data-k="${k}">${l} (${counts[k]})</button>`).join("");
    $("#mchips").querySelectorAll("button").forEach(b => (b.onclick = () => { filter = b.dataset.k; draw(); }));

    const q = norm($("#mq").value).trim();
    const list = ALL.filter(m => (filter === "all" || m.role === filter) &&
      (!q || norm(fullName(m) + " " + m.email).includes(q)));

    $("#mlist").innerHTML = list.length ? list.map(m => {
      const me = m.id === ADM.user.id;
      const ini = (fullName(m) || m.email || "?").trim().slice(0, 1).toUpperCase();
      return `<div class="mrow">
        <div class="av">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" alt="">` : esc(ini)}</div>
        <div class="grow"><div class="nm">${esc(fullName(m) || "Sans nom")}${me ? " <small>(vous)</small>" : ""}</div>
          <small>${esc(m.email || "")}</small><small>Inscrit le ${date(m.created_at)}</small></div>
        <select data-id="${esc(m.id)}" aria-label="Rôle" ${me ? "disabled title='Vous ne pouvez pas modifier votre propre rôle'" : ""}>
          ${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${m.role === k ? "selected" : ""}>${l}</option>`).join("")}
        </select></div>`;
    }).join("") : `<p class="muted-empty">Aucun membre trouvé.</p>`;

    $("#mlist").querySelectorAll("select").forEach(sel => (sel.onchange = () => changeRole(sel)));
  }

  async function changeRole(sel) {
    const m = ALL.find(x => x.id === sel.dataset.id);
    const role = sel.value, label = ROLES[role];
    const msg = role === "member"
      ? `Retirer les droits de ${fullName(m) || m.email} ? Il redeviendra simple membre.`
      : `Nommer ${fullName(m) || m.email} « ${label} » ?` + (role === "admin" ? "\n\nUn admin a accès à TOUT, y compris la gestion des membres." : "");
    if (!confirm(msg)) { sel.value = m.role; return; }
    sel.disabled = true;
    const { error } = await sb.from("profiles").update({ role }).eq("id", m.id);
    if (error) {
      sel.value = m.role; sel.disabled = false;
      return ADM.toast(error.message || "Modification impossible.", "err");
    }
    m.role = role;
    ADM.toast(`${fullName(m) || m.email} : ${label}`);
    draw();
  }
})();
