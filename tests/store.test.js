import { describe, it, expect } from 'vitest';
import {
  entriesByDate,
  totalMinutes,
  weeklyMinutes,
  minutesByCategory,
  entriesInRange,
  catColorFor,
  validatePersistedState,
  calcElapsedMs,
  TIMER_DEFAULT,
} from '../src/store.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ENTRIES = [
  { id: 1001, date: '2026-03-23', task: 'Diseño UI',       cat: 'Diseño',     minutes: 120 },
  { id: 1002, date: '2026-03-23', task: 'Revisión PR',     cat: 'Desarrollo', minutes: 45  },
  { id: 1003, date: '2026-03-24', task: 'Reunión equipo',  cat: 'Reuniones',  minutes: 60  },
  { id: 1004, date: '2026-03-24', task: 'Sin categoría',   cat: '',           minutes: 30  },
  { id: 1005, date: '2026-03-25', task: 'Formación Vite',  cat: 'Formación',  minutes: 90  },
];

// ── entriesByDate ─────────────────────────────────────────────────────────────
describe('entriesByDate', () => {
  it('filtra correctamente por fecha', () => {
    expect(entriesByDate(ENTRIES, '2026-03-23')).toHaveLength(2);
    expect(entriesByDate(ENTRIES, '2026-03-24')).toHaveLength(2);
    expect(entriesByDate(ENTRIES, '2026-03-25')).toHaveLength(1);
  });

  it('devuelve array vacío si no hay entradas ese día', () => {
    expect(entriesByDate(ENTRIES, '2026-03-22')).toHaveLength(0);
  });

  /**
   * TEST CLAVE — Entrada manual en día anterior:
   * Una entrada con date:'2026-03-23' introducida HOY (2026-03-24)
   * debe aparecer el día 23, NO el 24.
   */
  it('entrada manual en día anterior aparece en su fecha, no en la de hoy', () => {
    const entries = [
      // id = timestamp de AHORA (2026-03-24), pero date = ayer (2026-03-23)
      { id: Date.now(), date: '2026-03-23', task: 'manual ayer', cat: '', minutes: 60 },
    ];
    expect(entriesByDate(entries, '2026-03-23')).toHaveLength(1);
    expect(entriesByDate(entries, '2026-03-24')).toHaveLength(0);
  });

  it('usa e.date (string) para filtrar, no el timestamp id', () => {
    const entry = { id: 9999999999999, date: '2026-01-01', task: 'test', cat: '', minutes: 10 };
    expect(entriesByDate([entry], '2026-01-01')).toHaveLength(1);
    expect(entriesByDate([entry], '2026-03-24')).toHaveLength(0);
  });
});

// ── totalMinutes ──────────────────────────────────────────────────────────────
describe('totalMinutes', () => {
  it('suma los minutos de un array de entradas', () => {
    expect(totalMinutes(ENTRIES)).toBe(345);
  });

  it('devuelve 0 para array vacío', () => {
    expect(totalMinutes([])).toBe(0);
  });

  it('día 23: 120 + 45 = 165 min', () => {
    expect(totalMinutes(entriesByDate(ENTRIES, '2026-03-23'))).toBe(165);
  });
});

// ── weeklyMinutes ─────────────────────────────────────────────────────────────
describe('weeklyMinutes', () => {
  const WEEK = ['2026-03-23','2026-03-24','2026-03-25','2026-03-26','2026-03-27','2026-03-28','2026-03-29'];

  it('devuelve 7 valores', () => {
    expect(weeklyMinutes(ENTRIES, WEEK)).toHaveLength(7);
  });

  it('coloca los minutos en el día correcto', () => {
    const mins = weeklyMinutes(ENTRIES, WEEK);
    expect(mins[0]).toBe(165); // lun 23
    expect(mins[1]).toBe(90);  // mar 24
    expect(mins[2]).toBe(90);  // mié 25
    expect(mins[3]).toBe(0);   // jue 26 (sin entradas)
    expect(mins[6]).toBe(0);   // dom 29 (sin entradas)
  });

  /**
   * TEST CLAVE — La vista semanal no mezcla días:
   * Entrada del lunes (23) no aparece en el martes (24).
   */
  it('entrada del lunes NO se cuenta en el martes', () => {
    const entries = [
      { id: 1, date: '2026-03-23', task: 'lunes', cat: '', minutes: 120 },
    ];
    const mins = weeklyMinutes(entries, WEEK);
    expect(mins[0]).toBe(120); // lunes: tiene las horas
    expect(mins[1]).toBe(0);   // martes: debe ser 0
  });
});

