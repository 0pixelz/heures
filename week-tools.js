// week-tools.js
// Swipe vers la gauche seulement sur les lignes de Ma semaine + bouton pour supprimer toute la semaine.
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function refreshCurrentDate() {
    const input = getDateInput();
    if (input) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('hours-data-updated'));
    document.dispatchEvent(new Event('week-tools-refresh'));
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
    setTimeout(() => el.classList.remove('show'), 1800);
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
      .week-row-swipe-wrap{position:relative;overflow:hidden;border-radius:var(--radius-sm);touch-action:pan-y;background:rgba(229,107,107,.10)}
      .week-row-swipe-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding:0 18px;background:linear-gradient(90deg,transparent 0%,rgba(229,107,107,.18) 38%,rgba(229,107,107,.38) 100%);color:var(--danger);font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:11px;opacity:0;transition:opacity .14s ease;pointer-events:auto;cursor:pointer}
      .week-row-swipe-content{position:relative;transition:transform .2s ease,opacity .2s ease;will-change:transform;border-radius:var(--radius-sm);background:var(--bg-elev)}
      .week-row-swipe-content > .week-day{margin:0!important}
      .week-row-swipe-wrap.revealed .week-row-swipe-bg{opacity:1}
      .week-row-swipe-wrap.revealed .week-row-swipe-content{transform:translateX(-96px)}
      .week-row-swipe-wrap.deleting .week-row-swipe-content{transform:translateX(-120%);opacity:.2}
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

  function deleteKeys(keys, label) {
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
    refreshCurrentDate();
    toast(removed ? `${label} supprimé` : 'Aucune heure à supprimer');
  }

  function deleteWeek() {
    deleteKeys(weekKeys(), 'Heures de la semaine');
  }

  function rowDateKey(wrap) {
    const list = document.querySelector('.week-list');
    if (!list) return null;
    const rows = Array.from(list.querySelectorAll(':scope > .week-row-swipe-wrap'));
    const index = rows.indexOf(wrap);
    if (index < 0) return null;
    return weekKeys()[index] || null;
  }

  function resetRow(wrap) {
    if (!wrap) return;
    wrap.classList.remove('revealed', 'deleting');
    const content = wrap.querySelector('.week-row-swipe-content');
    const bg = wrap.querySelector('.week-row-swipe-bg');
    if (content) {
      content.style.transform = '';
      content.style.opacity = '';
      content.style.transition = '';
    }
    if (bg) bg.style.opacity = '';
  }

  function resetAllRows(except = null) {
    document.querySelectorAll('.week-row-swipe-wrap.revealed').forEach(wrap => {
      if (wrap !== except) resetRow(wrap);
    });
  }

  function deleteRow(wrap) {
    const key = rowDateKey(wrap);
    if (!key) return;
    wrap.classList.add('deleting');
    setTimeout(() => {
      deleteKeys([key], 'Ligne');
      resetRow(wrap);
    }, 210);
  }

  function ensureRowSwipeStructure() {
    const list = document.querySelector('.week-list');
    if (!list) return;

    Array.from(list.children).forEach(child => {
      if (child.classList?.contains('week-row-swipe-wrap')) return;
      if (!child.classList?.contains('week-day')) return;

      const wrap = document.createElement('div');
      wrap.className = 'week-row-swipe-wrap';
      const bg = document.createElement('div');
      bg.className = 'week-row-swipe-bg';
      bg.textContent = 'Supprimer';
      bg.setAttribute('data-delete-row-swipe', '1');
      const content = document.createElement('div');
      content.className = 'week-row-swipe-content';

      list.insertBefore(wrap, child);
      content.appendChild(child);
      wrap.appendChild(bg);
      wrap.appendChild(content);
    });
  }

  function ensureActions() {
    ensureStyles();
    const card = findWeekCard();
    if (!card) return;
    ensureRowSwipeStructure();

    if (card.querySelector('#deleteCurrentWeekBtn')) return;
    const actions = document.createElement('div');
    actions.className = 'week-tools-actions';
    actions.innerHTML = `
      <button id="deleteCurrentWeekBtn" class="week-tools-delete" type="button">Supprimer les heures de cette semaine</button>
      <div class="week-tools-hint">Glisse seulement une ligne vers la gauche pour supprimer ce jour</div>
    `;
    card.appendChild(actions);
  }

  function bindDelete() {
    document.addEventListener('click', e => {
      const rowDelete = e.target.closest('[data-delete-row-swipe]');
      if (rowDelete) {
        e.preventDefault();
        const wrap = rowDelete.closest('.week-row-swipe-wrap');
        deleteRow(wrap);
        return;
      }

      const btn = e.target.closest('#deleteCurrentWeekBtn');
      if (!btn) return;
      e.preventDefault();
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.textContent = 'Confirmer la suppression';
        setTimeout(() => {
          btn.classList.remove('confirm');
          btn.textContent = 'Supprimer les heures de cette semaine';
        }, 3000);
        return;
      }
      btn.classList.remove('confirm');
      btn.textContent = 'Supprimer les heures de cette semaine';
      deleteWeek();
    });

    document.addEventListener('click', e => {
      const wrap = e.target.closest('.week-row-swipe-wrap.revealed');
      if (!wrap) return;
      if (e.target.closest('[data-delete-row-swipe]')) return;
      resetRow(wrap);
    });
  }

  function bindSwipe() {
    let startX = 0;
    let startY = 0;
    let activeWrap = null;
    let activeContent = null;
    let activeBg = null;
    let tracking = false;

    document.addEventListener('touchstart', e => {
      const wrap = e.target.closest('.week-row-swipe-wrap');
      if (!wrap) return;
      resetAllRows(wrap);
      activeWrap = wrap;
      activeContent = wrap.querySelector('.week-row-swipe-content');
      activeBg = wrap.querySelector('.week-row-swipe-bg');
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      if (activeContent) activeContent.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!tracking || !activeWrap || !activeContent) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return;

      // Swipe droite désactivé: on ne bouge pas si dx >= 0.
      if (dx >= 0) {
        activeContent.style.transform = '';
        if (activeBg) activeBg.style.opacity = '0';
        return;
      }

      const clamped = Math.max(-142, dx);
      activeContent.style.transform = `translateX(${clamped}px)`;
      if (activeBg) activeBg.style.opacity = String(Math.min(1, Math.abs(clamped) / 80));
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!tracking || !activeWrap || !activeContent) return;
      const changed = e.changedTouches[0];
      const dx = changed.clientX - startX;
      const dy = changed.clientY - startY;
      const wrap = activeWrap;

      activeContent.style.transition = '';
      activeContent.style.transform = '';
      if (activeBg) activeBg.style.opacity = '';

      activeWrap = null;
      activeContent = null;
      activeBg = null;
      tracking = false;

      // Swipe droite ou geste vertical: on ignore.
      if (dx >= 0 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.25) {
        resetRow(wrap);
        return;
      }

      wrap.classList.add('revealed');
      toast('Touche Supprimer pour confirmer');
      setTimeout(() => resetRow(wrap), 3600);
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
