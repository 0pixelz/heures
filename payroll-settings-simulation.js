// payroll-settings-simulation.js
// Ajoute Paramètres de paie + Simulation de paie au hamburger menu.
(() => {
  if (window.__payrollSettingsSimulationLoaded) return;
  window.__payrollSettingsSimulationLoaded = true;

  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    hourlyRate: 39.743,
    baseRegularHours: 37.5,
    overtimeThreshold: 40,
    normalRrqWeekly: 94.23,
    rrqMax: 4895,
    normalGross: 1490.36,
    normalDeductions: 486.85,
    normalNet: 1003.51,
    otGross: 1619.53,
    otDeductions: 543.34,
    otNet: 1076.19,
    otHours: 40.5
  };

  const STORE = 'payrollSettingsV1';

  const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  const hrs = (v) => Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  const pct = (v) => v == null || Number.isNaN(Number(v)) ? '—' : (Number(v) * 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { return {}; }
  }

  function profile() { return readJson('paystubProfile'); }

  function settings() {
    const saved = readJson(STORE);
    const p = profile();
    const savedHourly = num(localStorage.getItem('payrollHourlyRate'), 0);
    const hourlyRate = saved.hourlyRate || savedHourly || p.hourlyRate || DEFAULTS.hourlyRate;
    const normalGross = saved.normalGross || DEFAULTS.normalGross;
    const normalDeductions = saved.normalDeductions || DEFAULTS.normalDeductions;

    return {
      hourlyRate: num(hourlyRate, DEFAULTS.hourlyRate),
      baseRegularHours: num(saved.baseRegularHours, DEFAULTS.baseRegularHours),
      overtimeThreshold: num(saved.overtimeThreshold, DEFAULTS.overtimeThreshold),
      normalRrqWeekly: num(saved.normalRrqWeekly, DEFAULTS.normalRrqWeekly),
      rrqMax: num(saved.rrqMax, DEFAULTS.rrqMax),
      normalGross: num(normalGross, DEFAULTS.normalGross),
      normalDeductions: num(normalDeductions, DEFAULTS.normalDeductions),
      normalNet: num(saved.normalNet || (normalGross - normalDeductions), DEFAULTS.normalNet),
      otGross: num(saved.otGross, DEFAULTS.otGross),
      otDeductions: num(saved.otDeductions, DEFAULTS.otDeductions),
      otNet: num(saved.otNet, DEFAULTS.otNet),
      otHours: num(saved.otHours, DEFAULTS.otHours),
      importedHourlyRate: p.hourlyRate || null,
      importedGross: p.grossPay || null,
      importedDeductions: p.deductions || null,
      importedNet: p.netPay || null,
      importedRrqWeekly: p.rrq || null,
      importedRrqYtd: p.rrqYtd || null
    };
  }

  function saveSettings(s) {
    localStorage.setItem(STORE, JSON.stringify(s));
    if (s.hourlyRate) localStorage.setItem('payrollHourlyRate', String(s.hourlyRate));
  }

  function resetSettings() {
    localStorage.removeItem(STORE);
    localStorage.removeItem('payrollDeductionRateManual');
    renderSettings();
    renderSimulation();
  }

  function applyPdfToSettings() {
    const p = profile();
    const s = settings();
    const next = { ...s };
    if (p.hourlyRate) next.hourlyRate = Number(p.hourlyRate);
    if (p.grossPay) next.otGross = Number(p.grossPay);
    if (p.deductions) next.otDeductions = Number(p.deductions);
    if (p.netPay) next.otNet = Number(p.netPay);
    if (p.regularHours || p.overtimeHours) next.otHours = Number(p.regularHours || 0) + Number(p.overtimeHours || 0);
    if (p.rrq) next.normalRrqWeekly = Number(p.rrq);
    saveSettings(next);
    renderSettings();
    renderSimulation();
  }

  function splitHours(total, s = settings()) {
    const worked = Math.max(0, num(total));
    const baseRegular = Math.min(worked, s.baseRegularHours);
    const totalOvertime = Math.max(0, worked - s.baseRegularHours);
    const simpleOvertime = Math.min(totalOvertime, Math.max(0, s.overtimeThreshold - s.baseRegularHours));
    const premiumOvertime = Math.max(0, worked - s.overtimeThreshold);
    const payAtOne = Math.min(worked, s.overtimeThreshold);
    return { worked, baseRegular, totalOvertime, simpleOvertime, premiumOvertime, payAtOne };
  }

  function deductionEstimate(hoursValue, gross, s = settings()) {
    const h = num(hoursValue), g = num(gross);
    if (!g) return 0;
    const normalRate = s.normalDeductions / s.normalGross;
    const otRate = s.otDeductions / s.otGross;
    const marginalRate = (s.otDeductions - s.normalDeductions) / Math.max(1, s.otGross - s.normalGross);

    if (Math.abs(h - s.baseRegularHours) < 0.01) return s.normalDeductions;
    if (Math.abs(h - s.otHours) < 0.01) return s.otDeductions;
    if (h <= s.baseRegularHours) return g * normalRate;
    if (h <= s.otHours) return s.normalDeductions + Math.max(0, g - s.normalGross) * marginalRate;
    return s.otDeductions + Math.max(0, g - s.otGross) * otRate;
  }

  function rrqEstimate(hoursValue, s = settings()) {
    const h = num(hoursValue);
    const gross = calculatePay(h, s).gross;
    const normalRrqRate = s.normalRrqWeekly / Math.max(1, s.normalGross);
    return gross * normalRrqRate;
  }

  function calculatePay(hoursValue, s = settings()) {
    const h = splitHours(hoursValue, s);
    const gross = h.payAtOne * s.hourlyRate + h.premiumOvertime * s.hourlyRate * 1.5;
    const deductions = deductionEstimate(h.worked, gross, s);
    const net = gross - deductions;
    return { ...h, gross, deductions, net, deductionRate: gross ? deductions / gross : 0 };
  }

  function createStyles() {
    if ($('payrollSettingsSimulationStyles')) return;
    const st = document.createElement('style');
    st.id = 'payrollSettingsSimulationStyles';
    st.textContent = `
      #payrollSettingsView,#paySimulationView{display:none}#payrollSettingsView.show,#paySimulationView.show{display:block}.pay-extra-hidden{display:none!important}
      .pay-extra-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1;margin-bottom:8px}.pay-extra-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:18px}
      .pay-extra-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.pay-extra-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.pay-extra-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:8px}.pay-extra-value{font-family:var(--font-display);font-style:italic;font-size:32px;color:var(--accent-text);line-height:1}.pay-extra-note{font-size:12px;color:var(--text-dim);margin-top:8px}
      .pay-extra-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}.pay-extra-row:last-child{border-bottom:0}.pay-extra-row span{color:var(--text-dim);font-size:13px}.pay-extra-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}
      .pay-extra-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.pay-extra-inputs label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:700}.pay-extra-inputs input{width:100%;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;color:var(--text);font-family:var(--font-mono);margin-top:6px}.pay-extra-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.pay-extra-actions button{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px 10px;font-size:12px;font-weight:800;cursor:pointer}.pay-extra-actions .accent{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text)}
      .pay-sim-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.pay-sim-presets button{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:10px 6px;font-size:12px;font-weight:800}
      @media(max-width:430px){.pay-extra-grid,.pay-extra-inputs,.pay-extra-actions{grid-template-columns:1fr}.pay-sim-presets{grid-template-columns:1fr 1fr}.pay-extra-title{font-size:30px}}
    `;
    document.head.appendChild(st);
  }

  function createViews() {
    const header = document.querySelector('header');
    if (!$('payrollSettingsView')) {
      const v = document.createElement('main');
      v.id = 'payrollSettingsView';
      v.innerHTML = `
        <div class="pay-extra-title">Paramètres de paie</div>
        <div class="pay-extra-sub">Selon le PDF importé</div>
        <div class="pay-extra-grid">
          <div class="pay-extra-card"><div class="pay-extra-label">Taux horaire</div><div class="pay-extra-value" id="setHourlyDisplay">—</div><div class="pay-extra-note">utilisé dans tous les calculs</div></div>
          <div class="pay-extra-card"><div class="pay-extra-label">Base régulière</div><div class="pay-extra-value" id="setBaseDisplay">37,50 h</div><div class="pay-extra-note">overtime après cette base</div></div>
        </div>
        <div class="card">
          <div class="card-label">Valeurs importées du PDF</div>
          <div class="pay-extra-row"><span>Brut PDF</span><strong id="setPdfGross">—</strong></div>
          <div class="pay-extra-row"><span>Net PDF</span><strong id="setPdfNet">—</strong></div>
          <div class="pay-extra-row"><span>Retenues PDF</span><strong id="setPdfDeductions">—</strong></div>
          <div class="pay-extra-row"><span>RRQ semaine PDF</span><strong id="setPdfRrq">—</strong></div>
          <div class="pay-extra-row"><span>RRQ accumulé PDF</span><strong id="setPdfRrqYtd">—</strong></div>
          <div class="pay-extra-actions"><button id="applyPdfSettingsBtn" class="accent" type="button">Utiliser le PDF</button><button id="resetSettingsBtn" type="button">Réinitialiser</button></div>
        </div>
        <div class="card">
          <div class="card-label">Paramètres modifiables</div>
          <div class="pay-extra-inputs">
            <div><label>Taux horaire</label><input id="settingHourlyRate" type="number" step="0.001"></div>
            <div><label>Base régulière</label><input id="settingBaseHours" type="number" step="0.25"></div>
            <div><label>Seuil taux 1.5</label><input id="settingThreshold" type="number" step="0.25"></div>
            <div><label>RRQ semaine normale</label><input id="settingNormalRrq" type="number" step="0.01"></div>
            <div><label>Maximum RRQ</label><input id="settingRrqMax" type="number" step="0.01"></div>
            <div><label>Brut 37,5 h</label><input id="settingNormalGross" type="number" step="0.01"></div>
            <div><label>Retenues 37,5 h</label><input id="settingNormalDeductions" type="number" step="0.01"></div>
            <div><label>Net 37,5 h</label><input id="settingNormalNet" type="number" step="0.01"></div>
          </div>
          <div class="pay-extra-actions"><button id="saveSettingsBtn" class="accent" type="button">Sauvegarder</button><button id="openSimulationBtn" type="button">Ouvrir simulation</button></div>
        </div>`;
      header ? header.insertAdjacentElement('afterend', v) : document.body.prepend(v);
    }

    if (!$('paySimulationView')) {
      const v = document.createElement('main');
      v.id = 'paySimulationView';
      v.innerHTML = `
        <div class="pay-extra-title">Simulation de paie</div>
        <div class="pay-extra-sub">Brut, net et retenues estimés</div>
        <div class="card">
          <div class="card-label">Heures à simuler</div>
          <div class="pay-extra-inputs"><div><label>Nombre d'heures</label><input id="simHoursInput" type="number" step="0.25" placeholder="ex. 40.5"></div><div><label>Taux horaire</label><input id="simHourlyInput" type="number" step="0.001"></div></div>
          <div class="pay-sim-presets"><button type="button" data-sim-hours="37.5">37,5 h</button><button type="button" data-sim-hours="40">40 h</button><button type="button" data-sim-hours="40.5">40,5 h</button><button type="button" data-sim-hours="45">45 h</button></div>
        </div>
        <div class="pay-extra-grid">
          <div class="pay-extra-card"><div class="pay-extra-label">Brut estimé</div><div class="pay-extra-value" id="simGross">—</div></div>
          <div class="pay-extra-card"><div class="pay-extra-label">Net estimé</div><div class="pay-extra-value" id="simNet">—</div></div>
        </div>
        <div class="card">
          <div class="card-label">Détails simulation</div>
          <div class="pay-extra-row"><span>Base régulière</span><strong id="simBaseRegular">0,00 h</strong></div>
          <div class="pay-extra-row"><span>Overtime total</span><strong id="simTotalOvertime">0,00 h</strong></div>
          <div class="pay-extra-row"><span>Overtime temps simple</span><strong id="simSimpleOvertime">0,00 h</strong></div>
          <div class="pay-extra-row"><span>Overtime taux 1.5</span><strong id="simPremiumOvertime">0,00 h</strong></div>
          <div class="pay-extra-row"><span>Retenues estimées</span><strong id="simDeductions">—</strong></div>
          <div class="pay-extra-row"><span>Taux retenues</span><strong id="simDeductionRate">—</strong></div>
          <div class="pay-extra-row"><span>RRQ estimée</span><strong id="simRrq">—</strong></div>
        </div>`;
      header ? header.insertAdjacentElement('afterend', v) : document.body.prepend(v);
    }
  }

  function contentNodes() {
    const header = document.querySelector('header');
    if (!header) return [];
    const out = [];
    let n = header.nextElementSibling;
    while (n) {
      const next = n.nextElementSibling;
      const system = ['SCRIPT', 'STYLE'].includes(n.tagName) || n.id === 'sideMenu' || n.id === 'sideBackdrop' || n.classList.contains('sheet') || n.classList.contains('sheet-backdrop');
      if (!system && !['payrollSettingsView', 'paySimulationView'].includes(n.id)) out.push(n);
      n = next;
    }
    return out;
  }

  function hideOtherViews() {
    ['payrollView', 'statsViewFix', 'payrollSettingsView', 'paySimulationView'].forEach(id => $(id)?.classList.remove('show'));
    document.querySelectorAll('.payroll-hidden,.stats-hidden,.pay-extra-hidden').forEach(n => {
      n.classList.remove('payroll-hidden');
      n.classList.remove('stats-hidden');
      n.classList.remove('pay-extra-hidden');
    });
  }

  function closeMenu() {
    $('sideMenu')?.classList.remove('open');
    $('sideBackdrop')?.classList.remove('open');
    document.body.classList.remove('menu-open', 'drawer-open');
  }

  function setActiveMenu(label) {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    const key = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    menu.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const txt = (el.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const active = txt.includes(key);
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }

  function showSettings() {
    createStyles(); createViews(); hideOtherViews();
    contentNodes().forEach(n => n.classList.add('pay-extra-hidden'));
    $('payrollSettingsView')?.classList.add('show');
    renderSettings();
    setActiveMenu('parametres');
    closeMenu();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSimulation() {
    createStyles(); createViews(); hideOtherViews();
    contentNodes().forEach(n => n.classList.add('pay-extra-hidden'));
    $('paySimulationView')?.classList.add('show');
    renderSimulation();
    setActiveMenu('simulation');
    closeMenu();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSettings() {
    const s = settings(), p = profile();
    if ($('setHourlyDisplay')) $('setHourlyDisplay').textContent = money(s.hourlyRate) + ' / h';
    if ($('setBaseDisplay')) $('setBaseDisplay').textContent = hrs(s.baseRegularHours);
    if ($('setPdfGross')) $('setPdfGross').textContent = money(p.grossPay);
    if ($('setPdfNet')) $('setPdfNet').textContent = money(p.netPay);
    if ($('setPdfDeductions')) $('setPdfDeductions').textContent = money(p.deductions);
    if ($('setPdfRrq')) $('setPdfRrq').textContent = money(p.rrq);
    if ($('setPdfRrqYtd')) $('setPdfRrqYtd').textContent = money(p.rrqYtd);

    const map = {
      settingHourlyRate: s.hourlyRate,
      settingBaseHours: s.baseRegularHours,
      settingThreshold: s.overtimeThreshold,
      settingNormalRrq: s.normalRrqWeekly,
      settingRrqMax: s.rrqMax,
      settingNormalGross: s.normalGross,
      settingNormalDeductions: s.normalDeductions,
      settingNormalNet: s.normalNet
    };
    Object.entries(map).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
  }

  function readSettingsInputs() {
    const s = settings();
    return {
      ...s,
      hourlyRate: num($('settingHourlyRate')?.value, s.hourlyRate),
      baseRegularHours: num($('settingBaseHours')?.value, s.baseRegularHours),
      overtimeThreshold: num($('settingThreshold')?.value, s.overtimeThreshold),
      normalRrqWeekly: num($('settingNormalRrq')?.value, s.normalRrqWeekly),
      rrqMax: num($('settingRrqMax')?.value, s.rrqMax),
      normalGross: num($('settingNormalGross')?.value, s.normalGross),
      normalDeductions: num($('settingNormalDeductions')?.value, s.normalDeductions),
      normalNet: num($('settingNormalNet')?.value, s.normalNet)
    };
  }

  function renderSimulation() {
    const s = settings();
    if ($('simHourlyInput') && !$('simHourlyInput').value) $('simHourlyInput').value = s.hourlyRate;
    if ($('simHoursInput') && !$('simHoursInput').value) $('simHoursInput').value = s.baseRegularHours;
    const simS = { ...s, hourlyRate: num($('simHourlyInput')?.value, s.hourlyRate) };
    const result = calculatePay(num($('simHoursInput')?.value, s.baseRegularHours), simS);
    if ($('simGross')) $('simGross').textContent = money(result.gross);
    if ($('simNet')) $('simNet').textContent = money(result.net);
    if ($('simBaseRegular')) $('simBaseRegular').textContent = hrs(result.baseRegular);
    if ($('simTotalOvertime')) $('simTotalOvertime').textContent = hrs(result.totalOvertime);
    if ($('simSimpleOvertime')) $('simSimpleOvertime').textContent = hrs(result.simpleOvertime);
    if ($('simPremiumOvertime')) $('simPremiumOvertime').textContent = hrs(result.premiumOvertime);
    if ($('simDeductions')) $('simDeductions').textContent = money(result.deductions);
    if ($('simDeductionRate')) $('simDeductionRate').textContent = pct(result.deductionRate);
    if ($('simRrq')) $('simRrq').textContent = money(rrqEstimate(result.worked, simS));
  }

  function addMenuButtons() {
    const menu = $('sideMenu') || document.querySelector('.side-menu,.drawer,.menu-panel');
    if (!menu) return;
    if (!$('navPaySettingsBtn')) {
      const b = document.createElement('button');
      b.id = 'navPaySettingsBtn';
      b.type = 'button';
      b.className = 'side-nav-btn';
      b.innerHTML = '<span class="side-nav-icon">⚙️</span><span>Paramètres paie</span>';
      b.addEventListener('click', showSettings);
      menu.appendChild(b);
    }
    if (!$('navPaySimulationBtn')) {
      const b = document.createElement('button');
      b.id = 'navPaySimulationBtn';
      b.type = 'button';
      b.className = 'side-nav-btn';
      b.innerHTML = '<span class="side-nav-icon">🧮</span><span>Simulation de paie</span>';
      b.addEventListener('click', showSimulation);
      menu.appendChild(b);
    }
  }

  function bind() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      if (target.id === 'saveSettingsBtn') { saveSettings(readSettingsInputs()); renderSettings(); renderSimulation(); }
      if (target.id === 'resetSettingsBtn') resetSettings();
      if (target.id === 'applyPdfSettingsBtn') applyPdfToSettings();
      if (target.id === 'openSimulationBtn') showSimulation();
      if (target.dataset.simHours) { if ($('simHoursInput')) $('simHoursInput').value = target.dataset.simHours; renderSimulation(); }
    });
    document.addEventListener('input', (e) => {
      if (['simHoursInput', 'simHourlyInput'].includes(e.target?.id)) renderSimulation();
    });
  }

  function init() {
    createStyles();
    createViews();
    addMenuButtons();
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
