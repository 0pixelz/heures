// navigation-recovery.js
// Correctif global: empêche les pages du hamburger menu de rester noires/cachées.
(() => {
  if (window.__navigationRecoveryLoaded) return;
  window.__navigationRecoveryLoaded = true;

  const VIEW_BY_PAGE = {
    stats: 'statsViewFix',
    payroll: 'payrollView',
    settings: 'payrollSettingsView',
    simulation: 'paySimulationView',
    assistant: 'aiAssistantView'
  };

  const HIDDEN_CLASSES = ['stats-hidden', 'payroll-hidden', 'pay-extra-hidden', 'ai-hidden'];
  const KNOWN_VIEWS = Object.values(VIEW_BY_PAGE);

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function pageFromText(text) {
    const t = normalize(text);
    if (t.includes('accueil') || t.includes('home')) return 'home';
    if (t.includes('statistique') || t.includes('stats')) return 'stats';
    if (t.includes('calendrier') && t.includes('paie')) return 'payroll';
    if (t.includes('parametre') || t.includes('setting')) return 'settings';
    if (t.includes('simulation')) return 'simulation';
    if (t.includes('assistant') || t === 'ai' || t.includes('ai assistant')) return 'assistant';
    return null;
  }

  function closeMenu() {
    document.getElementById('sideMenu')?.classList.remove('open');
    document.getElementById('sideBackdrop')?.classList.remove('open');
    document.body.classList.remove('menu-open', 'drawer-open');
  }

  function removeHiddenClasses(root = document) {
    HIDDEN_CLASSES.forEach(cls => {
      root.querySelectorAll('.' + cls).forEach(el => el.classList.remove(cls));
    });
  }

  function contentNodes() {
    const header = document.querySelector('header');
    if (!header) return [];
    const out = [];
    let node = header.nextElementSibling;
    while (node) {
      const next = node.nextElementSibling;
      const system = ['SCRIPT', 'STYLE'].includes(node.tagName) ||
        node.id === 'sideMenu' ||
        node.id === 'sideBackdrop' ||
        node.classList.contains('sheet') ||
        node.classList.contains('sheet-backdrop');
      if (!system) out.push(node);
      node = next;
    }
    return out;
  }

  function setActiveMenu(page) {
    const menu = document.getElementById('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    menu.querySelectorAll('button, a, [role="button"]').forEach(item => {
      const itemPage = pageFromText(item.textContent || '');
      const active = itemPage === page;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function hideKnownViewsExcept(targetId) {
    KNOWN_VIEWS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === targetId) el.classList.add('show');
      else el.classList.remove('show');
    });
  }

  function applyPage(page) {
    if (!page) return;
    removeHiddenClasses();

    if (page === 'home') {
      hideKnownViewsExcept(null);
      contentNodes().forEach(node => {
        HIDDEN_CLASSES.forEach(cls => node.classList.remove(cls));
      });
      setActiveMenu('home');
      closeMenu();
      return;
    }

    const targetId = VIEW_BY_PAGE[page];
    const target = document.getElementById(targetId);
    if (!target) return;

    hideKnownViewsExcept(targetId);

    contentNodes().forEach(node => {
      HIDDEN_CLASSES.forEach(cls => node.classList.remove(cls));
      if (node.id && node.id === targetId) {
        node.classList.add('show');
        node.style.display = '';
      } else if (!KNOWN_VIEWS.includes(node.id)) {
        node.classList.add('stats-hidden');
      }
    });

    target.classList.add('show');
    target.style.display = '';
    setActiveMenu(page);
    closeMenu();
  }

  function scheduleApply(page) {
    if (!page) return;
    window.__activeRecoveredPage = page;
    [0, 80, 250, 700].forEach(delay => setTimeout(() => applyPage(page), delay));
  }

  function ensureStyles() {
    if (document.getElementById('navigationRecoveryStyles')) return;
    const style = document.createElement('style');
    style.id = 'navigationRecoveryStyles';
    style.textContent = `
      #statsViewFix.show,#payrollView.show,#payrollSettingsView.show,#paySimulationView.show,#aiAssistantView.show{display:block!important;visibility:visible!important;opacity:1!important;}
      #aiAssistantView.show{display:flex!important;}
      .stats-hidden,.payroll-hidden,.pay-extra-hidden,.ai-hidden{display:none!important;}
    `;
    document.head.appendChild(style);
  }

  function bind() {
    document.addEventListener('click', event => {
      const item = event.target.closest('#sideMenu button,#sideMenu a,.side-menu button,.side-menu a,.drawer button,.drawer a,.menu-panel button,.menu-panel a,[role="button"]');
      if (!item) return;
      const page = pageFromText(item.textContent || '');
      if (page) scheduleApply(page);
    }, false);

    window.addEventListener('hashchange', () => {
      if (window.__activeRecoveredPage) scheduleApply(window.__activeRecoveredPage);
    });
  }

  function init() {
    ensureStyles();
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
