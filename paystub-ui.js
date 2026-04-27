// paystub-ui.js
// Page Calendrier de paie hebdomadaire injectee sous le header.
(() => {
  const BASE_REGULAR_HOURS = 37.5;
  const REGULAR_PAY_LIMIT = 40;
  const DEFAULT_HOURLY_RATE = 39.743;
  const MAX_VALID_DEDUCTION_RATE = 0.75;
  const WEEK_OFFSET_KEY = 'payrollWeekOffset';

  // Metro reference paystubs supplied by Jonathan.
  const REF_NORMAL = { hours: 37.5, gross: 1490.36, deductions: 486.85, net: 1003.51 };
  const REF_OT = { hours: 40.5, gross: 1619.53, deductions: 543.34, net: 1076.19 };
  const NORMAL_DEDUCTION_RATE = REF_NORMAL.deductions / REF_NORMAL.gross;
  const OT_DEDUCTION_RATE = REF_OT.deductions / REF_OT.gross;
  const MARGINAL_DEDUCTION_RATE = (REF_OT.deductions - REF_NORMAL.deductions) / (REF_OT.gross - REF_NORMAL.gross);

  const $ = (id) => document.getElementById(id);
  const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  const hrs = (v) => Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  const pct = (v) => v == null || Number.isNaN(Number(v)) ? '—' : (Number(v) * 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';

  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
  function validRate(v) { const n = Number(v); return Number.isFinite(n) && n > 0 && n < MAX_VALID_DEDUCTION_RATE ? n : 0; }
  function profile(){ return readJson('paystubProfile'); }
  function getWeekOffset(){ const n=Number(localStorage.getItem(WEEK_OFFSET_KEY)||0); return Number.isFinite(n)?n:0; }
  function setWeekOffset(value){ localStorage.setItem(WEEK_OFFSET_KEY, String(value)); render(); }

  function entries() {
    for (const k of ['heuressup.v1', 'heuresData', 'entries', 'timeEntries']) {
      const v = readJson(k);
      if (v && typeof v === 'object' && Object.keys(v).length) return v;
    }
    return {};
  }

  function dkey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function weekStart(){
    const d=new Date(); d.setHours(0,0,0,0);
    const day=d.getDay(); d.setDate(d.getDate()+(day===0?-6:1-day));
    d.setDate(d.getDate() + getWeekOffset()*7);
    return d;
  }
  function fmt(d){ return d.toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}); }
  function weekLabel(offset){ if(offset===0) return 'Cette semaine'; if(offset===-1) return 'Semaine dernière'; if(offset===1) return 'Semaine prochaine'; return offset<0 ? `${Math.abs(offset)} semaines avant` : `${offset} semaines après`; }

  function entryHours(e){
    if (!e || e.type === 'leave') return 0;
    const direct = Number(e.hours || e.totalHours || e.total || e.duration || 0);
    if (direct > 0) return direct;
    const start = e.start || e.startTime || e.debut;
    const end = e.end || e.endTime || e.fin;
    if (!start || !end) return 0;
    const [sh,sm=0]=String(start).split(':').map(Number), [eh,em=0]=String(end).split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return 0;
    let a=sh*60+sm, b=eh*60+em; if (b<a) b+=1440;
    return Math.max(0,(b-a-Number(e.meal||e.mealMinutes||e.pause||0))/60);
  }

  function splitHours(totalHours){
    const worked = Math.max(0, Number(totalHours || 0));
    const baseRegular = Math.min(worked, BASE_REGULAR_HOURS);
    const totalOvertime = Math.max(0, worked - BASE_REGULAR_HOURS);
    const simpleOvertime = Math.min(totalOvertime, REGULAR_PAY_LIMIT - BASE_REGULAR_HOURS);
    const premiumOvertime = Math.max(0, worked - REGULAR_PAY_LIMIT);
    const regularPayHours = Math.min(worked, REGULAR_PAY_LIMIT);
    return {
      worked,
      baseRegular,
      totalOvertime,
      simpleOvertime,
      regular: regularPayHours,
      overtime: premiumOvertime,
      threshold: REGULAR_PAY_LIMIT,
      baseThreshold: BASE_REGULAR_HOURS
    };
  }

  function summary(){
    const e=entries(), start=weekStart(), end=addDays(start,6); let worked=0;
    for(let i=0;i<7;i++) worked += entryHours(e[dkey(addDays(start,i))]);
    return { start,end,offset:getWeekOffset(),...splitHours(worked) };
  }

  function inferredDeductionRate(p){
    const direct = validRate(p.deductionRate);
    if (direct) return direct;
    const gross = Number(p.grossPay || 0), deductions = Number(p.deductions || 0), net = Number(p.netPay || 0);
    if (gross > 0 && deductions > 0) return validRate(deductions / gross);
    if (gross > 0 && net > 0 && gross > net) return validRate((gross - net) / gross);
    return 0;
  }

  function hourlyRate(p){
    const manual = Number(localStorage.getItem('payrollHourlyRate') || 0);
    if (manual > 0) return manual;
    if (p.hourlyRate) return Number(p.hourlyRate);
    if (p.grossPay && p.regularHours) return Number(p.grossPay) / Number(p.regularHours);
    return DEFAULT_HOURLY_RATE;
  }

  function manualDeductionRate(){
    return localStorage.getItem('payrollDeductionRateManual') === '1'
      ? validRate(localStorage.getItem('payrollDeductionRate'))
      : 0;
  }

  function metroDeductionEstimate(hoursValue, gross){
    const h = Number(hoursValue || 0), g = Number(gross || 0);
    if (!g) return null;
    if (Math.abs(h - REF_NORMAL.hours) < 0.01) return REF_NORMAL.deductions;
    if (Math.abs(h - REF_OT.hours) < 0.01) return REF_OT.deductions;
    if (h <= REF_NORMAL.hours) return g * NORMAL_DEDUCTION_RATE;
    if (h <= REF_OT.hours) return REF_NORMAL.deductions + Math.max(0, g - REF_NORMAL.gross) * MARGINAL_DEDUCTION_RATE;
    return REF_OT.deductions + Math.max(0, g - REF_OT.gross) * OT_DEDUCTION_RATE;
  }

  function estimateFromHours(totalHours){
    const p=profile(), r=hourlyRate(p), s=splitHours(totalHours);
    const gross = r>0 ? s.regular*r + s.overtime*r*1.5 : null;
    const manualRate = manualDeductionRate();
    const profileRate = inferredDeductionRate(p);
    const rateToShow = manualRate || profileRate || (gross ? metroDeductionEstimate(s.worked, gross) / gross : 0);
    const ded = gross != null ? (manualRate ? gross * manualRate : metroDeductionEstimate(s.worked, gross)) : null;
    const net = gross != null && ded != null ? gross - ded : null;
    return {s,p,r,dr:rateToShow,gross,ded,net};
  }

  function estimate(){ const s=summary(); const base=estimateFromHours(s.worked); base.s={...s,...base.s}; return base; }

  function deleteImportedPaystub(){
    localStorage.removeItem('paystubProfile');
    localStorage.removeItem('payrollDeductionRate');
    localStorage.removeItem('payrollDeductionRateManual');
    localStorage.removeItem('payrollHourlyRate');
    const r=$('payHourlyRateInput'), d=$('payDeductionRateInput'), status=$('paystubImportStatus');
    if(r) r.value='';
    if(d) d.value='';
    if(status) status.textContent='PDF supprimé. Tu peux importer un nouveau talon de paie.';
    render();
  }

  function styles(){
    if ($('payrollStyles')) return;
    const s=document.createElement('style'); s.id='payrollStyles';
    s.textContent = `#payrollView{display:none}#payrollView.show{display:block}.payroll-hidden{display:none!important}.payroll-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1}.payroll-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin:8px 0 18px}.payroll-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.payroll-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.payroll-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:8px}.payroll-value{font-family:var(--font-display);font-style:italic;font-size:32px;color:var(--accent-text);line-height:1}.payroll-note{font-size:12px;color:var(--text-dim);margin-top:8px}.payroll-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}.payroll-row:last-child{border-bottom:0}.payroll-row span{color:var(--text-dim);font-size:13px}.payroll-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}.payroll-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.payroll-inputs input{width:100%;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;color:var(--text);font-family:var(--font-mono)}.payroll-import{display:block;width:100%;padding:14px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--bg-elev-2);color:var(--text);text-align:center;cursor:pointer}.payroll-link{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:12px;padding:13px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent-text);text-decoration:none;font-size:13px;font-weight:600}.payroll-link:active{transform:scale(.99)}.manual-estimate-card{border-color:var(--accent);background:linear-gradient(180deg,var(--bg-elev),var(--bg-elev-2))}.manual-estimate-results{margin-top:14px}.payroll-profile-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.payroll-delete-btn{border:1px solid rgba(229,107,107,.45);background:rgba(229,107,107,.08);color:var(--danger);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.payroll-week-nav{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0 14px}.payroll-week-nav button{background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:10px 8px;font-size:12px;font-weight:700;cursor:pointer}.payroll-week-nav button:active{transform:scale(.98)}.payroll-week-chip{display:inline-flex;margin-bottom:8px;padding:6px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}@media(max-width:430px){.payroll-grid,.payroll-inputs{grid-template-columns:1fr}.payroll-title{font-size:30px}.payroll-profile-actions{justify-content:flex-start}.payroll-delete-btn{width:100%;border-radius:var(--radius-sm);padding:10px}}`;
    document.head.appendChild(s);
  }

  function view(){
    if ($('payrollView')) return;
    const v=document.createElement('main'); v.id='payrollView';
    v.innerHTML = `<div class="payroll-title">Calendrier de paie</div><div class="payroll-sub">Paie hebdomadaire estimée</div><div class="card"><div class="card-label">Semaine de paie</div><div id="payWeekChip" class="payroll-week-chip">Cette semaine</div><div class="payroll-week-nav"><button id="payPrevWeekBtn" type="button">← Préc.</button><button id="payThisWeekBtn" type="button">Cette semaine</button><button id="payNextWeekBtn" type="button">Suiv. →</button></div><div class="payroll-row"><span>Période sélectionnée</span><strong id="payWeekRange">—</strong></div><div class="payroll-row"><span>Heures travaillées</span><strong id="payWorkedHours">0,00 h</strong></div><div class="payroll-row"><span>Base régulière</span><strong id="payBaseRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime total</span><strong id="payTotalOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime temps simple</span><strong id="paySimpleOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime taux 1.5</span><strong id="payOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Heures payées taux 1.0</span><strong id="payRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Base overtime</span><strong>Après 37,50 h</strong></div><div class="payroll-row"><span>Seuil taux 1.5</span><strong>Après 40,00 h</strong></div></div><div class="payroll-grid"><div class="payroll-card"><div class="payroll-label">Brut estimé</div><div class="payroll-value" id="payGross">—</div><div class="payroll-note">37,5 h base, 37,5 à 40 h temps simple, surplus à 1.5</div></div><div class="payroll-card"><div class="payroll-label">Net estimé</div><div class="payroll-value" id="payNet">—</div><div class="payroll-note">après retenues</div></div></div><div class="card manual-estimate-card"><div class="card-label">Estimation manuelle</div><div class="payroll-inputs"><div><label class="payroll-label">Nombre d'heures</label><input id="manualHoursInput" type="number" step="0.25" placeholder="ex. 40.50"></div><div><label class="payroll-label">Net estimé</label><input id="manualNetDisplay" type="text" readonly placeholder="—"></div></div><div class="manual-estimate-results"><div class="payroll-row"><span>Base régulière</span><strong id="manualBaseRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime total</span><strong id="manualTotalOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime temps simple</span><strong id="manualSimpleOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Overtime taux 1.5</span><strong id="manualOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Heures payées taux 1.0</span><strong id="manualRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Brut estimé</span><strong id="manualGross">—</strong></div><div class="payroll-row"><span>Retenues estimées</span><strong id="manualDeductions">—</strong></div><div class="payroll-row"><span>Net estimé</span><strong id="manualNet">—</strong></div></div><div class="payroll-note">Basé sur tes paies Metro réelles à 37,5 h et 40,5 h.</div></div><div class="card"><div class="card-label">Profil de paie</div><div class="payroll-row"><span>Taux horaire</span><strong id="payHourlyRateValue">À configurer</strong></div><div class="payroll-row"><span>Taux moyen de retenues</span><strong id="payDeductionRateValue">À configurer</strong></div><div class="payroll-row"><span>Retenues estimées</span><strong id="payDeductions">—</strong></div><div class="payroll-row"><span>Net PDF importé</span><strong id="payImportedNet">—</strong></div><div class="payroll-row"><span>Profil PDF</span><div class="payroll-profile-actions"><strong id="payImportedProfile">Aucun PDF importé</strong><button id="deletePaystubBtn" class="payroll-delete-btn" type="button">Supprimer</button></div></div><div class="payroll-inputs"><div><label class="payroll-label">Taux horaire</label><input id="payHourlyRateInput" type="number" step="0.01" placeholder="ex. 39.743"></div><div><label class="payroll-label">Retenues % manuel</label><input id="payDeductionRateInput" type="number" step="0.01" placeholder="auto"></div></div></div><div class="card"><div class="card-label">Importer une paie PDF</div><label class="payroll-import" for="paystubPdfInput">Importer un talon de paie PDF</label><input id="paystubPdfInput" type="file" accept="application/pdf" hidden><div class="payroll-note" id="paystubImportStatus">Le PDF est analysé localement dans ton navigateur.</div><a class="payroll-link" href="https://relevedepaie.metro.ca/" target="_blank" rel="noopener noreferrer">Ouvrir le site des relevés de paie Metro ↗</a></div>`;
    const header=document.querySelector('header'); if(header) header.insertAdjacentElement('afterend',v); else document.body.prepend(v);
  }

  function contentNodes(){
    const header=document.querySelector('header'); if(!header)return[]; const out=[]; let n=header.nextElementSibling;
    while(n){ const next=n.nextElementSibling; if(!['SCRIPT','STYLE'].includes(n.tagName)&&n.id!=='payrollView'&&!n.classList.contains('sheet')&&!n.classList.contains('sheet-backdrop')&&n.id!=='sideMenu'&&n.id!=='sideBackdrop') out.push(n); n=next; }
    return out;
  }

  function renderManualEstimate(){
    const input=$('manualHoursInput'); if(!input) return;
    const value=Number(input.value || 0);
    const d=estimateFromHours(value);
    if($('manualBaseRegularHours')) $('manualBaseRegularHours').textContent=hrs(d.s.baseRegular);
    if($('manualTotalOvertimeHours')) $('manualTotalOvertimeHours').textContent=hrs(d.s.totalOvertime);
    if($('manualSimpleOvertimeHours')) $('manualSimpleOvertimeHours').textContent=hrs(d.s.simpleOvertime);
    $('manualRegularHours').textContent=hrs(d.s.regular);
    $('manualOvertimeHours').textContent=hrs(d.s.overtime);
    $('manualGross').textContent=money(d.gross);
    $('manualDeductions').textContent=money(d.ded);
    $('manualNet').textContent=money(d.net);
    $('manualNetDisplay').value=d.net==null?'':money(d.net);
  }

  function render(){
    const d=estimate(); if(!$('payWeekRange'))return;
    $('payWeekRange').textContent=`${fmt(d.s.start)} au ${fmt(d.s.end)}`;
    $('payWeekChip').textContent=weekLabel(d.s.offset);
    $('payWorkedHours').textContent=hrs(d.s.worked);
    if($('payBaseRegularHours')) $('payBaseRegularHours').textContent=hrs(d.s.baseRegular);
    if($('payTotalOvertimeHours')) $('payTotalOvertimeHours').textContent=hrs(d.s.totalOvertime);
    if($('paySimpleOvertimeHours')) $('paySimpleOvertimeHours').textContent=hrs(d.s.simpleOvertime);
    $('payRegularHours').textContent=hrs(d.s.regular);
    $('payOvertimeHours').textContent=hrs(d.s.overtime);
    $('payGross').textContent=money(d.gross);
    $('payNet').textContent=money(d.net);
    $('payDeductions').textContent=money(d.ded);
    $('payHourlyRateValue').textContent=d.r?money(d.r)+' / h':'À configurer';
    $('payDeductionRateValue').textContent=d.dr?pct(d.dr):'Auto Metro';
    $('payImportedNet').textContent=money(d.p.netPay);
    $('payImportedProfile').textContent=d.p.importedAt?`PDF importé le ${new Date(d.p.importedAt).toLocaleString('fr-CA')}`:'Aucun PDF importé';
    const del=$('deletePaystubBtn'); if(del) del.style.display=d.p.importedAt?'inline-flex':'none';
    renderManualEstimate();
  }

  function showPayroll(){ view(); contentNodes().forEach(n=>n.classList.add('payroll-hidden')); $('payrollView').classList.add('show'); $('sideMenu')?.classList.remove('open'); $('sideBackdrop')?.classList.remove('open'); bind(); render(); scrollTo({top:0,behavior:'smooth'}); }
  function showHome(){ $('payrollView')?.classList.remove('show'); document.querySelectorAll('.payroll-hidden').forEach(n=>n.classList.remove('payroll-hidden')); }

  function nav(){
    if($('navPayrollBtn'))return; const menu=$('sideMenu')||document.querySelector('.side-menu,.drawer,.menu-panel'); const b=document.createElement('button'); b.id='navPayrollBtn'; b.type='button'; b.className=menu?'side-nav-btn':'icon-btn'; b.innerHTML=menu?'<span class="side-nav-icon">$</span><span>Calendrier de paie</span>':'$'; b.title='Calendrier de paie'; b.onclick=showPayroll; if(menu){ const stats=$('navStatsBtn'); stats?stats.insertAdjacentElement('afterend',b):menu.appendChild(b); } else { (document.querySelector('.header-actions')||document.querySelector('header')||document.body).prepend(b); }
    document.addEventListener('click',(e)=>{ const t=e.target.closest('button'); if(t&&(t.id==='navHomeBtn'||(t.textContent||'').toLowerCase().includes('accueil'))) showHome(); });
  }

  function bind(){
    const r=$('payHourlyRateInput'), d=$('payDeductionRateInput'), pdf=$('paystubPdfInput'), mh=$('manualHoursInput'), del=$('deletePaystubBtn');
    const prev=$('payPrevWeekBtn'), current=$('payThisWeekBtn'), next=$('payNextWeekBtn');
    if(prev&&!prev.dataset.bound){ prev.dataset.bound=1; prev.onclick=()=>setWeekOffset(getWeekOffset()-1); }
    if(current&&!current.dataset.bound){ current.dataset.bound=1; current.onclick=()=>setWeekOffset(0); }
    if(next&&!next.dataset.bound){ next.dataset.bound=1; next.onclick=()=>setWeekOffset(getWeekOffset()+1); }
    if(del&&!del.dataset.bound){ del.dataset.bound=1; del.onclick=deleteImportedPaystub; }
    if(mh&&!mh.dataset.bound){ mh.dataset.bound=1; mh.value=localStorage.getItem('manualEstimateHours')||''; mh.oninput=()=>{ localStorage.setItem('manualEstimateHours', mh.value || ''); renderManualEstimate(); }; }
    if(r&&!r.dataset.bound){ r.dataset.bound=1; const saved=localStorage.getItem('payrollHourlyRate'); r.value=saved || DEFAULT_HOURLY_RATE; if(!saved) localStorage.setItem('payrollHourlyRate', String(DEFAULT_HOURLY_RATE)); r.oninput=()=>{ if(Number(r.value)>0)localStorage.setItem('payrollHourlyRate',r.value); render(); }; }
    if(d&&!d.dataset.bound){ d.dataset.bound=1; const sv=manualDeductionRate(); d.value=sv?String(sv*100):''; d.oninput=()=>{ const val=Number(d.value || 0); if(val>0 && val<75){ localStorage.setItem('payrollDeductionRate',String(val/100)); localStorage.setItem('payrollDeductionRateManual','1'); } else { localStorage.removeItem('payrollDeductionRate'); localStorage.removeItem('payrollDeductionRateManual'); } render(); }; }
    if(pdf&&!pdf.dataset.bound){ pdf.dataset.bound=1; pdf.onchange=async(e)=>{ const file=e.target.files?.[0]; if(!file)return; const status=$('paystubImportStatus'); try{ status.textContent='Analyse du PDF en cours…'; if(!window.PaystubPDF)throw new Error('PDF module absent'); const a=await window.PaystubPDF.analyzeFile(file); window.PaystubPDF.saveProfileFromAnalysis(a); if(a.hourlyRate)localStorage.setItem('payrollHourlyRate',String(a.hourlyRate)); else if(a.grossPay&&a.regularHours)localStorage.setItem('payrollHourlyRate',String(a.grossPay/a.regularHours)); localStorage.removeItem('payrollDeductionRateManual'); status.textContent=`PDF analysé. Brut: ${money(a.grossPay)} | Net: ${money(a.netPay)} | Retenues: ${pct(inferredDeductionRate(a))}`; if(r) r.value=localStorage.getItem('payrollHourlyRate')||''; if(d) d.value=''; render(); }catch(err){ status.textContent='Impossible de lire ce PDF. Vérifie qu’il contient du texte sélectionnable.'; console.error(err); } finally { pdf.value=''; } }; }
  }

  function init(){ if(window.__payrollFixed)return; window.__payrollFixed=true; styles(); view(); nav(); bind(); render(); }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
