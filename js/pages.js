(async function () {
  const $ = s => document.querySelector(s);
  const { esc } = BSL;
  const page = document.body.dataset.page;
  const root = $("#page");

  await BSL.ready;
  const s = BSL.shop;
  const wa = s.whatsapp_link || "#";
  const name = s.name || "BSL La Puissance Zénith";

  ({ about, contact, loc, faq }[page] || (() => {}))();

  /* ================= À PROPOS ================= */
  function about() {
    root.innerHTML = `
      <div class="ph"><h1>À propos de ${esc(name)}</h1>
        <p class="lead">${esc(name)} est une entreprise reconnue pour sa fiabilité et son engagement envers ses clients.
        Implantée à Baname, elle se spécialise dans les solutions d'énergie solaire, l'électronique, les télécommunications et le commerce général.</p>
      </div>
      <h2 class="sec">Nos domaines</h2>
      <div class="cards4">
        ${feat("", "Énergie solaire", "Des solutions solaires fiables pour alimenter votre maison et votre activité.")}
        ${feat("", "Électronique", "Un choix d'appareils et d'accessoires électroniques.")}
        ${feat("", "Télécommunications", "Téléphones et équipements pour rester connecté.")}
        ${feat("", "Commerce général", "Un large choix de produits du quotidien.")}
      </div>
      <h2 class="sec">Nos engagements</h2>
      <div class="cards4">
        ${feat("", "Fiabilité", "Des produits et un service sur lesquels vous pouvez compter.")}
        ${feat("", "Proximité", "Une équipe à l'écoute de chaque client.")}
        ${feat("", "Toujours ouvert", esc(s.hours || "24h/24h - Toujours à votre service"))}
      </div>
      <div class="cta">
        <a class="btn" href="catalogue.html">Voir le catalogue</a>
        <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">Nous écrire sur WhatsApp</a>
      </div>`;
  }
  function feat(ic, t, p) { return `<div class="feat"><h3>${t}</h3><p>${p}</p></div>`; }

  /* ================= CONTACT ================= */
  function contact() {
    document.addEventListener("bsl-auth", contact, { once: true });
    const coords = `<div class="card info"><h3>Nos coordonnées</h3>
        <p>Tél : ${BSL.phones()}</p><p>Adresse : ${esc(s.address || "")}</p><p>Horaires : ${esc(s.hours || "")}</p>
        <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
        ${BSL.socials()}</div>`;
    const form = BSL.user
      ? `<div class="card"><h3 style="margin-top:0">Envoyez-nous un message</h3>
          <p id="cnote" class="msg" hidden></p>
          <form id="cform">
            <label>Votre nom<input name="name" required maxlength="80" value="${esc([BSL.profile && BSL.profile.first_name, BSL.profile && BSL.profile.last_name].filter(Boolean).join(" "))}"></label>
            <label>E-mail ou téléphone<input name="contact" required maxlength="80" value="${esc(BSL.user.email || "")}"></label>
            <label>Message<textarea name="body" required maxlength="2000" placeholder="Comment pouvons-nous vous aider ?"></textarea></label>
            <div class="hint"><span id="ccount">0</span>/2000</div>
            <button class="btn" type="submit" style="width:100%">Envoyer le message</button>
          </form></div>`
      : `<div class="card gate2"><h3 style="margin-top:0">Écrivez-nous</h3>
          <p class="muted">Créez un compte gratuit pour nous envoyer un message depuis le site. Vous pouvez aussi nous joindre directement par téléphone ou WhatsApp.</p>
          <button class="btn" onclick="BSL.openAuth('signup')">Créer mon compte</button>
          <button class="btn ghost" onclick="BSL.openAuth('login')">Connexion</button></div>`;
    root.innerHTML = `<div class="ph"><h1>Contactez-nous</h1><p class="lead">Une question sur un produit ? Nous répondons avec plaisir.</p></div>
      <div class="two">${coords}${form}</div>`;

    const f = $("#cform");
    if (!f) return;
    f.elements.body.addEventListener("input", () => ($("#ccount").textContent = f.elements.body.value.length));
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const note = (t, cls) => { const n = $("#cnote"); n.textContent = t; n.className = "msg " + cls; n.hidden = false; };
      let last = 0;
      try { last = +localStorage.getItem("lastMsg") || 0; } catch (x) {}
      if (Date.now() - last < 30000) return note("Patientez quelques secondes avant un nouvel envoi.", "err");
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      const { error } = await sb.from("messages").insert({
        user_id: BSL.user.id, name: f.elements.name.value.trim(), contact: f.elements.contact.value.trim(), body: f.elements.body.value.trim(),
      });
      btn.disabled = false;
      if (error) return note("Envoi impossible pour le moment. Écrivez-nous sur WhatsApp.", "err");
      try { localStorage.setItem("lastMsg", String(Date.now())); } catch (x) {}
      f.reset(); $("#ccount").textContent = "0";
      note("Message envoyé ! Nous vous répondons dès que possible.", "good");
    });
  }

  /* ================= LOCALISATION ================= */
  function loc() {
    // Pour une position exacte : mettez "latitude,longitude" dans settings.shop.map_query
    const q = s.map_query || ((s.address || "Baname") + ", Bénin");
    const enc = encodeURIComponent(q);
    root.innerHTML = `
      <div class="ph"><h1>Où nous trouver</h1></div>
      <div class="card info">
        <p>Adresse : <b>${esc(s.address || "")}</b></p><p>Horaires : ${esc(s.hours || "")}</p><p>Tél : ${BSL.phones()}</p>
        <div class="cta" style="margin-top:12px">
          <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${enc}">Itinéraire</a>
          <a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${enc}">Ouvrir dans Maps</a>
          <a class="btn wa" target="_blank" rel="noopener" href="${esc(wa)}">WhatsApp</a>
        </div>
      </div>
      <div class="mapbox"><iframe title="Carte de la boutique" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps?q=${enc}&output=embed"></iframe></div>`;
  }

  /* ================= FAQ ================= */
  async function faq() {
    root.innerHTML = `<div class="ph"><h1>Questions fréquentes</h1><p class="lead">Retrouvez ici les réponses aux questions les plus posées.</p></div>
      <div class="search" style="position:relative;margin:16px 0;max-width:520px">
      <input id="fq" type="search" placeholder="Rechercher dans la FAQ…"></div>
      <div class="faq" id="flist"><p class="empty">Chargement…</p></div>
      <div class="card gate2" style="margin-top:20px"><b>Vous ne trouvez pas votre réponse ?</b>
        <div class="cta" style="justify-content:center"><a class="btn" href="contact.html">Nous contacter</a>
        <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
    const { data, error } = await sb.from("faqs").select("question,answer").eq("is_published", true).order("position");
    if (error) { $("#flist").innerHTML = `<p class="empty">Impossible de charger la FAQ pour le moment.</p>`; return; }
    const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const draw = () => {
      const q = norm($("#fq").value).trim();
      const list = (data || []).filter(x => !q || norm(x.question + " " + x.answer).includes(q));
      $("#flist").innerHTML = list.length
        ? list.map(x => `<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join("")
        : `<p class="empty">Aucune question ne correspond.</p>`;
    };
    $("#fq").addEventListener("input", draw);
    draw();
  }
})();
