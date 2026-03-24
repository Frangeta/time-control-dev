/**
 * utils.js — Funciones puras sin dependencias de DOM ni estado.
 * Exportadas individualmente para poder ser testeadas con Vitest.
 */

export const COLORS = ['#2d7ff9','#00d4a0','#0ea5c9','#fbbf24','#818cf8','#ec4899','#10b981','#f97316','#06b6d4','#84cc16'];
export const DAY_NAMES_SHORT = ['L','M','X','J','V','S','D'];
export const DAY_NAMES_FULL  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// ── Formato de tiempo ───────────────────────────────────────────────────────

/** Milisegundos → "HH:MM:SS" */
export function fmtMs(ms) {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}

/** Minutos → "Xh Ym" legible */
export function fmtMin(m) {
  if (!m || m <= 0) return '0m';
  const h  = Math.floor(m / 60);
  const mn = m % 60;
  if (h > 0 && mn > 0) return `${h}h ${mn}m`;
  if (h > 0)           return `${h}h`;
  return `${mn}m`;
}

/** Minutos → "X.Xh" */
export function fmtH(m) {
  return (m / 60).toFixed(1) + 'h';
}

/** Date → "YYYY-MM-DD" en hora local */
export function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Hoy en "YYYY-MM-DD" local */
export function today() {
  return localDate(new Date());
}

/** Timestamp o null → "HH:MM" en es-ES, o "--:--" si es null */
export function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '--:--';
}

/** "YYYY-MM-DD" → "lun 23 mar" en es-ES */
export function fmtDateShort(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ── Cálculo de rangos horarios ──────────────────────────────────────────────

/**
 * Minutos entre dos horas HH:MM.
 * Gestiona cruce de medianoche: si el resultado es ≤ 0 suma 1440.
 */
export function timeRangeMinutes(sh, sm, eh, em) {
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m <= 0) m += 1440;
  return m;
}

// ── Semana ──────────────────────────────────────────────────────────────────

/**
 * Lunes de la semana con offset (0 = esta semana, -1 = anterior…).
 * Acepta un Date opcional para facilitar los tests sin depender de Date.now().
 */
export function getMon(off = 0, now = new Date()) {
  const d    = new Date(now);
  const dy   = d.getDay();             // 0=Dom … 6=Sáb
  const diff = (dy + 6) % 7;          // días desde el lunes
  d.setDate(d.getDate() - diff + off * 7);
  return localDate(d);
}

/** Array de 7 fechas "YYYY-MM-DD" desde el lunes dado */
export function getWeekDays(mon) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon + 'T00:00:00');
    d.setDate(d.getDate() + i);
    days.push(localDate(d));
  }
  return days;
}

// ── Rangos de resumen ───────────────────────────────────────────────────────

/**
 * Devuelve [fechaDesde, fechaHasta] para el selector de resumen.
 * Acepta un Date opcional para testabilidad.
 */
export function getRange(range, now = new Date()) {
  const d = localDate(now);
  if (range === 'today') return [d, d];
  if (range === 'week') {
    const m = getMon(0, now);
    return [m, getWeekDays(m)[6]];
  }
  if (range === 'month') {
    return [localDate(new Date(now.getFullYear(), now.getMonth(), 1)), d];
  }
  return ['0000-00-00', d];
}
