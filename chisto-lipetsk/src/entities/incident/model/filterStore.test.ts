import { describe, expect, it } from 'vitest';
import { filterIncidents, hasActiveFilters, type IncidentFilters } from './filterStore';
import { incident } from '@/test/fixtures';

const base: IncidentFilters = { query: '', org: '', uprava: 'all', upravas: [], status: 'all', period: 'all' };

const cases = [
  incident({ id: '0001', location: { address: 'ул. Советская, 3', coordinates: [39.6, 52.61], upravaId: 1 } }),
  incident({ id: '0002', location: { address: 'ул. Ленина, 7', coordinates: [39.61, 52.62], upravaId: 4 } }),
  incident({ id: '0003', location: { address: 'ул. Гагарина, 12', coordinates: [39.62, 52.63], upravaId: 4 } }),
  incident({ id: '0004', location: { address: 'ул. Зегеля, 1', coordinates: [39.63, 52.64], upravaId: 19 } }),
  // Адрес без управы: под фильтр по управам не попадает никогда
  incident({ id: '0005', location: { address: 'ул. Неизвестная, 5', coordinates: [39.64, 52.65], upravaId: 0 } }),
];

const ids = (filters: Partial<IncidentFilters>) =>
  filterIncidents(cases, { ...base, ...filters }).map((value) => value.id);

describe('filterIncidents по управам', () => {
  it('пустой список управ показывает все обращения', () => {
    expect(ids({})).toEqual(['0001', '0002', '0003', '0004', '0005']);
  });

  it('одна управа оставляет только её адреса', () => {
    expect(ids({ upravas: [4] })).toEqual(['0002', '0003']);
  });

  it('несколько управ — объединение', () => {
    expect(ids({ upravas: [1, 19] })).toEqual(['0001', '0004']);
  });

  it('заявка без управы в выборе не участвует', () => {
    expect(ids({ upravas: [1] })).not.toContain('0005');
  });

  it('мультивыбор главнее старого одиночного поля', () => {
    expect(ids({ upravas: [1], uprava: '4' })).toEqual(['0001']);
  });

  it('старое поле продолжает работать, когда мультивыбор пуст', () => {
    expect(ids({ uprava: '4' })).toEqual(['0002', '0003']);
  });

  it('выбор управ комбинируется с поиском по адресу', () => {
    expect(ids({ upravas: [4], query: 'гагарина' })).toEqual(['0003']);
  });
});

describe('hasActiveFilters', () => {
  it('считает фильтр по управам активным', () => {
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, upravas: [4] })).toBe(true);
  });
});
