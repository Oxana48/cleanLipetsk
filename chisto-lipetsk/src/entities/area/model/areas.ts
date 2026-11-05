import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Управы города для фильтра диспетчерской.
//
// Справочник собирает сервис документов: backend/scripts/export_map_geojson.py
// пишет areas.geojson — это те же управы и округа, что привязаны к адресам
// заявок. Файл лежит рядом со сборкой, поэтому адрес берём от BASE_URL: и в
// /dispatch/, и в корне домена, и в /dispatch-next/ он ищется на своём месте.
// Номер управы уникален внутри города — обращения фильтруются по нему.
// ─────────────────────────────────────────────────────────────────────────────

export const AREAS_URL = `${import.meta.env.BASE_URL}areas.geojson`;

// Подпись города, пока справочник не загрузился. Второй город появится
// в файле — интерфейс подхватит его сам (номера управ начнутся заново).
export const DEFAULT_CITY = 'Липецк';

export interface IAreas {
  cities: string[]; // города в порядке появления в файле
  numbersByCity: Record<string, number[]>; // номера управ города, по возрастанию
  cityByNumber: Record<number, string>; // город по номеру управы — для карточки заявки
  allNumbers: number[]; // все номера управ, по возрастанию
}

const EMPTY_AREAS: IAreas = { cities: [], numbersByCity: {}, cityByNumber: {}, allNumbers: [] };

// Собирает справочник: города в переданном порядке, номера — без повторов и по
// возрастанию. Обратный указатель «номер → город» строится здесь же, чтобы
// карточке заявки не приходилось перебирать весь список.
function makeAreas(cities: string[], numbersByCity: Record<string, number[]>): IAreas {
  const cityByNumber: Record<number, string> = {};
  const all = new Set<number>();

  for (const city of cities) {
    const numbers = [...new Set(numbersByCity[city] ?? [])].filter((number) => number > 0).sort((a, b) => a - b);
    numbersByCity[city] = numbers;
    for (const number of numbers) {
      // Один номер в двух городах — ошибка данных; первый город остаётся главным
      cityByNumber[number] ??= city;
      all.add(number);
    }
  }

  return {
    cities,
    numbersByCity,
    cityByNumber,
    allNumbers: [...all].sort((a, b) => a - b),
  };
}

// Резерв, если файл справочника не загрузился: 19 управ Липецка — ровно то,
// что раньше было зашито в статичную подпись карты. Фильтр заявок работает
// и без файла: номера управ приходят в самих заявках.
export const FALLBACK_AREAS: IAreas = makeAreas(
  [DEFAULT_CITY],
  { [DEFAULT_CITY]: Array.from({ length: 19 }, (_, index) => index + 1) },
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Номер из свойства GeoJSON: число или строка с числом, иначе — null
const readNumber = (value: unknown): number | null => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : null;
};

// Разбирает FeatureCollection из /dispatch/areas.geojson. Номера берём у меток
// управ (kind=area); если меток нет — у округов (kind=district, area_number).
// Всё остальное (мусор, чужая структура) просто пропускаем.
export function parseAreas(data: unknown): IAreas {
  const features = isRecord(data) && Array.isArray(data.features) ? data.features : null;
  if (!features) return EMPTY_AREAS;

  const cities: string[] = [];
  const areaNumbers: Record<string, number[]> = {};
  const districtNumbers: Record<string, number[]> = {};

  const remember = (bucket: Record<string, number[]>, city: string, number: number | null) => {
    if (number === null) return;
    if (!cities.includes(city)) cities.push(city);
    (bucket[city] ??= []).push(number);
  };

  for (const feature of features) {
    if (!isRecord(feature) || !isRecord(feature.properties)) continue;
    const properties = feature.properties;
    const city = typeof properties.city === 'string' && properties.city.trim() ? properties.city.trim() : DEFAULT_CITY;

    if (properties.kind === 'area') {
      remember(areaNumbers, city, readNumber(properties.number));
    } else if (properties.kind === 'district') {
      remember(districtNumbers, city, readNumber(properties.area_number));
    }
  }

  // Метки управ есть — они и есть список; иначе опираемся на округа
  for (const city of cities) {
    areaNumbers[city] ??= districtNumbers[city] ?? [];
  }

  return makeAreas(cities, areaNumbers);
}

// Склонение: 1 управа, 2 управы, 5 управ
export function upravaWord(count: number): string {
  const tail = Math.abs(count) % 100;
  const last = tail % 10;
  if (tail >= 11 && tail <= 14) return 'управ';
  if (last === 1) return 'управа';
  if (last >= 2 && last <= 4) return 'управы';
  return 'управ';
}

export function upravaCountLabel(count: number): string {
  return `${count} ${upravaWord(count)}`;
}

// Город по номеру управы — для подписи в карточке заявки; null, если номера нет
export function cityOfUprava(areas: IAreas, number: number | null | undefined): string | null {
  if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return null;
  return areas.cityByNumber[number] ?? null;
}

// ── Загрузка: один запрос на всё приложение ─────────────────────────────────

let cached: IAreas | null = null;
let pending: Promise<IAreas> | null = null;

async function fetchAreas(): Promise<IAreas> {
  try {
    const response = await fetch(AREAS_URL);
    if (!response.ok) throw new Error(`ответ ${response.status}`);
    return parseAreas(await response.json());
  } catch (error) {
    // Справочник нужен только для подписей и списка управ: заявки фильтруются
    // по своим номерам, поэтому карта и лента остаются рабочими
    console.warn('Справочник управ не загрузился:', error);
    return EMPTY_AREAS;
  }
}

export function loadAreas(): Promise<IAreas> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchAreas().then((areas) => {
      // Неудачу не запоминаем: следующий заход попробует файл снова
      if (areas.allNumbers.length) cached = areas;
      return areas;
    });
  }
  return pending;
}

/**
 * Справочник управ для интерфейса. Пока файл грузится (или недоступен),
 * возвращается резервный список — подпись «Липецк · 19 управ» не мигает.
 */
export function useAreas(): IAreas {
  const [areas, setAreas] = useState<IAreas>(cached ?? EMPTY_AREAS);

  useEffect(() => {
    let alive = true;
    loadAreas().then((value) => {
      if (alive) setAreas(value.allNumbers.length ? value : EMPTY_AREAS);
    });
    return () => {
      alive = false;
    };
  }, []);

  return areas.allNumbers.length ? areas : FALLBACK_AREAS;
}
