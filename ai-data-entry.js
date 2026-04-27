(() => {
  if (window.__guidedTimeEntryLoaded) return;
  window.__guidedTimeEntryLoaded = true;
  const DATA_KEYS = ['heuressup.v1','heuresData','entries','timeEntries'];
  const DRAFT_KEY = 'guidedTimeEntryDraftV1';
  const $ = id => document.getElementById(id);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const read = (k, f={}) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(f)) || f; } catch { return f; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const hfmt = v => Number(v || 0).toLocaleString('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' h';
  const dkey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const labelDate = d => d.toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'});

  function getStore(){ for(const k of DATA_KEYS){ const d=read(k,{}); if(d && Object.keys(d).length) return d; } return {}; }
  function saveStore(d){ DATA_KEYS.forEach(k => write(k,d)); window.dispatchEvent(new Event('storage')); window.dispatchEvent(new CustomEvent('hours-data-updated',{detail:d})); }
  function parseDate(t){ const q=norm(t), d=new Date(); d.setHours(0,0,0,0); if(q.includes('hier'))d.setDate(d.getDate()-1); if(q.includes('demain'))d.setDate(d.getDate()+1); return d; }
  function parseTime(t){ const q=norm(t); let m=q.match(/\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)\b/); if(m)return `${String(Number(m[1])).padStart(2,'0')}:${m[2]}`; m=q.match(/\b([01]?\d|2[0-3])\s*h\b/); if(m)return `${String(Number(m[1])).padStart(2,'0')}:00`; return null; }
  function parseMeal(t){ const q=norm(t); if(q.includes('pas de repas')||q.includes('aucun repas')||q==='0') return 0; let m=q.match(/(\d+(?:[,.]\d+)?)\s*(min|minute|minutes)/); if(m)return Math.round(Number(m[1].replace(',','.'))); m=q.match(/^\d+$/); if(m)return Number(m[0]); return null; }
  function parseOT(t){ const q=norm(t); if(!q.includes('overtime')&&!q.includes('sup')&&!q.includes('supplementaire')) return null; const m=q.match(/(\d+(?:[,.]\d+)?)/); return m ? Number(m[1].replace(',','.')) : null; }
  function mins(t){ const [h,m]=String(t).split(':').map(Number); return h*60+(m||0); }
  function totalHours(s,e,meal){ let a=mins(s), b=mins(e); if(b<a)b+=1440; return Math.max(0,(b-a-Number(meal||0))/60); }
  function split(total){ const w=Math.max(0,Number(total||0)); return { base:Math.min(w,37.5), ot:Math.max(0,w-37.5), simple:Math.min(Math.max(0,w-37.5),2.5), premium:Math.max(0,w-40) }; }
  function getDraft(){ return read(DRAFT_KEY,null); }
  function setDraft(d){ write(DRAFT_KEY,d); }
  function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }
  function ask(d){ if(!d.start)return 'À quelle heure as-tu commencé?'; if(d.meal==null)return 'Combien de minutes de repas as-tu pris?'; if(!d.end)return 'À quelle heure as-tu fini?'; return null; }

  function addMsg(role,text){ const chat=$('aiChat'); if(!chat)return; const row=document.createElement('div'); row.className=`ai-row ${role}`; const av=document.createElement('div'); av.className='ai-avatar'; av.textContent=role==='bot'?'AI':'ME'; const msg=document.createElement('div'); msg.className=`ai-msg ${role}`; msg.textContent=text; row.appendChild(av); row.appendChild(msg); chat.appendChild(row); chat.scrollTop=chat.scrollHeight; }
  function bot(text){ setTimeout(()=>addMsg('bot',text),120); }

  function saveEntry(d){ const hours=totalHours(d.start,d.end,d.meal||0), sp=split(hours), store=getStore(); store[d.key]={type:'work',start:d.start,end:d.end,meal:d.meal||0,mealMinutes:d.meal||0,hours,totalHours:hours,note:'Ajouté via assistant'}; saveStore(store); clearDraft(); return `C’est enregistré pour le ${d.label}.\n\nDébut : ${d.start}\nFin : ${d.end}\nRepas : ${d.meal||0} min\n\nTotal travaillé : ${hfmt(hours)}\nBase régulière : ${hfmt(sp.base)}\nOvertime total : ${hfmt(sp.ot)}\nOvertime temps simple : ${hfmt(sp.simple)}\nOvertime taux 1.5 : ${hfmt(sp.premium)}`; }
  function looksEntry(t){ const q=norm(t); return (q.includes('aujourd')||q.includes('hier')||q.includes('j ai fait')||q.includes("j'ai fait")||q.includes('ajoute')||q.includes('rentre')) && (q.includes('heure')||q.includes('overtime')||q.includes('sup')||q.includes('travaille')); }
  function startFlow(t){ const date=parseDate(t); const d={key:dkey(date),label:labelDate(date),start:null,meal:null,end:null,ot:parseOT(t)}; const time=parseTime(t); if(time && (norm(t).includes('commence')||norm(t).includes('debut'))) d.start=time; setDraft(d); return `OK, je vais ajouter une entrée pour le ${d.label}.\n\n${ask(d)}`; }
  function continueFlow(d,t){ const q=norm(t); if(q.includes('annule')){ clearDraft(); return 'Parfait, saisie annulée.'; } const time=parseTime(t), meal=parseMeal(t); if(!d.start && time)d.start=time; else if(d.meal==null && meal!=null)d.meal=meal; else if(!d.end && time)d.end=time; else return ask(d) || 'Il me manque une information.'; const next=ask(d); if(next){ setDraft(d); return next; } return saveEntry(d); }
  function handle(t){ const d=getDraft(); if(d&&d.key)return continueFlow(d,t); if(looksEntry(t))return startFlow(t); return null; }
  function submit(){ const input=$('aiQuestionInput'); const text=input?.value||''; const ans=handle(text); if(!ans)return false; addMsg('user',text.trim()); if(input)input.value=''; bot(ans); return true; }
  document.addEventListener('click',e=>{ if(e.target.closest('button')?.id==='aiSendBtn' && submit()){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
  document.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target?.id==='aiQuestionInput' && submit()){ e.preventDefault(); e.stopImmediatePropagation(); } },true);
})();