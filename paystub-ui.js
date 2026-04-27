// paystub-ui.js
// Ajoute une page Calendrier de paie hebdomadaire sans modifier le gros index.html.

(() => {
  const STORAGE_KEY = 'heuressup.v1';
  const PAY_PROFILE_KEY = 'paystubProfile';
  const WEEKLY_TARGET = 37.5;

  function money(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return Number(value).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  }

  function hours(value) {
    return Number(value || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function percent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return (Number(value) * 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PAY_PROFILE_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatDate(date) {
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function calcEntryHours(entry) {
    if (!entry) return 0;
    if (entry.type === 'leave') return 0;
    if (!entry.start || !entry.end) return 0;

    const [sh, sm] = entry.start.split(':').map(Number);
    const [eh, em] = entry.end.split(':').map(Number);
    let start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (end < start) end += 24 * 60;
    const meal = Number(entry.meal || 0);
    return Math.max(0, (end - start - meal) / 60);
  }

  function getCurrentWeekSummary() {
    const entries = getEntries();
    const start = startOfWeek(new Date());
    const end = addDays(start, 6);
    let worked = 0;
    let leaveDays = 0;
    let entryDays = 0;

    for (let i = 0; i < 7; i++) {
      const key = dateKey(addDays(start, i));
      const entry = entries[key];
      if (!entry) continue;
      entryDays++;
      if (entry.type === 'leave') leaveDays++;
      worked += calcEntryHours(entry);
    }

    const regular = Math.min(worked, WEEKLY_TARGET);
    const overtime = Math.max(0, worked - WEEKLY_TARGET);
    return { start, end, worked, regular, overtime, leaveDays, entryDays };
  }

  function getHourlyRate(profile) {
    const saved = Number(localStorage.getItem('payrollHourlyRate') || 0);
    if (saved > 0) return saved;
    if (profile.grossPay && profile.regularHours) return profile.grossPay / profile.regularHours;
    if (profile.grossPay) return profile.grossPay / WEEKLY_TARGET;
    return 0;
  }

  function getDeductionRate(profile) {
    const saved = Number(localStorage.getItem('payrollDeductionRate') || 0);
    if (saved > 0) return saved;
    return Number(profile.deductionRate || 0);
  }

  function estimatePay() {
    const summary = getCurrentWeekSummary();
    const profile = getProfile();
    const hourlyRate = getHourlyRate(profile);
    const deductionRate = getDeductionRate(profile);

    const gross = hourlyRate > 0
      ? summary.regular * hourlyRate + summary.overtime * hourlyRate * 1.5
      : null;
    const deductions = gross !== null && deductionRate > 0 ? gross * deductionRate : null;
    const net = gross !== null && deductions !== null ? gross - deductions : null;

    return { summary, profile, hourlyRate, deductionRate, gross, deductions, net };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderPayroll() {
    const data = estimatePay();
    const { summary, profile } = data;

    setText('payWeekRange', `${formatDate(summary.start)} au ${formatDate(summary.end)}`);
    setText('payWorkedHours', hours(summary.worked) + ' h');
    setText('payRegularHours', hours(summary.regular) + ' h');
    setText('payOvertimeHours', hours(summary.overtime) + ' h');
    setText('payGross', money(data.gross));
    setText('payDeductions', money(data.deductions));
    setText('payNet', money(data.net));
    setText('payHourlyRateValue', data.hourlyRate ? money(data.hourlyRate) + ' / h' : 'À configurer');
    setText('payDeductionRateValue', data.deductionRate ? percent(data.deductionRate) : 'À configurer');
    setText('payImportedProfile', profile.importedAt ? `PDF importé le ${new Date(profile.importedAt).toLocaleString('fr-CA')}` : 'Aucun PDF importé');
  }

  function showView(view) {
    const home = document.getElementById('homeView');
    const stats = document.getElementById('statsView');
    const payroll = document.getElementById('payrollView');
    const navHome = document.getElementById('navHomeBtn');
    const navStats = document.getElementById('navStatsBtn');
    const navPayroll = document.getElementById('navPayrollBtn');

    if (home) home.classList.toggle('hidden', view !== 'home');
    if (stats) stats.classList.toggle('hidden', view !== 'stats');
    if (payroll) payroll.classList.toggle('hidden', view !== 'payroll');
    if (navHome) navHome.classList.toggle('active', view === 'home');
    if (navStats) navStats.classList.toggle('active', view === 'stats');
    if (navPayroll) navPayroll.classList.toggle('active', view === 'payroll');

    if (view === 'payroll') renderPayroll();

    document.getElementById('sideMenu')?.classList.remove('open');
    document.getElementById('sideBackdrop')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ensureStyles() {
    if (document.getElementById('payrollInjectedStyles')) return;
    const style = document.createElement('style');
    style.id = 'payrollInjectedStyles';
    style.textContent = `
      .payroll-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.payroll-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.payroll-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-faint);font-weight:600;margin-bottom:8px}.payroll-value{font-family:var(--font-display);font-style:italic;font-size:32px;line-height:1;color:var(--accent-text)}.payroll-note{font-size:12px;color:var(--text-dim);margin-top:6px}.payroll-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}.payroll-row:last-child{border-bottom:none}.payroll-row span{color:var(--text-dim);font-size:13px}.payroll-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}.payroll-import{width:100%;padding:14px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--bg-elev-2);color:var(--text);font-family:var(--font-body);cursor:pointer;text-align:center}.payroll-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px}.payroll-inputs input{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;color:var(--text);font-family:var(--font-mono);width:100%}@media(max-width:420px){.payroll-grid,.payroll-inputs{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function createPayrollView() {
    if (document.getElementById('payrollView')) return;
    const main = document.createElement('main');
    main.id = 'payrollView';
    main.className = 'app-view hidden';
    main.innerHTML = `
      <div class="stats-header">
        <div class="stats-title">Calendrier de paie</div>
        <div class="stats-subtitle">Estimation hebdomadaire basée sur tes heures et ton talon de paie</div>
      </div>
      <div class="card">
        <div class="card-label">Semaine de paie</div>
        <div class="payroll-row"><span>Période actuelle</span><strong id="payWeekRange">—</strong></div>
        <div class="payroll-row"><span>Heures travaillées</span><strong id="payWorkedHours">0,00 h</strong></div>
        <div class="payroll-row"><span>Heures régulières</span><strong id="payRegularHours">0,00 h</strong></div>
        <div class="payroll-row"><span>Heures supplémentaires</span><strong id="payOvertimeHours">0,00 h</strong></div>
      </div>
      <div class="payroll-grid">
        <div class="payroll-card"><div class="payroll-label">Brut estimé</div><div class="payroll-value" id="payGross">—</div><div class="payroll-note">avant retenues</div></div>
        <div class="payroll-card"><div class="payroll-label">Net estimé</div><div class="payroll-value" id="payNet">—</div><div class="payroll-note">après retenues</div></div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-label">Profil de paie</div>
        <div class="payroll-row"><span>Taux horaire</span><strong id="payHourlyRateValue">À configurer</strong></div>
        <div class="payroll-row"><span>Taux moyen de retenues</span><strong id="payDeductionRateValue">À configurer</strong></div>
        <div class="payroll-row"><span>Retenues estimées</span><strong id="payDeductions">—</strong></div>
        <div class="payroll-row"><span>Profil PDF</span><strong id="payImportedProfile">Aucun PDF importé</strong></div>
        <div class="payroll-inputs" style="margin-top:14px;">
          <div><label class="payroll-label" for="payHourlyRateInput">Taux horaire</label><input id="payHourlyRateInput" type="number" inputmode="decimal" step="0.01" placeholder="ex. 43.50"></div>
          <div><label class="payroll-label" for="payDeductionRateInput">Retenues %</label><input id="payDeductionRateInput" type="number" inputmode="decimal" step="0.01" placeholder="ex. 32"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Importer une paie PDF</div>
        <label class="payroll-import" for="paystubPdfInput">Importer un talon de paie PDF</label>
        <input id="paystubPdfInput" type="file" accept="application/pdf" hidden>
        <div class="payroll-note" id="paystubImportStatus">Le PDF est analysé localement dans ton navigateur.</div>
      </div>
    `;

    const footer = document.querySelector('footer');
    if (footer && footer.parentElement) footer.parentElement.insertBefore(main, footer.nextSibling);
    else document.body.appendChild(main);
  }

  function addNavigation() {
    if (document.getElementById('navPayrollBtn')) return;
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu) {
      const btn = document.createElement('button');
      btn.className = 'side-nav-btn';
      btn.id = 'navPayrollBtn';
      btn.type = 'button';
      btn.innerHTML = '<span class="side-nav-icon">$</span><span>Calendrier de paie</span>';
      const statsBtn = document.getElementById('navStatsBtn');
      if (statsBtn) statsBtn.insertAdjacentElement('afterend', btn);
      else sideMenu.appendChild(btn);
      btn.addEventListener('click', () => showView('payroll'));
      return;
    }

    const headerActions = document.querySelector('.header-actions') || document.querySelector('header');
    if (headerActions) {
      const btn = document.createElement('button');
      btn.id = 'navPayrollBtn';
      btn.className = 'icon-btn';
      btn.type = 'button';
      btn.title = 'Calendrier de paie';
      btn.textContent = '$';
      headerActions.prepend(btn);
      btn.addEventListener('click', () => showView('payroll'));
    }
  }

  function bindInputs() {
    const hourly = document.getElementById('payHourlyRateInput');
    const deduction = document.getElementById('payDeductionRateInput');
    const pdfInput = document.getElementById('paystubPdfInput');

    if (hourly) {
      const saved = localStorage.getItem('payrollHourlyRate');
      if (saved) hourly.value = saved;
      hourly.addEventListener('change', () => {
        const value = Number(hourly.value || 0);
        if (value > 0) localStorage.setItem('payrollHourlyRate', String(value));
        renderPayroll();
      });
    }

    if (deduction) {
      const saved = localStorage.getItem('payrollDeductionRate');
      if (saved) deduction.value = String(Number(saved) * 100);
      deduction.addEventListener('change', () => {
        const value = Number(deduction.value || 0);
        if (value > 0) localStorage.setItem('payrollDeductionRate', String(value / 100));
        renderPayroll();
      });
    }

    if (pdfInput) {
      pdfInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const status = document.getElementById('paystubImportStatus');
        try {
          if (status) status.textContent = 'Analyse du PDF en cours…';
          const analysis = await window.PaystubPDF.analyzeFile(file);
          window.PaystubPDF.saveProfileFromAnalysis(analysis);
          if (analysis.deductionRate) localStorage.setItem('payrollDeductionRate', String(analysis.deductionRate));
          if (analysis.grossPay && analysis.regularHours) localStorage.setItem('payrollHourlyRate', String(analysis.grossPay / analysis.regularHours));
          if (status) status.textContent = `PDF analysé. Brut: ${money(analysis.grossPay)} | Net: ${money(analysis.netPay)} | Retenues: ${percent(analysis.deductionRate)}`;
          renderPayroll();
        } catch (error) {
          if (status) status.textContent = 'Impossible de lire ce PDF. Vérifie qu’il contient du texte sélectionnable.';
          console.error(error);
        } finally {
          pdfInput.value = '';
        }
      });
    }
  }

  function init() {
    if (window.__paystubUiLoaded) return;
    window.__paystubUiLoaded = true;
    ensureStyles();
    createPayrollView();
    addNavigation();
    bindInputs();
    renderPayroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
