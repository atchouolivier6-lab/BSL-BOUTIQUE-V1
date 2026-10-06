// Charge APRÈS : config.js et la librairie supabase-js (CDN)
(function () {
  const { SUPABASE_URL, SUPABASE_KEY } = window.BSL_CONFIG;
  // Session conservée automatiquement : le membre reste connecté aux visites suivantes
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ----- Thème clair / sombre -----
  const root = document.documentElement;
  window.BSLTheme = {
    isDark() {
      const t = root.getAttribute("data-theme");
      return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    },
    toggle() {
      const next = this.isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      document.querySelectorAll("[data-theme-btn]").forEach(b => (b.textContent = next === "dark" ? "☀️" : "🌙"));
    },
    init() {
      document.querySelectorAll("[data-theme-btn]").forEach(b => {
        b.textContent = this.isDark() ? "☀️" : "🌙";
        b.onclick = () => this.toggle();
      });
    },
  };
})();
