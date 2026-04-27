// week-direct-clear.js
// Supprime une ligne de Ma semaine en sélectionnant la date et en vidant directement
// les champs du formulaire principal: début, fin, repas, note.
(() => {
  if (window.__weekDirectClearLoaded) return;
  window.__weekDirectClearLoaded = true;

  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, oct:9, nov:10, novembre:10, dec:11, decembre:11 };
  let busy = false;

  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.y}-${pad(d.m)}-${pad(d.d)}`;

  function currentYearMonth() {
    const input = document.querySelector('input[type="date"]');
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    if (input?.value) {
      const p = input.value.split('-').map(Number);
      if (p.length >= 2) { y = p[0]; m = p[1]; }
    }
    const title = norm(document.querySelector('.cal-month')?.textContent || '');
    const yy = title.match(/20\d{2}/)?.[0];
    if (yy) y = Number(yy);
    Object.keys(MONTHS).forEach(k => { if (title.includes(k)) m = MONTHS[k] + 1; });
    return { y, m };
  }

  function dateFromRow(wrap) {
    const sub = norm(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const match = sub.match(/(\d{1,2})\s+([a-z]+)/);
    if (!match) return null;
    const base = currentYearMonth();
    let m = MONTHS[match[2]] == null ? base.m : MONTHS[match[2]] + 1;
    let y = base.y;
    if (base.m === 1 && m === 12) y -= 1;
    if (base.m === 12 && m === 1) y += 1;
    return { y, m, d: Number(match[1]) };
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function selectDate(key) {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      dateInput.value = key;
      fire(dateInput);
    }

    const day = String(Number(key.slice(8, 10)));
    const candidates = Array.from(document.querySelectorAll('.cal-day:not(.empty)'));
    const target = candidates.find(el => {
      const txt = el.querySelector('.cal-day-num')?.textContent || el.textContent || '';
      return (txt.match(/\d+/)?.[0] || '') === day;
    });
    if (target) target.click();
  }

  function clearFormFields() {
    const timeInputs = Array.from(document.querySelectorAll('input[type="time"]'));
    timeInputs.forEach(el => {
      el.value = '';
      fire(el);
    });

    const textareas = Array.from(document.querySelectorAll('textarea'));
    textareas.forEach(el => {
      el.value = '';
      fire(el);
    });

    // Champs texte qui peuvent contenir début/fin dans certains navigateurs.
    Array.from(document.querySelectorAll('input:not([type="date"]):not([type="time"])')).forEach(el => {
      const label = norm(`${el.id} ${el.name} ${el.placeholder} ${el.className}`);
      if (label.includes('debut') || label.includes('fin') || label.includes('start') || label.includes('end') || label.includes('note')) {
        el.value = '';
        fire(el);
      }
    });

    // Remet les selects repas/pause au premier choix si possible.
    Array.from(document.querySelectorAll('select')).forEach(el => {
      const label = norm(`${el.id} ${el.name} ${el.className}`);
      if (label.includes('repas') || label.includes('meal') || label.includes('pause') || el.options.length <= 8) {
        el.selectedIndex = 0;
        fire(el);
      }
    });

    // Si un bouton Congé était actif, on remet Travail si disponible.
    const travailBtn = Array.from(document.querySelectorAll('button')).find(b => norm(b.textContent) === 'travail');
    if (travailBtn && !travailBtn.classList.contains('active')) travailBtn.click();
  }

  function cleanStorageForDate(key) {
    const formats = [
      key,
      key.replaceAll('-', '/'),
      key.replaceAll('-', ''),
      `${Number(key.slice(8,10))}/${Number(key.slice(5,7))}/${key.slice(0,4)}`,
      `${key.slice(8,10)}/${key.slice(5,7)}/${key.slice(0,4)}`
    ].map(norm);

    function matches(v) {
      const s = norm(v);
      return formats.some(f => s.includes(f));
    }

    function clean(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8) return { value, changed:false };
      if (Array.isArray(value)) {
        let changed = false;
        const next = [];
        value.forEach(item => {
          if (matches(JSON.stringify(item))) { changed = true; return; }
          const r = clean(item, depth + 1);
          changed = changed || r.changed;
          next.push(r.value);
        });
        return { value: next, changed };
      }
      const out = { ...value };
      let changed = false;
      Object.keys(out).forEach(k => {
        if (matches(k)) { delete out[k]; changed = true; return; }
        if (out[k] && typeof out[k] === 'object') {
          if (matches(JSON.stringify(out[k]))) { delete out[k]; changed = true; return; }
          const r = clean(out[k], depth + 1);
          if (r.changed) { out[k] = r.value; changed = true; }
        }
      });
      return { value: out, changed };
    }

    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach(k => {
      if (matches(k)) { localStorage.removeItem(k); return; }
      try {
        const data = JSON.parse(localStorage.getItem(k));
        const r = clean(data);
        if (r.changed) localStorage.setItem(k, JSON.stringify(r.value));
      } catch {}
    });
  }

  function clearVisibleRow(wrap) {
    const hours = wrap?.querySelector('.week-day-hours');
    const extra = wrap?.querySelector('.week-day-extra');
    const quick = wrap?.querySelector('.week-day-quick');
    if (hours) {
      hours.textContent = '—';
      hours.classList.add('empty');
      hours.classList.remove('overtime', 'leave');
    }
    if (extra) extra.textContent = '';
    if (quick) quick.remove();
    wrap?.classList.remove('revealed', 'revealed-left', 'deleting');
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  function handle(e) {
    const btn = e.target?.closest?.('[data-delete-row-swipe]');
    if (!btn || busy) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    busy = true;

    const wrap = btn.closest('.week-row-swipe-wrap');
    const d = dateFromRow(wrap);
    if (!d) {
      toast('Date introuvable');
      busy = false;
      return;
    }

    const key = keyOf(d);
    localStorage.setItem('weekDirectClearLastDate', key);

    selectDate(key);
    setTimeout(() => {
      clearFormFields();
      cleanStorageForDate(key);
      clearVisibleRow(wrap);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: { key, source: 'week-direct-clear' } }));
      toast('Journée supprimée');
      setTimeout(() => location.reload(), 500);
    }, 450);
  }

  window.addEventListener('click', handle, true);
})();
