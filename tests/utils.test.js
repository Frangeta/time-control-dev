import { describe, it, expect } from 'vitest';
import {
  fmtMs, fmtMin, fmtH,
  localDate, fmtTime, fmtDateShort,
  timeRangeMinutes,
  getMon, getWeekDays, getRange,
} from '../src/utils.js';

// ── fmtMs ───────────────────────────────────────────────────────────────────
describe('fmtMs', () => {
  it('formatea cero como 00:00:00', () => {
    expect(fmtMs(0)).toBe('00:00:00');
  });
  it('formatea 90 segundos correctamente', () => {
    expect(fmtMs(90_000)).toBe('00:01:30');
  });
  it('formatea 1 hora exacta', () => {
    expect(fmtMs(3_600_000)).toBe('01:00:00');
  });
  it('formatea 2h 30m 15s', () => {
    expect(fmtMs((2*3600 + 30*60 + 15) * 1000)).toBe('02:30:15');
  });
  it('rellena con ceros horas de un dígito', () => {
    expect(fmtMs(5 * 3600_000)).toBe('05:00:00');
  });
});

// ── fmtMin ──────────────────────────────────────────────────────────────────
describe('fmtMin', () => {
  it('devuelve "0m" para 0', ()    => expect(fmtMin(0)).toBe('0m'));
  it('devuelve "0m" para null', () => expect(fmtMin(null)).toBe('0m'));
  it('devuelve "0m" para negativo', () => expect(fmtMin(-5)).toBe('0m'));
  it('minutos solos: 30m', ()      => expect(fmtMin(30)).toBe('30m'));
  it('hora exacta: 1h', ()         => expect(fmtMin(60)).toBe('1h'));
  it('horas y minutos: 1h 30m', () => expect(fmtMin(90)).toBe('1h 30m'));
  it('horas exactas: 8h', ()       => expect(fmtMin(480)).toBe('8h'));
  it('horas y minutos: 8h 15m', () => expect(fmtMin(495)).toBe('8h 15m'));
});

// ── fmtH ────────────────────────────────────────────────────────────────────
describe('fmtH', () => {
  it('60 min → "1.0h"',  () => expect(fmtH(60)).toBe('1.0h'));
  it('90 min → "1.5h"',  () => expect(fmtH(90)).toBe('1.5h'));
  it('0 min  → "0.0h"',  () => expect(fmtH(0)).toBe('0.0h'));
  it('480 min → "8.0h"', () => expect(fmtH(480)).toBe('8.0h'));
});

// ── localDate ───────────────────────────────────────────────────────────────
describe('localDate', () => {
  it('formatea correctamente una fecha conocida', () => {
    expect(localDate(new Date('2026-03-24T12:00:00'))).toBe('2026-03-24');
  });
  it('rellena mes y día con cero si es necesario', () => {
    expect(localDate(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
  });
});

// ── fmtTime ─────────────────────────────────────────────────────────────────
describe('fmtTime', () => {
  it('devuelve "--:--" para null', () => {
    expect(fmtTime(null)).toBe('--:--');
  });
  it('devuelve "--:--" para undefined', () => {
    expect(fmtTime(undefined)).toBe('--:--');
  });
});

// ── timeRangeMinutes ────────────────────────────────────────────────────────
describe('timeRangeMinutes', () => {
  it('rango normal: 09:00 → 17:00 = 480 min', () => {
    expect(timeRangeMinutes(9, 0, 17, 0)).toBe(480);
  });
  it('rango de 30 min: 14:30 → 15:00 = 30 min', () => {
    expect(timeRangeMinutes(14, 30, 15, 0)).toBe(30);
  });
  it('cruce de medianoche: 22:00 → 02:00 = 240 min', () => {
    expect(timeRangeMinutes(22, 0, 2, 0)).toBe(240);
  });
  it('cruce de medianoche: 23:59 → 00:00 = 1 min', () => {
    expect(timeRangeMinutes(23, 59, 0, 0)).toBe(1);
  });
  it('rango de 1 min: 10:00 → 10:01 = 1 min', () => {
    expect(timeRangeMinutes(10, 0, 10, 1)).toBe(1);
  });
});

// ── getMon ──────────────────────────────────────────────────────────────────
describe('getMon', () => {
  // 2026-03-24 es martes
  const MARTES = new Date('2026-03-24T12:00:00');

  it('devuelve el lunes de la semana actual', () => {
    expect(getMon(0, MARTES)).toBe('2026-03-23');
  });
  it('offset -1 devuelve el lunes de la semana anterior', () => {
    expect(getMon(-1, MARTES)).toBe('2026-03-16');
  });
  it('offset +1 devuelve el lunes de la semana siguiente', () => {
    expect(getMon(1, MARTES)).toBe('2026-03-30');
  });

  // 2026-03-23 es lunes
  const LUNES = new Date('2026-03-23T12:00:00');
  it('cuando hoy es lunes devuelve el mismo día', () => {
    expect(getMon(0, LUNES)).toBe('2026-03-23');
  });

  // 2026-03-29 es domingo
  const DOMINGO = new Date('2026-03-29T12:00:00');
  it('cuando hoy es domingo devuelve el lunes de esa semana', () => {
    expect(getMon(0, DOMINGO)).toBe('2026-03-23');
  });
});

// ── getWeekDays ─────────────────────────────────────────────────────────────
describe('getWeekDays', () => {
  it('devuelve exactamente 7 días', () => {
    expect(getWeekDays('2026-03-23')).toHaveLength(7);
  });
  it('el primer día es el lunes dado', () => {
    expect(getWeekDays('2026-03-23')[0]).toBe('2026-03-23');
  });
  it('el último día es el domingo', () => {
    expect(getWeekDays('2026-03-23')[6]).toBe('2026-03-29');
  });
  it('los días son consecutivos', () => {
    const days = getWeekDays('2026-03-23');
    for (let i = 1; i < 7; i++) {
      const prev = new Date(days[i-1] + 'T12:00:00');
      const curr = new Date(days[i]   + 'T12:00:00');
      expect(curr - prev).toBe(86_400_000); // 24h exactas
    }
  });
});

// ── getRange ────────────────────────────────────────────────────────────────
describe('getRange', () => {
  const NOW = new Date('2026-03-24T12:00:00'); // martes

  it('today → [hoy, hoy]', () => {
    expect(getRange('today', NOW)).toEqual(['2026-03-24', '2026-03-24']);
  });
  it('week → [lunes, domingo]', () => {
    expect(getRange('week', NOW)).toEqual(['2026-03-23', '2026-03-29']);
  });
  it('month → [1 de mes, hoy]', () => {
    expect(getRange('month', NOW)).toEqual(['2026-03-01', '2026-03-24']);
  });
  it('all → ["0000-00-00", hoy]', () => {
    expect(getRange('all', NOW)).toEqual(['0000-00-00', '2026-03-24']);
  });
});
