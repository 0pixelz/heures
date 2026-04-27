// menu-polish.js
// Remplace les emojis/icônes du hamburger menu par des badges sobres adaptés à l'app.
(() => {
  if (window.__menuPolishLoaded) return;
  window.__menuPolishLoaded = true;

  const BADGES = [
    { keys: ['accueil', 'home'], badge: 'ACC' },
    { keys: ['statistique', 'stats'], badge: 'STAT' },
    { keys: ['calendrier de paie', 'paie'], badge: 'PAY' },
    { keys: ['parametre', 'paramètres'], badge: 'SET' },
    { keys: ['simulation'], badge: 'SIM' },
    { keys: ['assistant', 'ai'], badge: 'AI' }
  ];

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function badgeFor(text) {
    const t = normalize(text);
    const found = BADGES.find(item => item.keys.some(k => t.includes(normalize(k))));
    return found ? found.badge : 'APP';
  }

  function ensureStyles() {
    if (document.getElementById('menuPolishStyles')) return;
    const st = document.createElement('style');
    st.id = 'menuPolishStyles';
    st.textContent = `
      #sideMenu .side-nav-icon,
      .side-menu .side-nav-icon,
      .drawer .side-nav-icon,
      .menu-panel .side-nav-icon{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-width:34px!important;
        width:34px!important;
        height:24px!important;
        border-radius:999px!important;
        border:1px solid var(--border)!important;
        background:var(--bg-elev-2)!important;
        color:var(--text-dim)!important;
        font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)!important;
        font-size:9px!important;
        font-weight:800!important;
        letter-spacing:.08em!important;
        line-height:1!important;
        flex:0 0 auto!important;
      }
      #sideMenu button.active .side-nav-icon,
      .side-menu button.active .side-nav-icon,
      .drawer button.active .side-nav-icon,
      .menu-panel button.active .side-nav-icon,
      #sideMenu [aria-current="page"] .side-nav-icon,
      .side-menu [aria-current="page"] .side-nav-icon,
      .drawer [aria-current="page"] .side-nav-icon,
      .menu-panel [aria-current="page"] .side-nav-icon{
        border-color:var(--accent)!important;
        background:var(--accent-soft)!important;
        color:var(--accent-text)!important;
      }
    `;
    document.head.appendChild(st);
  }

  function polishMenu() {
    ensureStyles();
    const menus = document.querySelectorAll('#sideMenu,.side-menu,.drawer,.menu-panel');
    menus.forEach(menu => {
      const items = menu.querySelectorAll('button, a, [role="button"]');
      items.forEach(item => {
        const text = item.textContent || '';
        let icon = item.querySelector('.side-nav-icon');
        if (!icon) {
          icon = document.createElement('span');
          icon.className = 'side-nav-icon';
          item.prepend(icon);
        }
        icon.textContent = badgeFor(text);
        icon.setAttribute('aria-hidden', 'true');
      });
    });
  }

  function init() {
    polishMenu();
    const observer = new MutationObserver(polishMenu);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(polishMenu, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
