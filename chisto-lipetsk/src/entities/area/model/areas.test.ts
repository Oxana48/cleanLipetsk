import { describe, expect, it } from 'vitest';
import { cityOfUprava, FALLBACK_AREAS, parseAreas, upravaCountLabel, upravaWord } from './areas';

const feature = (properties: Record<string, unknown>) => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Polygon', coordinates: [] },
});

const collection = (...features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('parseAreas', () => {
  it('группирует управы по городам и сортирует номера', () => {
    const areas = parseAreas(
      collection(
        feature({ kind: 'area', city: 'Липецк', number: 3 }),
        feature({ kind: 'area', city: 'Липецк', number: 1 }),
        feature({ kind: 'area', city: 'Елец', number: 2 }),
        // округа и заявки в списке управ не участвуют
        feature({ kind: 'district', city: 'Липецк', area_number: 9 }),
        feature({ kind: 'case', city: 'Липецк', number: 1 }),
      ),
    );

    expect(areas.cities).toEqual(['Липецк', 'Елец']);
    expect(areas.numbersByCity['Липецк']).toEqual([1, 3]);
    expect(areas.numbersByCity['Елец']).toEqual([2]);
    expect(areas.allNumbers).toEqual([1, 2, 3]);
    expect(areas.cityByNumber[2]).toBe('Елец');
  });

  it('берёт номера округов, если меток управ в файле нет', () => {
    const areas = parseAreas(
      collection(
        feature({ kind: 'district', city: 'Липецк', area_number: 7 }),
        feature({ kind: 'district', city: 'Липецк', area_number: 7 }),
        feature({ kind: 'district', city: 'Липецк', area_number: 5 }),
      ),
    );

    expect(areas.numbersByCity['Липецк']).toEqual([5, 7]);
  });

  it('не падает на мусоре и пустом файле', () => {
    expect(parseAreas(null).allNumbers).toEqual([]);
    expect(parseAreas({}).allNumbers).toEqual([]);
    expect(parseAreas({ features: 'нет' }).allNumbers).toEqual([]);
    expect(parseAreas(collection(feature({ kind: 'area', number: 'три' }))).allNumbers).toEqual([]);
    expect(parseAreas(collection(null, 42, { properties: null })).allNumbers).toEqual([]);
  });

  it('без города в свойствах подставляет Липецк', () => {
    const areas = parseAreas(collection(feature({ kind: 'area', number: 4 })));

    expect(areas.cities).toEqual(['Липецк']);
    expect(areas.cityByNumber[4]).toBe('Липецк');
  });
});

describe('upravaCountLabel', () => {
  it.each([
    [1, '1 управа'],
    [2, '2 управы'],
    [4, '4 управы'],
    [5, '5 управ'],
    [11, '11 управ'],
    [12, '12 управ'],
    [14, '14 управ'],
    [19, '19 управ'],
    [21, '21 управа'],
    [22, '22 управы'],
    [25, '25 управ'],
  ])('%i — %s', (count, expected) => {
    expect(upravaCountLabel(count)).toBe(expected);
    expect(upravaWord(count)).toBe(expected.split(' ')[1]);
  });
});

describe('cityOfUprava', () => {
  it('находит город по номеру и молчит про неизвестный', () => {
    expect(cityOfUprava(FALLBACK_AREAS, 4)).toBe('Липецк');
    expect(cityOfUprava(FALLBACK_AREAS, 0)).toBeNull();
    expect(cityOfUprava(FALLBACK_AREAS, 99)).toBeNull();
    expect(cityOfUprava(FALLBACK_AREAS, null)).toBeNull();
  });
});

describe('FALLBACK_AREAS', () => {
  it('содержит 19 управ Липецка — как в прежней статичной подписи', () => {
    expect(FALLBACK_AREAS.cities).toEqual(['Липецк']);
    expect(FALLBACK_AREAS.allNumbers).toHaveLength(19);
    expect(upravaCountLabel(FALLBACK_AREAS.allNumbers.length)).toBe('19 управ');
  });
});
