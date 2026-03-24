// ── Fase 3: Firebase Auth + Firestore ───────────────────────────────────────
import Chart from 'chart.js/auto'
import {
  initAuth, login, register, logout,
  createAuthModal, showAuthModal, hideAuthModal,
  authSwitchTab, showAuthError, setAuthLoading,
} from './auth.js';
import {
  loadUserSettings, saveUserSettings,
  loadEntries, saveEntry, deleteEntry as dbDeleteEntry, saveAllEntries,
} from './db.js';
import {
  COLORS, DAY_NAMES_SHORT, DAY_NAMES_FULL,
  fmtMs, fmtMin, fmtH,
  localDate, today, fmtTime, fmtDateShort,
  timeRangeMinutes,
  getMon, getWeekDays, getRange,
} from './utils.js';
import {
  entriesByDate, totalMinutes, weeklyMinutes,
  minutesByCategory, entriesInRange,
  catColorFor, validatePersistedState,
  calcElapsedMs, TIMER_DEFAULT,
} from './store.js';

/* FIX: XSS — escape user data before inserting into DOM */
function esc(s){const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}

let S={categories:['Reuniones','Desarrollo','Diseño','Gestión','Formación','Admin'],entries:[],timer:{...TIMER_DEFAULT},notif:false,palette:'',goals:[8,8,8,8,8,0,0],notifInterval:30,notifMode:'both'};
let weekOffset=0, charts={}, tInterval=null, notifInterval=null;
let currentUser=null; // usuario Firebase activo

/* Wrapper que usa el estado global S */
function catColor(c){return catColorFor(S.categories,c);}

/* Guarda en localStorage (cache local) + Firestore (cloud) */
function save(){
  try{localStorage.setItem('tf1',JSON.stringify(S))}catch(e){}
  if(currentUser){
    const settings={
      categories:S.categories,goals:S.goals,
      notif:S.notif,palette:S.palette,
      notifInterval:S.notifInterval,notifMode:S.notifMode,
      timer:S.timer,
    };
    saveUserSettings(currentUser.uid,settings).catch(e=>console.warn('Firestore save:',e));
  }
}

/* Carga desde localStorage (sin usuario) */
function loadLocal(){
  try{
    const raw=localStorage.getItem('tf1');if(!raw)return;
    const p=JSON.parse(raw);
    const valid=validatePersistedState(p);
    if(valid.categories)  S.categories=valid.categories;
    if(valid.entries)     S.entries=valid.entries;
    if(valid.timer)       S.timer={...S.timer,...valid.timer};
    if(valid.notif!==undefined)       S.notif=valid.notif;
    if(valid.palette!==undefined)     S.palette=valid.palette;
    if(valid.goals)       S.goals=valid.goals;
    if(valid.notifInterval!==undefined) S.notifInterval=valid.notifInterval;
    if(valid.notifMode!==undefined)   S.notifMode=valid.notifMode;
    if(S.timer.on&&S.timer.paused){S.timer.start=null;}
  }catch(e){console.warn('TimeFlow: localStorage corrupted.',e);try{localStorage.removeItem('tf1');}catch(e2){}}
}

/* Reinicia S a los valores por defecto (aislamiento entre usuarios) */
function resetState(){
  S.categories=['Reuniones','Desarrollo','Diseño','Gestión','Formación','Admin'];
  S.entries=[];
  S.timer={...TIMER_DEFAULT};
  S.notif=false;
  S.palette='';
  S.goals=[8,8,8,8,8,0,0];
  S.notifInterval=30;
  S.notifMode='both';
}

/* Carga desde Firestore. Siempre parte de estado vacío — sin migración localStorage. */
async function loadFromFirestore(uid){
  resetState(); // ← garantiza aislamiento: el nuevo usuario nunca ve datos de otro
  try{
    const[settings,entries]=await Promise.all([loadUserSettings(uid),loadEntries(uid)]);
    if(settings){
      const valid=validatePersistedState(settings);
      if(valid.categories)  S.categories=valid.categories;
      if(valid.timer)       S.timer={...S.timer,...valid.timer};
      if(valid.notif!==undefined)       S.notif=valid.notif;
      if(valid.palette!==undefined)     S.palette=valid.palette;
      if(valid.goals)       S.goals=valid.goals;
      if(valid.notifInterval!==undefined) S.notifInterval=valid.notifInterval;
      if(valid.notifMode!==undefined)   S.notifMode=valid.notifMode;
      if(S.timer.on&&S.timer.paused){S.timer.start=null;}
    }
    if(entries.length>0){
      S.entries=entries;
    }
    // Usuario nuevo sin datos → empieza con estado vacío (ya reseteado arriba)
  }catch(e){
    console.warn('TimeFlow: error cargando Firestore.',e);
    // No cargamos localStorage: mantener estado vacío para este usuario
  }
}

