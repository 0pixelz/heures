// week-delete-idb-fix.js
// Fix robuste pour supprimer une journée, incluant overtime stocké dans localStorage ou IndexedDB.
(() => {
  if (window.__weekDeleteIdbFixLoaded) return;
  window.__weekDeleteIdbFixLoaded = true;

  const TOMBSTONES = 'deletedWeekDatesV1';
  const MONTHS = { janv:0, fevr:1, fevrier:1, mars:2, avr:3, avril:3, mai:4, juin:5, juil:6, aout:7, sept:8, octobre:9, oct:9, nov:10, dec:11, decembre:11 };
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').trim();
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.y}-${pad(d.m)}-${pad(d.d)}`;

  function readSet() {
    try { return new Set(JSON.parse(localStorage.getItem(TOMBSTONES) || '[]')); }
    catch { return new Set(); }
  }

  function writeSet(set) { localStorage.setItem(TOMBSTONES, JSON.stringify([...set])); }

  function addDeletedDate(key) {
    const set = readSet();
    set.add(key);
    writeSet(set);
  }

  function getYearMonth() {
    const input = document.querySelector('input[type="date"]');
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth() + 1;
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

  function dateFromRow(wrap) {
    const sub = norm(wrap?.querySelector('.week-day-sub')?.textContent || '');
    const match = sub.match(/(\d{1,2})\s+([a-z]+)/);
    if (!match) return null;
    const base = getYearMonth();
    let m = MONTHS[match[2]] == null ? base.m : MONTHS[match[2]] + 1;
    let y = base.y;
    if (base.m === 1 && m === 12) y -= 1;
    if (base.m === 12 && m === 1) y += 1;
    return { y, m, d: Number(match[1]) };
  }

  function stringsForDate(key) {
    const [y,m,d] = key.split('-');
    return [key, `${y}/${m}/${d}`, `${y}${m}${d}`, `${Number(d)}/${Number(m)}/${y}`, `${d}/${m}/${y}`].map(norm);
  }

  function matchesDate(value, key) {
    const s = norm(value);
    if (!s) return false;
    return stringsForDate(key).some(v => s.includes(v));
  }

  function objectMatchesDate(obj, key) {
    if (!obj || typeof obj !== 'object') return false;
    const fields = ['date','day','key','id','entryDate','workDate','selectedDate','createdFor','startDate','endDate'];
    return fields.some(f => matchesDate(obj[f], key)) || matchesDate(JSON.stringify(obj), key);
  }

  function cleanValue(value, key, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8) return { value, changed:false, removed:0 };

    if (Array.isArray(value)) {
      let changed = false, removed = 0;
      const kept = [];
      value.forEach(item => {
        if (objectMatchesDate(item, key)) { changed = true; removed++; return; }
        const r = cleanValue(item, key, depth + 1);
        changed = changed || r.changed;
        removed += r.removed;
        kept.push(r.value);
      });
      return { value: kept, changed, removed };
    }

    const out = { ...value };
    let changed = false, removed = 0;
    Object.keys(out).forEach(k => {
      if (matchesDate(k, key)) { delete out[k]; changed = true; removed++; return; }
      const child = out[k];
      if (child && typeof child === 'object') {
        if (objectMatchesDate(child, key)) { delete out[k]; changed = true; removed++; return; }
        const r = cleanValue(child, key, depth + 1);
        if (r.changed) { out[k] = r.value; changed = true; removed += r.removed; }
      }
    });
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
    keys.forEach(k => {
      if (k === TOMBSTONES) return;
      if (matchesDate(k, key)) { localStorage.removeItem(k); removed++; changedKeys.push(k); return; }
      const raw = localStorage.getItem(k);
      try {
        const data = JSON.parse(raw);
        const r = cleanValue(data, key);
        if (r.changed) { localStorage.setItem(k, JSON.stringify(r.value)); removed += r.removed; changedKeys.push(k); }
      } catch {
        if (raw && matchesDate(raw, key)) { localStorage.removeItem(k); removed++; changedKeys.push(k); }
      }
    });
    return { removed, changedKeys };
  }

  async function cleanIndexedDB(key) {
    if (!indexedDB || !indexedDB.databases) return { removed:0, changed:[] };
    let removed = 0;
    const changed = [];
    let dbs = [];
    try { dbs = await indexedDB.databases(); } catch { return { removed, changed }; }

    await Promise.all((dbs || []).map(dbInfo => new Promise(resolve => {
      if (!dbInfo.name) return resolve();
      const req = indexedDB.open(dbInfo.name);
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const db = req.result;
        const stores = Array.from(db.objectStoreNames || []);
        if (!stores.length) { db.close(); return resolve(); }
        const tx = db.transaction(stores, 'readwrite');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { try { db.close(); } catch {}; resolve(); };
        stores.forEach(storeName => {
          const store = tx.objectStore(storeName);
          let cursorReq;
          try { cursorReq = store.openCursor(); } catch { return; }
          cursorReq.onsuccess = e => {
            const cursor = e.target.result;
            if (!cursor) return;
            const shouldDelete = matchesDate(cursor.key, key) || objectMatchesDate(cursor.value, key);
            if (shouldDelete) {
              cursor.delete();
              removed++;
              changed.push(`${dbInfo.name}/${storeName}`);
            }
            cursor.continue();
          };
        });
      };
    })));
    return { removed, changed: [...new Set(changed)] };
  }

  function clearVisualForKey(key) {
    document.querySelectorAll('.week-row-swipe-wrap').forEach(wrap => {
      const d = dateFromRow(wrap);
      if (!d || keyOf(d) !== key) return;
      const hours = wrap.querySelector('.week-day-hours');
      const extra = wrap.querySelector('.week-day-extra');
      const quick = wrap.querySelector('.week-day-quick');
      if (hours) { hours.textContent = '—'; hours.classList.add('empty'); hours.classList.remove('overtime'); }
      if (extra) extra.textContent = '';
      if (quick) quick.remove();
      wrap.classList.remove('revealed','revealed-left','deleting');
    });
  }

  function applyTombstones() {
    const set = readSet();
    set.forEach(clearVisualForKey);
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  async function deleteDate(key) {
    addDeletedDate(key);
    clearVisualForKey(key);
    const ls = cleanLocalStorage(key);
    const idb = await cleanIndexedDB(key);
    const result = { key, localStorage: ls, indexedDB: idb, at: new Date().toISOString() };
    localStorage.setItem('weekDeleteIdbFixLastRun', JSON.stringify(result));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('hours-data-updated', { detail: result }));
    toast('Journée supprimée');
    setTimeout(() => location.reload(), 700);
  }

  window.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-delete-row-swipe]');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const d = dateFromRow(btn.closest('.week-row-swipe-wrap'));
    if (!d) return toast('Date introuvable');
    deleteDate(keyOf(d));
  }, true);

  const obs = new MutationObserver(() => applyTombstones());
  if (document.body) obs.observe(document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTombstones, { once:true });
  else applyTombstones();
  setInterval(applyTombstones, 1200);
})();
