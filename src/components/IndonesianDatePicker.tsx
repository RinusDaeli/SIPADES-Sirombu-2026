import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import { formatTanggalIndonesia } from '../utils/reportGenerator';

const DAY_NAMES = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface IndonesianDatePickerProps {
  value: string;
  onChange: (formattedDate: string) => void;
  placeholder?: string;
  className?: string;
}

export const IndonesianDatePicker: React.FC<IndonesianDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pilih tanggal...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => new Date(), []);

  // Parse initial view year and month from value or fallback to today
  const parseDateFromValue = (val: string): { year: number; month: number; day: number } => {
    if (!val) {
      return {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate(),
      };
    }

    // Pattern: "30 September 2026" or "12 Juli 2021"
    const matchIndo = val.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (matchIndo) {
      const d = parseInt(matchIndo[1], 10);
      const mIdx = MONTH_NAMES.findIndex(
        (m) => m.toLowerCase() === matchIndo[2].toLowerCase()
      );
      const y = parseInt(matchIndo[3], 10);
      if (mIdx !== -1 && !isNaN(d) && !isNaN(y)) {
        return { year: y, month: mIdx, day: d };
      }
    }

    // Pattern: "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return { year: y, month: m - 1, day: d };
    }

    // Native Date parse fallback
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth(),
        day: parsed.getDate(),
      };
    }

    return {
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate(),
    };
  };

  const parsedCurrent = parseDateFromValue(value);

  const [viewYear, setViewYear] = useState<number>(parsedCurrent.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedCurrent.month);

  // Sync view when opened
  useEffect(() => {
    if (isOpen) {
      const p = parseDateFromValue(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [isOpen, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectToday = () => {
    const d = today.getDate();
    const m = today.getMonth();
    const y = today.getFullYear();
    const formatted = `${d} ${MONTH_NAMES[m]} ${y}`;
    onChange(formatted);
    setViewYear(y);
    setViewMonth(m);
    setIsOpen(false);
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${day} ${MONTH_NAMES[viewMonth]} ${viewYear}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Calendar matrix calculation
  // 0 = Sunday (MIN), 1 = Monday (SEN), ..., 6 = Saturday (SAB)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Year options (1975 to 2035)
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 1975; y <= 2035; y++) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input element (matching expected selector input:nth-of-type(1)) */}
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => setIsOpen(true)}
          className={`w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-amber-400 rounded-lg px-2.5 py-1.5 pr-8 text-white text-xs font-medium focus:outline-none transition-colors ${className}`}
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2 text-slate-400 hover:text-amber-300 p-0.5 rounded transition-colors cursor-pointer"
          title="Buka kalender pilihan tanggal (MIN - SAB)"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Popover Indonesian Calendar */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 w-72 bg-[#0E1526] border border-slate-700/90 rounded-2xl shadow-2xl p-3.5 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month/Year Nav */}
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {/* Month Select */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-white font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Select */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-white font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Headers starting with MIN, SEN, SEL, RAB, KAM, JUM, SAB */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 pb-1 border-b border-slate-800">
            {DAY_NAMES.map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-[10px] font-bold tracking-wider py-0.5 ${
                  idx === 0
                    ? 'text-red-400' // MIN (Minggu) red color
                    : idx === 5
                    ? 'text-emerald-400' // JUM (Jumat)
                    : 'text-slate-400'
                }`}
                title={`Hari ${dayName}`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Blank offset cells for days before the 1st of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="w-8 h-7" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected =
                parsedCurrent.year === viewYear &&
                parsedCurrent.month === viewMonth &&
                parsedCurrent.day === dayNum;

              const isTodayCell =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === dayNum;

              // Check if Sunday (0)
              const cellDayOfWeek = (firstDayOfMonth + idx) % 7;
              const isSunday = cellDayOfWeek === 0;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`w-8 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                      : isTodayCell
                      ? 'bg-slate-800 text-amber-300 border border-amber-400/80 font-bold'
                      : isSunday
                      ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={
                    isTodayCell
                      ? `Hari Ini: ${dayNum} ${MONTH_NAMES[viewMonth]} ${viewYear}`
                      : `${dayNum} ${MONTH_NAMES[viewMonth]} ${viewYear}`
                  }
                >
                  {dayNum}
                  {isTodayCell && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Bar: Quick "Hari Ini" Action */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Pilih Hari Ini ({today.getDate()} {MONTH_NAMES[today.getMonth()]})
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