/* NOTIF */
function toggleNotif(){
  if(!S.notif){
    if(!('Notification' in window)){showToast('⚠ Tu navegador no soporta notificaciones.');return;}
    Notification.requestPermission().then(p=>{
      if(p==='granted'){S.notif=true;save();startNotifCycle();updateNotifBtn();showToast(`✓ Avisos activados — cada ${S.notifInterval} min`);}
      else showToast('⚠ Permiso denegado en el navegador.');
    });
  } else {
    S.notif=false;save();stopNotifCycle();updateNotifBtn();showToast('Avisos desactivados.');
  }
}
function updateNotifBtn(){
  const b=document.getElementById('notif-btn'),l=document.getElementById('notif-lbl');
  if(S.notif){b.classList.add('on');l.textContent='Avisos activos';}
  else{b.classList.remove('on');l.textContent='Activar avisos';}
}
function startNotifCycle(){
  stopNotifCycle();
  notifInterval=setInterval(()=>{
    if(!S.notif)return;
    const timerRunning=S.timer.on&&!S.timer.paused;
    if(timerRunning&&(S.notifMode==='both'||S.notifMode==='active')){
      const ms=S.timer.elapsed+(Date.now()-S.timer.start);
      try{new Notification(`⏱ TimeFlow — ${Math.round(ms/60000)} min activo`,{body:`Trabajando en: ${S.timer.task||'tarea sin nombre'}${S.timer.cat?' · '+S.timer.cat:''}`,tag:'tf'});}catch(e){}
    } else if(!timerRunning&&(S.notifMode==='both'||S.notifMode==='inactive')){
      try{new Notification('⚡ TimeFlow — Sin actividad',{body:'No hay ningún temporizador activo. ¿Empezamos?',tag:'tf'});}catch(e){}
    }
  },S.notifInterval*60*1000);
}
function stopNotifCycle(){if(notifInterval){clearInterval(notifInterval);notifInterval=null;}}
function showToast(msg,dur=3000){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

/* FIX: Escape closes any open modal */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('cfg-overlay').classList.contains('open'))closeCfg();
    if(document.getElementById('edit-overlay').classList.contains('open'))closeEditModal();
  }
});

/* CATEGORIES */
function populateSels(){
  ['t-cat','m-cat'].forEach(id=>{
    const sel=document.getElementById(id),v=sel.value;
    sel.innerHTML='<option value="">— Categoría —</option>';
    S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===v)o.selected=true;sel.appendChild(o);});
  });
  renderCatChips();
}
function renderCatChips(){
  const el=document.getElementById('cat-chips');el.innerHTML='';
  S.categories.forEach((c,i)=>{
    /* FIX: XSS — use DOM methods, not innerHTML, for user content */
    const d=document.createElement('div');d.className='cat-chip';
    const dot=document.createElement('span');dot.className='cat-chip-dot';dot.style.background=catColor(c);
    const lbl=document.createElement('span');lbl.style.flex='1';lbl.textContent=c;
    const rm=document.createElement('button');rm.className='cat-chip-rm';rm.textContent='×';rm.onclick=()=>rmCat(i);
    d.appendChild(dot);d.appendChild(lbl);d.appendChild(rm);
    el.appendChild(d);
  });
}
function addCat(){const n=document.getElementById('new-cat').value.trim();if(!n||S.categories.includes(n))return;S.categories.push(n);document.getElementById('new-cat').value='';save();populateSels();renderAll();}
function rmCat(i){S.categories.splice(i,1);save();populateSels();renderAll();}

/* TIMER */
function startT(){
  if(S.timer.on)return; /* FIX: prevent double interval */
  clearInterval(tInterval);tInterval=null;
  const task=document.getElementById('t-task').value.trim();
  const cat=document.getElementById('t-cat').value;
  const now=Date.now();
  S.timer={on:true,paused:false,start:now,elapsed:0,task,cat,startWall:now};
  save();updateTimerUI();tInterval=setInterval(tickT,500);
}
function pauseT(){
  if(!S.timer.on||S.timer.paused)return;
  S.timer.elapsed+=Date.now()-S.timer.start;
  S.timer.paused=true;S.timer.start=null;
  clearInterval(tInterval);tInterval=null;
  save();updateTimerUI();
}
function resumeT(){
  if(!S.timer.on||!S.timer.paused)return;
  clearInterval(tInterval);tInterval=null; /* FIX: always clear before setting */
  S.timer.start=Date.now();S.timer.paused=false;
  tInterval=setInterval(tickT,500);
  save();updateTimerUI();
}
function stopT(){
  const endWall=Date.now();
  const ms=S.timer.elapsed+(S.timer.paused?0:(S.timer.start?endWall-S.timer.start:0));
  if(ms<1000){showToast('⚠ Mínimo 1 segundo.');return;}
  const min=Math.round(ms/60000)||1;
  const entry={id:endWall,date:today(),task:S.timer.task||'Sin nombre',cat:S.timer.cat||'',minutes:min,startWall:S.timer.startWall,endWall};
  S.entries.push(entry);
  S.timer={on:false,paused:false,start:null,elapsed:0,task:'',cat:'',startWall:null};
  clearInterval(tInterval);tInterval=null;
  document.getElementById('t-task').value='';
  document.title='TimeFlow — Seguimiento de tiempo';
  save();
  if(currentUser)saveEntry(currentUser.uid,entry).catch(e=>console.warn('Firestore entry:',e));
  updateTimerUI();renderAll();
  showToast('✓ Entrada guardada correctamente');
}
function getCurrentMs(){ return calcElapsedMs(S.timer); }
function tickT(){
  if(S.timer.on&&!S.timer.paused){
    const ms=getCurrentMs();
    document.getElementById('t-disp').textContent=fmtMs(ms);
    if(S.timer.startWall)document.getElementById('t-sub').textContent=`Inicio: ${fmtTime(S.timer.startWall)} · ${S.timer.task||'sin nombre'}${S.timer.cat?' · '+S.timer.cat:''}`;
    document.title=`${fmtMs(ms)} — TimeFlow`; /* live title in tab */
  }
}
function updateTimerUI(){
  const t=S.timer;
  const hero=document.getElementById('timer-hero'),disp=document.getElementById('t-disp'),sub=document.getElementById('t-sub');
  const dot=document.getElementById('status-dot'),stxt=document.getElementById('status-txt');
  const bs=document.getElementById('bt-start'),bp=document.getElementById('bt-pause'),br=document.getElementById('bt-resume'),bd=document.getElementById('bt-stop');
  if(!t.on){
    hero.classList.remove('live');disp.className='timer-num';
    bs.style.display='';bp.style.display='none';br.style.display='none';bd.style.display='none';
    disp.textContent='00:00:00';sub.textContent='';
    dot.classList.remove('live');stxt.textContent='Sin actividad';
    document.title='TimeFlow — Seguimiento de tiempo';
  } else if(t.paused){
    hero.classList.remove('live');disp.className='timer-num paused';
    bs.style.display='none';bp.style.display='none';br.style.display='';bd.style.display='';
    dot.classList.remove('live');stxt.textContent='En pausa';
    disp.textContent=fmtMs(t.elapsed); /* FIX: show correct time when paused on reload */
  } else {
    hero.classList.add('live');disp.className='timer-num live';
    bs.style.display='none';bp.style.display='';br.style.display='none';bd.style.display='';
    dot.classList.add('live');stxt.textContent=t.task||'Registrando...';
  }
}

