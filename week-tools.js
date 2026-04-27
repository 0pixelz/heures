// week-tools.js
// Ajoute le swipe de semaine et la suppression des heures de la semaine affichée.
(() => {
  if (window.__weekToolsLoaded) return;
  window.__weekToolsLoaded = true;

  const DATA_KEYS = ['heuressup.v1', 'heuresData', 'entries', 'timeEntries'];
  const $ = id => document.getElementById(id);

  function readJson(key, fallback = {}) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) || fallback; }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function dkey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseISODate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfWeekSunday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function getDateInput() {
    return document.querySelector('input[type="date"]');
  }

  function getSelectedDate() {
    const input = getDateInput();
    const fromInput = parseISODate(input?.value);
    if (fromInput) return fromInput;

    const selected = document.querySelector('.cal-day.selected:not(.empty) .cal-day-num, .cal-day.selected:not(.empty)');
    const monthTitle = document.querySelector('.cal-month')?.textContent || '';
    const dayNum = Number((selected?.textContent || '').match(/\d+/)?.[0]);
    if (dayNum && monthTitle) {
      const now = new Date();
      const tryDate = new Date(now.getFullYear(), now.getMonth(), dayNum);
      tryDate.setHours(0, 0, 0, 0);
      return tryDate;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function setSelectedDate(date) {
    const input = getDateInput();
    const value = dkey(date);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    window.dispatchEvent(new CustomEvent('week-tools-date-change', { detail: { date: value } }));
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
      document.dispatchEvent(new Event('week-tools-refresh'));
    }, 80);
  }

  function findWeekCard() {
    const list = document.querySelector('.week-list');
    return list?.closest('.card') || null;
  }

  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function ensureStyles() {
    if ($('weekToolsStyles')) return;
    const st = document.createElement('style');
    st.id = 'weekToolsStyles';
    st.textContent = `
      .week-tools-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}
      .week-tools-delete{width:100%;padding:11px;border-radius:var(--radius-sm);border:1px solid rgba(229,107,107,.45);background:rgba(229,107,107,.08);color:var(--danger);font-family:var(--font-body);font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
      .week-tools-delete.confirm{background:rgba(229,107,107,.16);border-color:var(--danger)}
      .week-tools-hint{font-size:11px;color:var(--text-faint);text-align:center;letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
      .week-swipe-feedback{transition:transform .18s ease, opacity .18s ease;will-change:transform}
    `;
    document.head.appendChild(st);
  }

  function weekKeys(date = getSelectedDate()) {
    const start = startOfWeekSunday(date);
    return Array.from({ length: 7 }, (_, i) => dkey(addDays(start, i)));
  }

  function hasEntry(value) {
    if (!value) return false;
    if (typeof value !== 'object') return true;
    return Object.keys(value).length > 0;
  }

  function deleteWeek() {
    const keys = weekKeys();
    let removed = 0;

    DATA_KEYS.forEach(storageKey => {
      const data = readJson(storageKey, {});
      if (!data || typeof data !== 'object') return;
      keys.forEach(key => {
        if (hasEntry(data[key])) {
          delete data[key];
          removed++;
        }
      });
      writeJson(storageKey, data);
    });

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: { deletedWeek: keys } }));
    const current = getSelectedDate();
    setSelectedDate(current);
    toast(removed ? 'Heures de la semaine supprimées' : 'Aucune heure à supprimer cette semaine');
  }

  function ensureActions() {
    ensureStyles();
    const card = findWeekCard();
    if (!card || card.querySelector('#deleteCurrentWeekBtn')) return;

    card.classList.add('week-swipe-feedback');

    const actions = document.createElement('div');
    actions.className = 'week-tools-actions';
    actions.innerHTML = `
      <button id="deleteCurrentWeekBtn" class="week-tools-delete" type="button">Supprimer les heures de cette semaine</button>
      <div class="week-tools-hint">Glisse la carte vers la gauche ou la droite pour changer de semaine</div>
    `;
    card.appendChild(actions);
  }

  function navigateWeek(delta) {
    const selected = getSelectedDate();
    setSelectedDate(addDays(selected, delta * 7));
  }

  function bindDelete() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('#deleteCurrentWeekBtn');
      if (!btn) return;
      e.preventDefault();
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.textContent = 'Confirmer la suppression';
        setTimeout(() => {
          btn.classList.remove('confirm');
          btn.textContent = 'Supprimer les heures de cette semaine';
        }, 2600);
        return;
      }
      btn.classList.remove('confirm');
      btn.textContent = 'Supprimer les heures de cette semaine';
      deleteWeek();
    });
  }

  function bindSwipe() {
    let startX = 0;
    let startY = 0;
    let activeCard = null;

    document.addEventListener('touchstart', e => {
      const card = e.target.closest('.card');
      if (!card || !card.querySelector('.week-list')) return;
      activeCard = card;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!activeCard) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) {
        activeCard.style.transform = `translateX(${Math.max(-26, Math.min(26, dx / 5))}px)`;
      }
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!activeCard) return;
      const changed = e.changedTouches[0];
      const dx = changed.clientX - startX;
      const dy = changed.clientY - startY;
      activeCard.style.transform = '';
      activeCard = null;

      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      // Swipe gauche = semaine suivante. Swipe droite = semaine précédente.
      navigateWeek(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function watch() {
    const tick = () => ensureActions();
    tick();
    setInterval(tick, 900);
    const observer = new MutationObserver(tick);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    bindDelete();
    bindSwipe();
    watch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
