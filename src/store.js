/**
 * store.js — Lógica de negocio pura sobre las entradas.
 * Todas las funciones son puras: reciben datos como parámetros,
 * no acceden al estado global `S` ni al DOM.
 * Esto permite testearlas con Vitest sin entorno browser.
 */

import { COLORS } from './utils.js';

// ── Entradas ────────────────────────────────────────────────────────────────

/** Filtra entradas por la fecha exacta "YYYY-MM-DD" almacenada en e.date */
export function entriesByDate(entries, date) {
  return entries.filter(e => e.date === date);
}

/** Suma los minutos de un array de entradas */
export function totalMinutes(entries) {
  return entries.reduce((a, e) => a + e.minutes, 0);
}

/** Minutos por día para un array de fechas (para renderizar la semana) */
export function weeklyMinutes(entries, days) {
  return days.map(d => totalMinutes(entriesByDate(entries, d)));
}

/** Agrupa entradas por categoría → { cat: totalMinutos } */
export function minutesByCategory(entries) {
  const bycat = {};
  entries.forEach(e => {
    const k = e.cat || 'Sin cat';
    bycat[k] = (bycat[k] || 0) + e.minutes;
  });
  return bycat;
}

/** Filtra entradas dentro de un rango de fechas [from, to] inclusive */
export function entriesInRange(entries, from, to) {
  return entries.filter(e => e.date >= from && e.date <= to);
}

/** Color para una categoría según su posición en el array de categorías */
export function catColorFor(categories, cat) {
  const i = categories.indexOf(cat);
  return COLORS[i % COLORS.length] || '#5c7fa0';
}

// ── Validación de estado cargado ────────────────────────────────────────────

/**
 * Valida y normaliza el objeto persisted cargado de localStorage/Firestore.
 * Devuelve solo los campos válidos que deben sobreescribir el estado por defecto.
 * @param {object} p — objeto deserializado
 * @returns {object} campos válidos
 */
export function validatePersistedState(p) {
  if (!p || typeof p !== 'object') return {};
  const valid = {};

  if (Array.isArray(p.categories))                        valid.categories   = p.categories;
  if (Array.isArray(p.entries))                           valid.entries      = p.entries;
  if (p.timer && typeof p.timer === 'object')             valid.timer        = p.timer;
  if (typeof p.notif === 'boolean')                       valid.notif        = p.notif;
  if (typeof p.palette === 'string')                      valid.palette      = p.palette;
  if (Array.isArray(p.goals) && p.goals.length === 7)    valid.goals        = p.goals;
  if (typeof p.notifInterval === 'number'
      && p.notifInterval >= 1
      && p.notifInterval <= 240)                          valid.notifInterval = p.notifInterval;
  if (typeof p.notifMode === 'string'
      && ['both','active','inactive'].includes(p.notifMode)) valid.notifMode = p.notifMode;

  return valid;
}

// ── Timer ───────────────────────────────────────────────────────────────────

/** Calcula los ms transcurridos dado el estado del timer (sin Date.now) */
export function calcElapsedMs(timer, nowMs = Date.now()) {
  if (!timer.on)     return 0;
  if (timer.paused)  return timer.elapsed;
  return timer.elapsed + (timer.start ? nowMs - timer.start : 0);
}

/** Estado inicial del timer */
export const TIMER_DEFAULT = Object.freeze({
  on: false, paused: false, start: null,
  elapsed: 0, task: '', cat: '', startWall: null,
});