/* MANUAL */
function addM(){
  const task=document.getElementById('m-task').value.trim()||'Sin nombre';
  const cat=document.getElementById('m-cat').value;
  const date=document.getElementById('m-date').value||today();
  const ts=document.getElementById('m-start').value,te=document.getElementById('m-end').value;
  const msg=document.getElementById('m-msg');
  let min=0,sw=null,ew=null;
  if(ts&&te){
    const[sh,sm]=ts.split(':').map(Number),[eh,em]=te.split(':').map(Number);
    min=timeRangeMinutes(sh,sm,eh,em); /* FIX: handles midnight crossing */
    if(min<=0||min>1440){msg.style.color='var(--red)';msg.textContent='⚠ Rango horario inválido.';return;}
    const base=new Date(date+'T00:00:00');
    sw=new Date(base);sw.setHours(sh,sm,0,0);sw=sw.getTime();
    ew=sw+min*60000;
  } else {
    const h=parseInt(document.getElementById('m-h').value)||0;
    const m=parseInt(document.getElementById('m-min').value)||0;
    min=h*60+m;
  }
  if(min<=0){msg.style.color='var(--red)';msg.textContent='⚠ Introduce una duración o rango.';return;}
  const newEntry={id:Date.now(),date,task,cat,minutes:min,startWall:sw,endWall:ew};
  S.entries.push(newEntry);
  ['m-task','m-h','m-min','m-start','m-end'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('m-date').value=today();
  msg.style.color='var(--green)';msg.textContent='✓ Entrada añadida correctamente.';
  setTimeout(()=>msg.textContent='',2500);
  save();
  if(currentUser)saveEntry(currentUser.uid,newEntry).catch(e=>console.warn('Firestore entry:',e));
  renderAll();
}

/* HISTORIAL */
function rHist(){renderHist(document.getElementById('h-date').value||today());}
function renderHist(d){
  const el=document.getElementById('hist-list');
  const ents=entriesByDate(S.entries,d).sort((a,b)=>b.id-a.id);
  if(!ents.length){el.innerHTML='<div class="empty">Sin entradas este día.</div>';return;}
  const total=totalMinutes(ents);
  el.innerHTML='';
  const hdr=document.createElement('div');hdr.className='hist-hdr';
  const hLeft=document.createElement('span');hLeft.textContent=`${ents.length} entrada${ents.length>1?'s':''}`;
  const hRight=document.createElement('span');hRight.style.cssText='font-family:var(--ff-mono);color:var(--green-l)';hRight.textContent=`${fmtMin(total)} total`;
  hdr.appendChild(hLeft);hdr.appendChild(hRight);el.appendChild(hdr);
  ents.forEach(e=>{
    const col=e.cat?catColor(e.cat):'#5c7fa0';
    const tr=e.startWall&&e.endWall?`${fmtTime(e.startWall)} – ${fmtTime(e.endWall)}`:'';
    const row=document.createElement('div');row.className='entry';
    const stripe=document.createElement('div');stripe.className='entry-stripe';stripe.style.background=col;
    const body=document.createElement('div');body.className='entry-body';
    const taskEl=document.createElement('div');taskEl.className='entry-task';taskEl.textContent=e.task; /* FIX: XSS */
    const meta=document.createElement('div');meta.className='entry-meta';
    if(e.cat){const cs=document.createElement('span');cs.style.color=col;cs.textContent=e.cat;meta.appendChild(cs);}
    if(tr){const ts2=document.createElement('span');ts2.textContent=(e.cat?' · ':'')+tr;meta.appendChild(ts2);}
    body.appendChild(taskEl);body.appendChild(meta);
    const dur=document.createElement('div');dur.className='entry-dur';dur.textContent=fmtMin(e.minutes);
    const bEdit=document.createElement('button');bEdit.className='btn-ico';bEdit.title='Editar';bEdit.innerHTML='✎';bEdit.style.cssText='color:var(--text3);font-size:13px';bEdit.onclick=()=>openEdit(e.id);
    const bDel=document.createElement('button');bDel.className='btn-ico';bDel.title='Eliminar';bDel.textContent='×';bDel.onclick=()=>delEntry(e.id);
    row.appendChild(stripe);row.appendChild(body);row.appendChild(dur);row.appendChild(bEdit);row.appendChild(bDel);
    el.appendChild(row);
  });
}
function delEntry(id){
  S.entries=S.entries.filter(e=>e.id!==id);save();
  if(currentUser)dbDeleteEntry(currentUser.uid,id).catch(e=>console.warn('Firestore del:',e));
  renderAll();rHist();
}
function exportCSV(){
  const rows=[['Fecha','Tarea','Categoría','Inicio','Fin','Minutos','Horas']];
  S.entries.sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>{
    rows.push([e.date,`"${(e.task||'').replace(/"/g,'""')}"`,e.cat||'',e.startWall?fmtTime(e.startWall):'',e.endWall?fmtTime(e.endWall):'',e.minutes,(e.minutes/60).toFixed(2)]);
  });
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='timeflow_export.csv';a.click();
}