// ── minutesByCategory ─────────────────────────────────────────────────────────
describe('minutesByCategory', () => {
  it('agrupa por categoría correctamente', () => {
    const result = minutesByCategory(ENTRIES);
    expect(result['Diseño']).toBe(120);
    expect(result['Desarrollo']).toBe(45);
    expect(result['Reuniones']).toBe(60);
    expect(result['Formación']).toBe(90);
  });

  it('entradas sin categoría van a "Sin cat"', () => {
    const result = minutesByCategory(ENTRIES);
    expect(result['Sin cat']).toBe(30);
  });

  it('devuelve objeto vacío para array vacío', () => {
    expect(minutesByCategory([])).toEqual({});
  });
});

// ── entriesInRange ────────────────────────────────────────────────────────────
describe('entriesInRange', () => {
  it('incluye entradas en los extremos del rango', () => {
    const result = entriesInRange(ENTRIES, '2026-03-23', '2026-03-24');
    expect(result).toHaveLength(4);
  });

  it('excluye entradas fuera del rango', () => {
    const result = entriesInRange(ENTRIES, '2026-03-24', '2026-03-24');
    expect(result).toHaveLength(2);
  });

  it('rango de un solo día', () => {
    const result = entriesInRange(ENTRIES, '2026-03-25', '2026-03-25');
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe('Formación Vite');
  });
});

// ── catColorFor ───────────────────────────────────────────────────────────────
describe('catColorFor', () => {
  const cats = ['Reuniones','Desarrollo','Diseño'];

  it('devuelve el color correspondiente al índice', () => {
    expect(catColorFor(cats, 'Reuniones')).toBe('#2d7ff9'); // índice 0
    expect(catColorFor(cats, 'Desarrollo')).toBe('#00d4a0'); // índice 1
  });

  it('devuelve fallback para categoría no encontrada', () => {
    expect(catColorFor(cats, 'Desconocida')).toBe('#5c7fa0');
  });
});

// ── validatePersistedState ────────────────────────────────────────────────────
describe('validatePersistedState', () => {
  it('devuelve {} para null', ()      => expect(validatePersistedState(null)).toEqual({}));
  it('devuelve {} para string', ()    => expect(validatePersistedState('x')).toEqual({}));
  it('acepta categories si es array', () => {
    const { categories } = validatePersistedState({ categories: ['A','B'] });
    expect(categories).toEqual(['A','B']);
  });
  it('rechaza goals con longitud != 7', () => {
    const result = validatePersistedState({ goals: [8,8,8,8,8] }); // solo 5
    expect(result.goals).toBeUndefined();
  });
  it('acepta goals con longitud 7', () => {
    const result = validatePersistedState({ goals: [8,8,8,8,8,0,0] });
    expect(result.goals).toEqual([8,8,8,8,8,0,0]);
  });
  it('rechaza notifInterval fuera de rango', () => {
    expect(validatePersistedState({ notifInterval: 0 }).notifInterval).toBeUndefined();
    expect(validatePersistedState({ notifInterval: 999 }).notifInterval).toBeUndefined();
  });
  it('acepta notifInterval en rango [1, 240]', () => {
    expect(validatePersistedState({ notifInterval: 30 }).notifInterval).toBe(30);
  });
  it('rechaza notifMode desconocido', () => {
    expect(validatePersistedState({ notifMode: 'never' }).notifMode).toBeUndefined();
  });
  it('acepta notifMode válido', () => {
    expect(validatePersistedState({ notifMode: 'active' }).notifMode).toBe('active');
  });
});

// ── calcElapsedMs ─────────────────────────────────────────────────────────────
describe('calcElapsedMs', () => {
  it('timer apagado → 0', () => {
    const timer = { ...TIMER_DEFAULT };
    expect(calcElapsedMs(timer, Date.now())).toBe(0);
  });

  it('timer en pausa → devuelve elapsed fijo', () => {
    const timer = { ...TIMER_DEFAULT, on: true, paused: true, elapsed: 5000, start: null };
    expect(calcElapsedMs(timer, Date.now())).toBe(5000);
  });

  it('timer activo → suma elapsed + tiempo desde start', () => {
    const startMs = 1_000_000;
    const nowMs   = 1_060_000; // 60 segundos después
    const timer   = { ...TIMER_DEFAULT, on: true, paused: false, start: startMs, elapsed: 10_000 };
    expect(calcElapsedMs(timer, nowMs)).toBe(70_000); // 10s + 60s
  });
});
