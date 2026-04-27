// week-delete-final.js
// Override final: suppression sans gel après swipe.
(() => {
  if (window.__weekDeleteFinalLoaded) return;
  window.__weekDeleteFinalLoaded = true;

  const DELETED_KEY = 'deletedWeekDatesV2';
  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, oct:9, novembre:10, nov:10, dec:11, decembre:11 };
  let deleting = false;

  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.y}-${pad(d.m)}-${pad(d.d)}`;

  function readDeleted() {
    try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function writeDeleted(set) {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
  }

  function currentYearMonth() {
    const input = document.querySelector('input[type="date"]');
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    if (input?.value) {
      const parts = input.value.split('-').map(Number);
      if (parts.length >= 2) { y = parts[0]; m = parts[1]; }
    }
    const title = norm(document.querySelector('.cal-month')?.textContent || '');
    const yy = title.match(/20\d{2}/)?.[0];
    if (yy) y = Number(yy);
    Object.keys(MONTHS).forEach(k => { if (title.includes(k)) m = MONTHS[k] + 1; });
    return { y, m };
  }

  function rowToDate(wrap) {
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

  function allFormats(key) {
    const [y, m, d] = key.split('-');
    return [key, `${y}/${m}/${d}`, `${y}${m}${d}`, `${Number(d)}/${Number(m)}/${y}`, `${d}/${m}/${y}`, `${y}-${Number(m)}-${Number(d)}`].map(norm);
  }

  function matches(value, key) {
    const s = norm(value);
    if (!s) return false;
    return allFormats(key).some(f => s.includes(f));
  }

  function cleanAny(value, key, depth = 0) {
    if (value == null || depth > 12) return { value, changed:false, removed:0 };
    if (typeof value !== 'object') return { value, changed:false, removed:0 };

    if (Array.isArray(value)) {
      let changed = false, removed = 0;
      const next = [];
      for (const item of value) {
        if (matches(JSON.stringify(item), key)) { changed = true; removed++; continue; }
        const r = cleanAny(item, key, depth + 1);
        changed = changed || r.changed;
        removed += r.removed;
        next.push(r.value);
      }
      return { value: next, changed, removed };
    }

    const out = { ...value };
    let changed = false, removed = 0;
    for (const prop of Object.keys(out)) {
      if (matches(prop, key)) { delete out[prop]; changed = true; removed++; continue; }
      const child = out[prop];
      if (child && typeof child === 'object') {
        if (matches(JSON.stringify(child), key)) { delete out[prop]; changed = true; removed++; continue; }
        const r = cleanAny(child, key, depth + 1);
        if (r.changed) { out[prop] = r.value; changed = true; removed += r.removed; }
      }
    }
    return { value: out, changed, removed };
  }

  function cleanLocalStorage(key) {
    let removed = 0;
    const changedKeys = [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }

    for (const k of keys) {
      if (k === DELETED_KEY) continue;
      if (matches(k, key)) {
        localStorage.removeItem(k);
        removed++;
        changedKeys.push(k);
        continue;
      }

      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        const r = cleanAny(data, key);
        if (r.changed) {
          localStorage.setItem(k, JSON.stringify(r.value));
          removed += r.removed;
          changedKeys.push(k);
        }
      } catch {
        if (matches(raw, key)) {
          localStorage.removeItem(k);
          removed++;
          changedKeys.push(k);
        }
      }
    }
    return { removed, changedKeys };
  }

  function clearRowVisual(wrap) {
    if (!wrap) return;
    const hours = wrap.querySelector('.week-day-hours');
    const extra = wrap.querySelector('.week-day-extra');
    const quick = wrap.querySelector('.week-day-quick');
    if (hours) {
      hours.textContent = '—';
      hours.classList.add('empty');
      hours.classList.remove('overtime', 'leave');
    }
    if (extra) {
      extra.textContent = '';
      extra.classList.remove('overtime');
    }
    if (quick) quick.remove();
    wrap.classList.remove('revealed', 'revealed-left', 'deleting');
  }

  function clearTombstonedRows() {
    const deleted = readDeleted();
    if (!deleted.size) return;
    document.querySelectorAll('.week-row-swipe-wrap').forEach(wrap => {
      const d = rowToDate(wrap);
      if (d && deleted.has(dateKey(d))) clearRowVisual(wrap);
    });
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
    setTimeout(() => el.classList.remove('show'), 1600);
  }

  function deleteRow(btn) {
    if (deleting) return;
    deleting = true;

    const wrap = btn.closest('.week-row-swipe-wrap');
    const d = rowToDate(wrap);
    if (!d) {
      deleting = false;
      toast('Date introuvable');
      return;
    }
    const key = dateKey(d);

    const deleted = readDeleted();
    deleted.add(key);
    writeDeleted(deleted);

    clearRowVisual(wrap);

    setTimeout(() => {
      const result = cleanLocalStorage(key);
      localStorage.setItem('weekDeleteFinalLastRun', JSON.stringify({ key, result, at: new Date().toISOString() }));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: { key, result } }));
      clearTombstonedRows();
      toast('Journée supprimée');
      setTimeout(() => { deleting = false; }, 500);
    }, 30);
  }

  function handleDeleteEvent(e) {
    const btn = e.target?.closest?.('[data-delete-row-swipe]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    deleteRow(btn);
  }

  // Click only: avoids mobile double execution/freeze caused by pointerup + touchend + click.
  window.addEventListener('click', handleDeleteEvent, true);

  const observer = new MutationObserver(clearTombstonedRows);
  function start() {
    clearTombstonedRows();
    observer.observe(document.body, { childList:true, subtree:true });
    setInterval(clearTombstonedRows, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