/* SEMANA */
function shiftW(d){weekOffset+=d;renderSemana();}
function renderSemana(){
  const mon=getMon(weekOffset);const days=getWeekDays(mon);
  document.getElementById('w-lbl').textContent=`${fmtDateShort(days[0])} – ${fmtDateShort(days[6])}`;
  const dayMins=weeklyMinutes(S.entries,days);
  const total=dayMins.reduce((a,b)=>a+b,0);
  const worked=dayMins.filter(m=>m>0).length;
  const avg=total/7;
  document.getElementById('w-metrics').innerHTML=`
    <div class="kpi green"><div class="kpi-label">Total</div><div class="kpi-val">${fmtMin(total)}</div></div>
    <div class="kpi blue"><div class="kpi-label">Media/día</div><div class="kpi-val">${fmtMin(Math.round(avg))}</div></div>
    <div class="kpi teal"><div class="kpi-label">Días activos</div><div class="kpi-val">${worked}</div></div>
    <div class="kpi blue"><div class="kpi-label">Mejor día</div><div class="kpi-val">${fmtMin(Math.max(...dayMins)||0)}</div></div>`;
  if(charts.wBar)charts.wBar.destroy();
  charts.wBar=new Chart(document.getElementById('w-chart'),{
    type:'bar',
    data:{labels:['L','M','X','J','V','S','D'],datasets:[{data:dayMins.map(m=>parseFloat((m/60).toFixed(2))),backgroundColor:dayMins.map((_,i)=>i<5?'rgba(45,127,249,.3)':'rgba(0,212,160,.2)'),borderColor:dayMins.map((_,i)=>i<5?'#2d7ff9':'#00d4a0'),borderWidth:1.5,borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${fmtMin(Math.round(ctx.raw*60))}`}}},scales:{y:{ticks:{callback:v=>v+'h',color:'#5c7fa0',font:{family:'IBM Plex Mono',size:11}},grid:{color:'rgba(255,255,255,.04)'},border:{display:false}},x:{grid:{display:false},ticks:{color:'#94b4d4',font:{family:'IBM Plex Mono',size:12}},border:{display:false}}}}
  });
  const weekEntries=days.flatMap(d=>entriesByDate(S.entries,d));
  const bycat=minutesByCategory(weekEntries);
  const wc=document.getElementById('w-cats');
  if(!Object.keys(bycat).length){wc.innerHTML='<div class="empty">Sin datos esta semana.</div>';return;}
  wc.innerHTML=Object.entries(bycat).sort((a,b)=>b[1]-a[1]).map(([c,m])=>{
    const pct=total?Math.round(m/total*100):0;const col=catColor(c);
    return`<div class="bar-item"><div class="bar-header"><span class="bar-name">${esc(c)}</span><span class="bar-value">${fmtMin(m)} · ${pct}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
  }).join('');
}

/* RESUMEN */
function rResumen(){
  const range=document.getElementById('r-range').value;
  const[from,to]=getRange(range);
  const ents=entriesInRange(S.entries,from,to);
  const total=totalMinutes(ents);
  const bycat=minutesByCategory(ents);
  const days=new Set(ents.map(e=>e.date)).size;
  document.getElementById('r-metrics').innerHTML=`
    <div class="kpi green"><div class="kpi-label">Total horas</div><div class="kpi-val">${fmtH(total)}</div></div>
    <div class="kpi blue"><div class="kpi-label">Entradas</div><div class="kpi-val">${ents.length}</div></div>
    <div class="kpi teal"><div class="kpi-label">Días activos</div><div class="kpi-val">${days}</div></div>
    <div class="kpi blue"><div class="kpi-label">Categorías</div><div class="kpi-val">${Object.keys(bycat).length}</div></div>`;
  const labels=Object.keys(bycat),data=labels.map(k=>bycat[k]),colors=labels.map(k=>catColor(k));
  if(charts.pie)charts.pie.destroy();
  if(labels.length){
    charts.pie=new Chart(document.getElementById('r-pie'),{
      type:'doughnut',
      data:{labels,datasets:[{data,backgroundColor:colors.map(c=>c+'55'),borderColor:colors,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmtMin(ctx.raw)}`}}},cutout:'62%'}
    });
    document.getElementById('r-legend').innerHTML=labels.map((l,i)=>`<span style="display:flex;align-items:center;gap:5px;color:var(--text2)"><span style="width:9px;height:9px;border-radius:2px;background:${colors[i]};display:inline-block"></span>${esc(l)} <b style="color:var(--text1)">${Math.round(data[i]/total*100)}%</b></span>`).join('');
  }
  const rb=document.getElementById('r-bars');
  if(!labels.length){rb.innerHTML='<div class="empty">Sin datos en este período.</div>';return;}
  rb.innerHTML=Object.entries(bycat).sort((a,b)=>b[1]-a[1]).map(([c,m])=>{
    const pct=total?Math.round(m/total*100):0;const col=catColor(c);
    return`<div class="bar-item"><div class="bar-header"><span class="bar-name">${esc(c)}</span><span class="bar-value">${fmtMin(m)} · ${pct}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
  }).join('');
}

/* TODAY KPIs + BARS */
function renderTodayKpis(){
  const ents=S.entries.filter(e=>e.date===today());
  const total=ents.reduce((a,e)=>a+e.minutes,0);
  const cats=new Set(ents.map(e=>e.cat)).size;
  const maxEntry=ents.length?ents.reduce((a,b)=>a.minutes>b.minutes?a:b,{minutes:0}):{};
  document.getElementById('today-kpis').innerHTML=`
    <div class="kpi green"><div class="kpi-label">Registrado hoy</div><div class="kpi-val">${fmtMin(total)||'0m'}</div><div class="kpi-sub">${ents.length} entrada${ents.length!==1?'s':''}</div></div>
    <div class="kpi blue"><div class="kpi-label">Categorías activas</div><div class="kpi-val">${cats}</div></div>
    <div class="kpi teal"><div class="kpi-label">Mayor bloque</div><div class="kpi-val">${maxEntry.minutes?fmtMin(maxEntry.minutes):'—'}</div><div class="kpi-sub">${esc(maxEntry.task||'')}</div></div>`;
}
function renderTodayBars(){
  const el=document.getElementById('today-bars');
  const ents=S.entries.filter(e=>e.date===today());
  if(!ents.length){el.innerHTML='<div class="empty">Sin entradas hoy. Inicia el temporizador para comenzar.</div>';return;}
  const bycat={};ents.forEach(e=>{const k=e.cat||'Sin cat';bycat[k]=(bycat[k]||0)+e.minutes;});
  const total=Object.values(bycat).reduce((a,b)=>a+b,0);
  el.innerHTML=Object.entries(bycat).sort((a,b)=>b[1]-a[1]).map(([c,m])=>{
    const pct=total?Math.round(m/total*100):0;const col=catColor(c);
    return`<div class="bar-item"><div class="bar-header"><span class="bar-name">${esc(c)}</span><span class="bar-value">${fmtMin(m)} · ${pct}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
  }).join('');
}

/* GOALS */
function renderGoalWeekGrid(){
  const gc=document.getElementById('goal-card');
  const totalGoalH=S.goals.reduce((a,b)=>a+b,0);
  if(!totalGoalH){if(gc)gc.style.display='none';updateGoalTopbar(0,0);return;}
  if(gc)gc.style.display='';
  const mon=getMon(0);const days=getWeekDays(mon);
  const dayMins=days.map(d=>S.entries.filter(e=>e.date===d).reduce((a,e)=>a+e.minutes,0));
  const totalDone=dayMins.reduce((a,b)=>a+b,0);
  const totalGoalMin=totalGoalH*60;
  const grid=document.getElementById('goal-week-grid');if(!grid)return;
  grid.innerHTML=days.map((d,i)=>{
    const done=dayMins[i];const goal=(S.goals[i]||0)*60;
    const pct=goal?Math.min(100,Math.round(done/goal*100)):0;
    const over=goal>0&&done>=goal;
    const barCol=over?'#00d4a0':done>0?'#2d7ff9':'rgba(255,255,255,.08)';
    return`<div class="goal-day-col">
      <div class="goal-day-name" style="color:${d===today()?'var(--blue-l)':'var(--text3)'}">${['L','M','X','J','V','S','D'][i]}</div>
      <div class="goal-day-bar-wrap" title="${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]}: ${fmtMin(done)}${goal?' / objetivo '+fmtMin(goal):''}">
        <div class="goal-day-bar" style="height:${goal?pct:0}%;background:${barCol};min-height:${done>0?3:0}px"></div>
      </div>
      <div class="goal-day-val" style="color:${over?'#00d4a0':'var(--text3)'}">${goal?(done>=goal?'✓':Math.round(pct)+'%'):'—'}</div>
    </div>`;
  }).join('');
  const wPct=totalGoalMin?Math.min(100,Math.round(totalDone/totalGoalMin*100)):0;
  const wf=document.getElementById('goal-week-fill');
  const wv=document.getElementById('goal-week-val');
  if(wf){wf.style.width=wPct+'%';wf.className='goal-fill'+(totalDone>=totalGoalMin?' over':'');}
  if(wv)wv.textContent=`${fmtMin(totalDone)} / ${fmtH(totalGoalMin)} objetivo · ${wPct}%`;
  const todayDone=S.entries.filter(e=>e.date===today()).reduce((a,e)=>a+e.minutes,0);
  const todayGoal=(S.goals[(new Date().getDay()+6)%7]||0)*60;
  updateGoalTopbar(todayDone,todayGoal);
}
function updateGoalTopbar(done,goal){
  const gtw=document.getElementById('goal-topbar-wrap');
  const gtf=document.getElementById('goal-topbar-fill');
  const gtp=document.getElementById('goal-topbar-pct');
  if(!gtw)return;
  if(goal>0){
    gtw.style.display='flex';
    const p=Math.min(100,Math.round(done/goal*100));
    if(gtf)gtf.style.width=p+'%';
    if(gtp){gtp.textContent=p+'%';gtp.style.color=done>=goal?'#00d4a0':'var(--green-l)';}
  } else {gtw.style.display='none';}
}
function renderGoalInputs(){
  const grid=document.getElementById('goal-inputs-grid');if(!grid)return;
  grid.innerHTML=['L','M','X','J','V','S','D'].map((d,i)=>`
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">${d}</label>
      <input type="number" id="gi-${i}" min="0" max="16" step="0.5" value="${S.goals[i]||0}"
        style="width:100%;padding:8px 4px;text-align:center;background:rgba(255,255,255,.06);border:1px solid var(--border2);border-radius:8px;color:var(--text1);font-family:var(--ff-mono);font-size:14px;font-weight:500"
        oninput="updateGoalTotal()"/>
      <span style="font-size:10px;color:var(--text3)">h</span>
    </div>`).join('');
  updateGoalTotal();
}
function updateGoalTotal(){
  let t=0;for(let i=0;i<7;i++){const v=parseFloat(document.getElementById('gi-'+i)?.value)||0;t+=v;}
  const el=document.getElementById('goal-weekly-total');if(el)el.textContent=t.toFixed(1)+'h';
}
function saveGoals(){
  const ng=[];for(let i=0;i<7;i++)ng.push(parseFloat(document.getElementById('gi-'+i)?.value)||0);
  S.goals=ng;save();renderAll();showToast('✓ Objetivos guardados');
}

/* HEATMAP */
function renderHeatmap(){
  const COLS=14;const TOTAL=COLS*7;
  const end=new Date();end.setHours(0,0,0,0);
  const dow=end.getDay();end.setDate(end.getDate()+(6-dow));
  const cells=[];
  for(let i=TOTAL-1;i>=0;i--){const d=new Date(end);d.setDate(end.getDate()-i);cells.push(localDate(d));}
  const mbd={};S.entries.forEach(e=>{mbd[e.date]=(mbd[e.date]||0)+e.minutes;});
  const maxM=Math.max(...Object.values(mbd),60);
  const heat=['rgba(255,255,255,.05)','rgba(45,127,249,.2)','rgba(45,127,249,.45)','rgba(0,212,160,.5)','rgba(0,212,160,.9)'];
  function hc(m){if(!m)return heat[0];const r=m/maxM;if(r<.15)return heat[1];if(r<.35)return heat[2];if(r<.65)return heat[3];return heat[4];}
  const hd=document.getElementById('hm-days');
  if(hd)hd.innerHTML=['L','','X','','V','','D'].map(l=>`<span style="height:13px;line-height:13px;display:block;text-align:right;padding-right:4px">${l}</span>`).join('');
  const hm=document.getElementById('hm-months');
  if(hm){let mh='',lm=-1;
    for(let c=0;c<COLS;c++){const d=new Date(cells[c*7]+'T00:00:00');const mo=d.getMonth();
      mh+=`<span style="min-width:16px;display:inline-block;font-size:9px">${mo!==lm?d.toLocaleDateString('es-ES',{month:'short'}):''}</span>`;lm=mo;}
    hm.innerHTML=mh;}
  const grid=document.getElementById('hm-grid');
  if(grid)grid.innerHTML=cells.map(d=>{
    const m=mbd[d]||0;
    const isToday=d===today();
    return`<div class="hm-cell" style="background:${hc(m)};${isToday?'outline:1px solid var(--blue);outline-offset:1px':''}" data-d="${d}" data-m="${m}" onmouseenter="hmHover(this)" onmouseleave="hmLeave()"></div>`;
  }).join('');
  const lc=document.getElementById('hm-legend-cells');
  if(lc)lc.innerHTML=heat.map(c=>`<span style="background:${c}"></span>`).join('');
  const top10=Object.entries(mbd).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const topEl=document.getElementById('hm-top-days');
  if(topEl){
    if(!top10.length){topEl.innerHTML='<div class="empty">Sin datos aún.</div>';}
    else{const tm=top10[0][1];topEl.innerHTML=top10.map(([d,m])=>`<div class="bar-item"><div class="bar-header"><span class="bar-name">${fmtDateShort(d)}</span><span class="bar-value">${fmtMin(m)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(m/tm*100)}%;background:#2d7ff9"></div></div></div>`).join('');}
  }
  const dowT=[0,0,0,0,0,0,0],dowC=[0,0,0,0,0,0,0];
  Object.entries(mbd).forEach(([d,m])=>{const idx=(new Date(d+'T00:00:00').getDay()+6)%7;dowT[idx]+=m;dowC[idx]++;});
  const dowAvg=dowT.map((t,i)=>dowC[i]?parseFloat((t/dowC[i]/60).toFixed(2)):0);
  if(charts.dow)charts.dow.destroy();
  const dc=document.getElementById('hm-dow-chart');
  if(dc)charts.dow=new Chart(dc,{
    type:'bar',
    data:{labels:['L','M','X','J','V','S','D'],datasets:[{data:dowAvg,backgroundColor:dowAvg.map((_,i)=>i<5?'rgba(45,127,249,.3)':'rgba(0,212,160,.2)'),borderColor:dowAvg.map((_,i)=>i<5?'#2d7ff9':'#00d4a0'),borderWidth:1.5,borderRadius:5,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` Media: ${ctx.raw.toFixed(1)}h`}}},scales:{y:{ticks:{callback:v=>v+'h',color:'#5c7fa0',font:{family:'IBM Plex Mono',size:11}},grid:{color:'rgba(255,255,255,.04)'},border:{display:false}},x:{grid:{display:false},ticks:{color:'#94b4d4',font:{family:'IBM Plex Mono',size:12}},border:{display:false}}}}
  });
}
function hmHover(el){const d=el.dataset.d,m=parseInt(el.dataset.m)||0;const tt=document.getElementById('hm-tooltip');if(tt)tt.textContent=m?`${fmtDateShort(d)} — ${fmtMin(m)} registradas`:`${fmtDateShort(d)} — sin actividad`;}
function hmLeave(){const tt=document.getElementById('hm-tooltip');if(tt)tt.textContent='';}

/* RENDER ALL + SW */
function renderAll(){
  const tot=S.entries.filter(e=>e.date===today()).reduce((a,e)=>a+e.minutes,0);
  document.getElementById('hdr-today').textContent=fmtMin(tot)||'0m';
  renderTodayKpis();renderTodayBars();renderGoalWeekGrid();
  const at=document.querySelector('.nav-item.active');
  if(at){const ot=at.getAttribute('onclick').match(/'(\w+)'/)?.[1];
    if(ot==='historial')renderHist(document.getElementById('h-date').value||today());
    if(ot==='semana')renderSemana();
    if(ot==='resumen')rResumen();
    if(ot==='heatmap')renderHeatmap();
  }
}
function sw(tab,el){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  if(tab==='historial'){document.getElementById('h-date').value=today();renderHist(today());}
  if(tab==='semana'){weekOffset=0;renderSemana();}
  if(tab==='resumen')rResumen();
  if(tab==='heatmap')renderHeatmap();
}

/* EDIT MODAL */
function toTimeStr(ts){if(!ts)return'';const d=new Date(ts);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function openEdit(id){
  const e=S.entries.find(x=>x.id===id);if(!e)return;
  const sel=document.getElementById('edit-cat');
  sel.innerHTML='<option value="">— Categoría —</option>';
  S.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===e.cat)o.selected=true;sel.appendChild(o);});
  document.getElementById('edit-task').value=e.task||'';
  document.getElementById('edit-date').value=e.date||today();
  document.getElementById('edit-start').value=toTimeStr(e.startWall);
  document.getElementById('edit-end').value=toTimeStr(e.endWall);
  document.getElementById('edit-h').value=Math.floor(e.minutes/60)||'';
  document.getElementById('edit-min').value=e.minutes%60||'';
  document.getElementById('edit-msg').textContent='';
  const lbl=document.getElementById('edit-id-label');
  if(lbl)lbl.textContent=`Editando · ${(e.task||'').substring(0,40)}${(e.task||'').length>40?'…':''}`;
  document.getElementById('edit-overlay').dataset.editId=id;
  document.getElementById('edit-overlay').classList.add('open');
}
function closeEditModal(){document.getElementById('edit-overlay').classList.remove('open');}
function closeEdit(ev){if(ev.target===document.getElementById('edit-overlay'))closeEditModal();}
function saveEdit(){
  const id=parseInt(document.getElementById('edit-overlay').dataset.editId);
  const idx=S.entries.findIndex(x=>x.id===id);if(idx<0)return;
  const task=document.getElementById('edit-task').value.trim()||'Sin nombre';
  const cat=document.getElementById('edit-cat').value;
  const date=document.getElementById('edit-date').value||today();
  const ts=document.getElementById('edit-start').value,te=document.getElementById('edit-end').value;
  const msg=document.getElementById('edit-msg');
  let min=0,sw=null,ew=null;
  if(ts&&te){
    const[sh,sm]=ts.split(':').map(Number),[eh,em]=te.split(':').map(Number);
    min=timeRangeMinutes(sh,sm,eh,em); /* FIX: midnight crossing */
    if(min<=0){msg.style.color='var(--red)';msg.textContent='⚠ Rango inválido.';return;}
    const base=new Date(date+'T00:00:00');
    sw=new Date(base);sw.setHours(sh,sm,0,0);sw=sw.getTime();
    ew=sw+min*60000;
  } else {
    const h=parseInt(document.getElementById('edit-h').value)||0;
    const m=parseInt(document.getElementById('edit-min').value)||0;
    min=h*60+m;sw=S.entries[idx].startWall||null;ew=S.entries[idx].endWall||null;
  }
  if(min<=0){msg.style.color='var(--red)';msg.textContent='⚠ Introduce una duración o rango.';return;}
  S.entries[idx]={...S.entries[idx],task,cat,date,minutes:min,startWall:sw,endWall:ew};
  save();
  if(currentUser)saveEntry(currentUser.uid,S.entries[idx]).catch(e=>console.warn('Firestore edit:',e));
  renderAll();
  /* FIX: refresh historial if it's the active panel */
  const activeTab=document.querySelector('.nav-item.active')?.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
  if(activeTab==='historial')renderHist(document.getElementById('h-date').value||today());
  closeEditModal();
  showToast('✓ Registro actualizado correctamente');
}

/* PALETTE + CONFIG TABS */
const PALETTES=[
  {id:'',name:'Ocean',c1:'#2d7ff9',c2:'#0f1e2e',c3:'#00d4a0'},
  {id:'slate',name:'Slate',c1:'#4f8ef7',c2:'#0a0f1a',c3:'#34d399'},
  {id:'emerald',name:'Emerald',c1:'#10b981',c2:'#07150f',c3:'#00e5ac'},
  {id:'arctic',name:'Arctic',c1:'#38bdf8',c2:'#162332',c3:'#4ade80'},
  {id:'twilight',name:'Twilight',c1:'#818cf8',c2:'#100d1e',c3:'#34d399'},
  {id:'sunset',name:'Sunset',c1:'#fb923c',c2:'#1a100a',c3:'#fbbf24'},
];
let currentPalette='';
function renderPaletteGrid(){
  document.getElementById('palette-grid').innerHTML=PALETTES.map(p=>`
    <div class="palette-card${currentPalette===p.id?' selected':''}" onclick="applyPalette('${p.id}')">
      <div class="palette-swatch"><span style="background:${p.c2}"></span><span style="background:${p.c1}"></span><span style="background:${p.c3}"></span></div>
      <div class="palette-name">${p.name}</div>
    </div>`).join('');
}
function applyPalette(id){
  currentPalette=id;
  document.body.className=document.body.className.replace(/theme-\S+/g,'').trim();
  if(id)document.body.classList.add('theme-'+id);
  S.palette=id;save();renderPaletteGrid();renderAll();
  showToast('✓ Paleta aplicada');
}
function cfgTab(tab){
  document.getElementById('cfg-palette-panel').style.display=tab==='palette'?'':'none';
  document.getElementById('cfg-goals-panel').style.display=tab==='goals'?'':'none';
  document.getElementById('cfg-avisos-panel').style.display=tab==='avisos'?'':'none';
  document.querySelectorAll('.cfg-tab').forEach(b=>{
    const active=b.id===`ctab-${tab}`;
    b.style.color=active?'var(--text1)':'var(--text3)';
    b.style.borderBottomColor=active?'var(--blue)':'transparent';
  });
  if(tab==='goals')renderGoalInputs();
  if(tab==='avisos')renderNotifSettings();
}
function renderNotifSettings(){
  const sel=document.getElementById('notif-interval-sel');
  if(sel)sel.value=String(S.notifInterval||30);
  document.querySelectorAll('input[name="notif-mode"]').forEach(r=>{r.checked=(r.value===(S.notifMode||'both'));});
}
function applyNotifSettings(){
  const newInterval=parseInt(document.getElementById('notif-interval-sel')?.value)||30;
  const modeRadio=document.querySelector('input[name="notif-mode"]:checked');
  const newMode=modeRadio?.value||'both';
  const changed=(S.notifInterval!==newInterval||S.notifMode!==newMode);
  S.notifInterval=newInterval;S.notifMode=newMode;
  save();
  if(changed&&S.notif){startNotifCycle();showToast(`✓ Avisos: cada ${newInterval} min`);}
}
function openCfg(){renderPaletteGrid();cfgTab('palette');document.getElementById('cfg-overlay').classList.add('open');}
function closeCfg(){document.getElementById('cfg-overlay').classList.remove('open');}
function closeCfgOuter(ev){if(ev.target===document.getElementById('cfg-overlay'))closeCfg();}

// ── Exponer funciones globales (necesario para onclick en HTML con módulos ES) ──
Object.assign(window, {
  toggleNotif, addCat, rmCat, startT, pauseT, resumeT, stopT,
  addM, rHist, exportCSV, shiftW, openEdit, closeEditModal, closeEdit,
  saveEdit, applyPalette, cfgTab, applyNotifSettings, openCfg, closeCfg,
  closeCfgOuter, saveGoals, hmHover, hmLeave, sw, rResumen, updateGoalTotal,
  // Auth
  authSwitchTab,
  authLogout: async()=>{await logout();showToast('Sesión cerrada.');},
  authSubmit: async(ev)=>{
    ev.preventDefault();
    const email=document.getElementById('auth-email').value.trim();
    const pass=document.getElementById('auth-pass').value;
    const mode=document.getElementById('auth-form').dataset.mode||'login';
    setAuthLoading(true);
    try{
      if(mode==='register') await register(email,pass);
      else                   await login(email,pass);
      // onAuthStateChanged se encarga del resto
    }catch(e){
      setAuthLoading(false);
      const msgs={
        'auth/user-not-found':'Usuario no encontrado.',
        'auth/wrong-password':'Contraseña incorrecta.',
        'auth/email-already-in-use':'Este correo ya tiene cuenta.',
        'auth/invalid-email':'Correo electrónico inválido.',
        'auth/weak-password':'La contraseña es demasiado débil (mín. 6 caracteres).',
        'auth/invalid-credential':'Credenciales incorrectas.',
      };
      showAuthError(msgs[e.code]||`Error: ${e.message}`);
    }
  },
});

/* INIT — El flujo real empieza aquí via Firebase Auth */
function initApp(){
  const _d=new Date();
  document.getElementById('today-date').textContent=_d.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

function startAppUI(){
  if(S.palette){currentPalette=S.palette;document.body.classList.add('theme-'+S.palette);}
  document.getElementById('h-date').value=today();
  document.getElementById('m-date').value=today();
  populateSels();renderAll();updateNotifBtn();
  if(S.timer.on&&!S.timer.paused&&S.timer.start){tInterval=setInterval(tickT,500);}
  updateTimerUI();
  if(S.notif&&typeof Notification!=='undefined'&&Notification.permission==='granted')startNotifCycle();
}

// Crear modal de auth y mostrar mientras se comprueba el estado
createAuthModal();
initApp();

initAuth(
  async(user)=>{
    currentUser=user;
    await loadFromFirestore(user.uid);
    startAppUI();
    hideAuthModal();
    // Añadir botón logout a la topbar si no existe
    if(!document.getElementById('logout-btn')){
      const btn=document.createElement('button');
      btn.id='logout-btn';
      btn.title='Cerrar sesión';
      btn.textContent='⎋';
      btn.style.cssText='background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:4px 8px;border-radius:6px;transition:color .15s';
      btn.onmouseenter=()=>btn.style.color='var(--red,#ef4444)';
      btn.onmouseleave=()=>btn.style.color='var(--text3)';
      btn.onclick=()=>window.authLogout();
      const topbar=document.querySelector('.topbar-right')||document.querySelector('.topbar');
      if(topbar)topbar.appendChild(btn);
    }
  },
  ()=>{
    currentUser=null;
    clearInterval(tInterval);tInterval=null;
    stopNotifCycle();
    resetState(); // ← limpia el estado en memoria
    try{localStorage.removeItem('tf1');}catch(e){} // ← evita fuga de datos entre usuarios
    showAuthModal();
    setAuthLoading(false);
  }
);
