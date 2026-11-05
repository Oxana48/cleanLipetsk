import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useFilterStore } from '@/entities/incident/model/filterStore';
import { upravaCountLabel, useAreas } from '../model/areas';

// «Липецк ▾ · 19 управ ▾» в шапке «Обстановки»: город и управы двумя списками.
// Отметки управ пишутся в общий фильтр (upravas) — по ним же фильтруются лента
// обращений и метки на карте, поэтому отдельного состояния у карты нет.
export const AreasFilter: React.FC = () => {
  const areas = useAreas();
  const upravas = useFilterStore((s) => s.upravas);
  const setFilters = useFilterStore((s) => s.set);
  const [city, setCity] = useState('');
  const [menu, setMenu] = useState<'city' | 'upravas' | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const cities = areas.cities;
  const currentCity = cities.includes(city) ? city : cities[0];
  const numbers = areas.numbersByCity[currentCity] ?? areas.allNumbers;
  // Отметки другого города к текущему списку не относятся — их не показываем
  const selected = upravas.filter((number) => numbers.includes(number));
  const count = selected.length;

  // Справочник приходит асинхронно. Пока выбора нет, отмечаем все управы:
  // подпись «19 управ» и список должны означать одно и то же — иначе
  // открываешь список, а там пусто, хотя подпись обещает «все».
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || numbers.length === 0) return;
    initialized.current = true;
    if (upravas.length === 0) setFilters({ upravas: [...numbers] });
  }, [numbers, upravas.length, setFilters]);

  // Клик мимо списка или Esc его закрывают
  useEffect(() => {
    if (!menu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  const toggle = (number: number, checked: boolean) => {
    const next = checked
      ? [...selected, number].sort((left, right) => left - right)
      : selected.filter((value) => value !== number);
    // Пустой список в фильтре значит «без ограничения», то есть все управы:
    // сняв последнюю галочку, возвращаем полный набор, а не пустую ленту
    setFilters({ upravas: next.length ? next : [...numbers] });
  };

  const chooseCity = (value: string) => {
    setMenu(null);
    if (value === currentCity) return;
    setCity(value);
    // В другом городе свои номера управ — отмечаем все его управы
    setFilters({ upravas: [...(areas.numbersByCity[value] ?? areas.allNumbers)] });
  };

  const buttonClass =
    'flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--hover)] hover:text-foreground';
  const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
    <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
  );

  return (
    <div ref={root} className="relative flex items-center gap-1 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setMenu(menu === 'city' ? null : 'city')}
        aria-haspopup="listbox"
        aria-expanded={menu === 'city'}
        aria-label={`Город: ${currentCity}`}
        className={buttonClass}
      >
        {currentCity}
        <Chevron open={menu === 'city'} />
      </button>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => setMenu(menu === 'upravas' ? null : 'upravas')}
        aria-haspopup="true"
        aria-expanded={menu === 'upravas'}
        aria-label={count ? `Выбрано управ: ${count}` : `Все управы: ${numbers.length}`}
        className={`${buttonClass} font-num`}
      >
        {upravaCountLabel(count || numbers.length)}
        <Chevron open={menu === 'upravas'} />
      </button>

      {menu === 'city' && (
        <div role="listbox" aria-label="Город" className="absolute left-0 top-full z-50 mt-1.5 w-[150px] rounded-xl border border-border bg-[var(--popover)] p-1 shadow-2xl">
          {cities.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === currentCity}
              onClick={() => chooseCity(name)}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                name === currentCity
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
              }`}
            >
              {name}
              {name === currentCity && <Check className="size-3.5 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      {menu === 'upravas' && (
        <div role="group" aria-label="Управы города" className="absolute right-0 top-full z-50 mt-1.5 w-[196px] rounded-xl border border-border bg-[var(--popover)] p-1 shadow-2xl">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-foreground transition-colors hover:bg-[var(--hover)]">
            <input
              type="checkbox"
              // «Все управы» — выбор всех пунктов списка; пустого выбора в фильтре
              // нет (он значит «все»), поэтому клик всегда отмечает все
              checked={count === numbers.length}
              onChange={() => setFilters({ upravas: [...numbers] })}
              className="size-3.5 cursor-pointer accent-[var(--primary)]"
            />
            все управы
            <span className="font-num ml-auto text-[11px] text-muted-foreground">{numbers.length}</span>
          </label>
          <div className="my-1 h-px bg-border" />
          <div className="max-h-[260px] overflow-y-auto">
            {numbers.map((number) => (
              <label
                key={number}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] text-foreground transition-colors hover:bg-[var(--hover)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(number)}
                  onChange={(event) => toggle(number, event.target.checked)}
                  className="size-3.5 cursor-pointer accent-[var(--primary)]"
                />
                Управа № {number}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

