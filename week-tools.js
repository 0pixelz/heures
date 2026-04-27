// week-tools.js
// Swipe style Gmail sur la carte Ma semaine: révèle / confirme la suppression de la semaine.
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
      .week-swipe-wrap{position:relative;overflow:hidden;border-radius:var(--radius)}
      .week-swipe-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding:0 22px;background:linear-gradient(90deg,transparent 0%,rgba(229,107,107,.16) 35%,rgba(229,107,107,.34) 100%);color:var(--danger);font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:12px;opacity:0;transition:opacity .15s ease;pointer-events:none}
      .week-swipe-bg.left{justify-content:flex-start;background:linear-gradient(270deg,transparent 0%,rgba(229,107,107,.16) 35%,rgba(229,107,107,.34) 100%)}
      .week-swipe-content{position:relative;background:var(--bg-elev);transition:transform .2s ease,opacity .2s ease;will-change:transform;border-radius:var(--radius)}
      .week-swipe-wrap.revealed .week-swipe-bg{opacity:1}
      .week-swipe-wrap.revealed .week-swipe-content{transform:translateX(-96px)}
      .week-swipe-wrap.revealed-left .week-swipe-content{transform:translateX(96px)}
      .week-swipe-wrap.deleting .week-swipe-content{transform:translateX(-120%);opacity:.2}
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

    refreshCurrentDate();
    toast(removed ? 'Heures de la semaine supprimées' : 'Aucune heure à supprimer cette semaine');
  }

  function resetSwipe(card) {
    const wrap = card?.querySelector(':scope > .week-swipe-wrap');
    if (!wrap) return;
    wrap.classList.remove('revealed', 'revealed-left', 'deleting');
    const content = wrap.querySelector('.week-swipe-content');
    if (content) {
      content.style.transform = '';
      content.style.opacity = '';
      content.style.transition = '';
    }
    const bg = wrap.querySelector('.week-swipe-bg');
    if (bg) bg.classList.remove('left');
  }

  function confirmDeleteViaSwipe(card) {
    const wrap = card?.querySelector(':scope > .week-swipe-wrap');
    if (!wrap) return;
    if (!wrap.classList.contains('revealed') && !wrap.classList.contains('revealed-left')) {
      wrap.classList.add('revealed');
      toast('Glisse encore ou touche Supprimer pour confirmer');
      setTimeout(() => resetSwipe(card), 3200);
      return;
    }
    wrap.classList.add('deleting');
    setTimeout(() => {
      deleteWeek();
      resetSwipe(card);
    }, 220);
  }

  function ensureSwipeStructure(card) {
    if (!card || card.querySelector(':scope > .week-swipe-wrap')) return;

    const children = Array.from(card.childNodes);
    const wrap = document.createElement('div');
    wrap.className = 'week-swipe-wrap';
    const bg = document.createElement('div');
    bg.className = 'week-swipe-bg';
    bg.textContent = 'Supprimer';
    const content = document.createElement('div');
    content.className = 'week-swipe-content';

    children.forEach(node => content.appendChild(node));
    wrap.appendChild(bg);
    wrap.appendChild(content);
    card.appendChild(wrap);
  }

  function ensureActions() {
    ensureStyles();
    const card = findWeekCard();
    if (!card) return;
    ensureSwipeStructure(card);

    const content = card.querySelector('.week-swipe-content');
    if (!content || content.querySelector('#deleteCurrentWeekBtn')) return;

    const actions = document.createElement('div');
    actions.className = 'week-tools-actions';
    actions.innerHTML = `
      <button id="deleteCurrentWeekBtn" class="week-tools-delete" type="button">Supprimer les heures de cette semaine</button>
      <div class="week-tools-hint">Glisse la carte vers la gauche comme Gmail pour supprimer</div>
    `;
    content.appendChild(actions);
  }

  function bindDelete() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('#deleteCurrentWeekBtn');
      if (!btn) return;
      e.preventDefault();
      const card = findWeekCard();
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.textContent = 'Confirmer la suppression';
        card?.querySelector('.week-swipe-wrap')?.classList.add('revealed');
        setTimeout(() => {
          btn.classList.remove('confirm');
          btn.textContent = 'Supprimer les heures de cette semaine';
          resetSwipe(card);
        }, 3000);
        return;
      }
      btn.classList.remove('confirm');
      btn.textContent = 'Supprimer les heures de cette semaine';
      confirmDeleteViaSwipe(card);
    });

    document.addEventListener('click', e => {
      const wrap = e.target.closest('.week-swipe-wrap.revealed,.week-swipe-wrap.revealed-left');
      if (!wrap) return;
      if (e.target.closest('#deleteCurrentWeekBtn')) return;
      const card = wrap.closest('.card');
      resetSwipe(card);
    });
  }

  function bindSwipe() {
    let startX = 0;
    let startY = 0;
    let activeCard = null;
    let activeContent = null;
    let activeBg = null;
    let tracking = false;

    document.addEventListener('touchstart', e => {
      const card = e.target.closest('.card');
      if (!card || !card.querySelector('.week-list')) return;
      const wrap = card.querySelector(':scope > .week-swipe-wrap');
      if (!wrap) return;
      activeCard = card;
      activeContent = wrap.querySelector('.week-swipe-content');
      activeBg = wrap.querySelector('.week-swipe-bg');
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      if (activeContent) activeContent.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!tracking || !activeCard || !activeContent) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return;

      const clamped = Math.max(-140, Math.min(110, dx));
      activeContent.style.transform = `translateX(${clamped}px)`;
      if (activeBg) {
        activeBg.style.opacity = String(Math.min(1, Math.abs(clamped) / 80));
        activeBg.classList.toggle('left', clamped > 0);
      }
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!tracking || !activeCard || !activeContent) return;
      const changed = e.changedTouches[0];
      const dx = changed.clientX - startX;
      const dy = changed.clientY - startY;
      const card = activeCard;
      const wrap = card.querySelector(':scope > .week-swipe-wrap');

      activeContent.style.transition = '';
      activeContent.style.transform = '';
      if (activeBg) activeBg.style.opacity = '';

      activeCard = null;
      activeContent = null;
      activeBg = null;
      tracking = false;

      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) {
        resetSwipe(card);
        return;
      }

      if (Math.abs(dx) >= 150) {
        if (wrap) wrap.classList.add(dx > 0 ? 'revealed-left' : 'revealed');
        confirmDeleteViaSwipe(card);
        return;
      }

      if (wrap) {
        wrap.classList.toggle('revealed-left', dx > 0);
        wrap.classList.toggle('revealed', dx < 0);
        toast('Touche Supprimer ou glisse encore pour confirmer');
        setTimeout(() => resetSwipe(card), 3600);
      }
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
