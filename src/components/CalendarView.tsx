import React, { useState } from 'react';
import { Booking, DateBlock, User } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Wrench,
  Sparkles,
  Info,
  Check,
  Clock,
  Layers,
} from 'lucide-react';

interface CalendarViewProps {
  bookings: Booking[];
  blocks: DateBlock[];
  users: User[];
  currentUser: User;
  onSelectDateRange: (startDate: string, endDate: string) => void;
  onOpenBookingModal: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  bookings,
  blocks,
  users,
  currentUser,
  onSelectDateRange,
  onOpenBookingModal,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1)); // October 2026
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [dayDetailsDate, setDayDetailsDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(2026, 9, 1)); // October 2026
  };

  // Helper to get formatted string YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Day occupancy helper
  const getDayInfo = (dateStr: string) => {
    // 1. Check Maintenance / Administrative blocks
    const block = blocks.find((b) => dateStr >= b.startDate && dateStr <= b.endDate);
    if (block) {
      return {
        type: 'block' as const,
        block,
        label: block.title,
        isBlocked: true,
      };
    }

    // 2. Check Confirmed Bookings
    const booking = bookings.find(
      (b) =>
        (b.status === 'confirmed' || b.status === 'completed') &&
        dateStr >= b.checkInDate &&
        dateStr <= b.checkOutDate
    );

    if (booking) {
      const isCheckIn = dateStr === booking.checkInDate;
      const isCheckOut = dateStr === booking.checkOutDate;
      const isMine = booking.userId === currentUser.id;
      return {
        type: 'booking' as const,
        booking,
        label: booking.userName,
        isCheckIn,
        isCheckOut,
        isMine,
        color: booking.userColor,
        isOccupied: true,
      };
    }

    // 3. Check Cleaning Buffer (day after checkout if applied)
    const bufferBooking = bookings.find((b) => {
      if (!b.cleaningBufferApplied || !b.cleaningBufferEndDate) return false;
      return (
        (b.status === 'confirmed' || b.status === 'completed') &&
        dateStr > b.checkOutDate &&
        dateStr <= b.cleaningBufferEndDate
      );
    });

    if (bufferBooking) {
      return {
        type: 'cleaning' as const,
        booking: bufferBooking,
        label: 'Sanitización post check-out',
        isCleaning: true,
      };
    }

    return {
      type: 'free' as const,
      isFree: true,
    };
  };

  // Handle clicking on a day to select date range
  const handleDayClick = (dateStr: string) => {
    const info = getDayInfo(dateStr);
    setDayDetailsDate(dateStr);

    if (info.type !== 'free') {
      // Cannot start selection on an occupied day
      return;
    }

    if (!selectedStart || (selectedStart && selectedEnd)) {
      setSelectedStart(dateStr);
      setSelectedEnd(null);
    } else {
      if (dateStr < selectedStart) {
        setSelectedStart(dateStr);
        setSelectedEnd(null);
      } else {
        // Validate if there are any overlaps in between
        let hasConflict = false;
        const cur = new Date(selectedStart + 'T00:00:00');
        const end = new Date(dateStr + 'T00:00:00');

        while (cur <= end) {
          const dStr = cur.toISOString().split('T')[0];
          const dInfo = getDayInfo(dStr);
          if (dInfo.type !== 'free') {
            hasConflict = true;
            break;
          }
          cur.setDate(cur.getDate() + 1);
        }

        if (hasConflict) {
          // Reset selection to clicked date
          setSelectedStart(dateStr);
          setSelectedEnd(null);
        } else {
          setSelectedEnd(dateStr);
          onSelectDateRange(selectedStart, dateStr);
        }
      }
    }
  };

  // Generate calendar days for current month
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday as index 0

  type CalendarDayItem =
    | { empty: true; key: string }
    | {
        empty: false;
        day: number;
        dateStr: string;
        info: ReturnType<typeof getDayInfo>;
        key: string;
      };

  const calendarDays: CalendarDayItem[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push({ empty: true, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateString(year, month, d);
    calendarDays.push({
      empty: false,
      day: d,
      dateStr,
      info: getDayInfo(dateStr),
      key: dateStr,
    });
  }

  // Quick stats for the month
  let freeCount = 0;
  let bookedCount = 0;
  let blockedCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = formatDateString(year, month, d);
    const info = getDayInfo(dStr);
    if (info.type === 'free') freeCount++;
    else if (info.type === 'booking') bookedCount++;
    else blockedCount++;
  }

  const selectedDaysCount =
    selectedStart && selectedEnd
      ? Math.round(
          (new Date(selectedEnd).getTime() - new Date(selectedStart).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : selectedStart
      ? 1
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & View Mode Switcher */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A53] block">
            Disponibilidad de la Casa de Veraneo
          </span>
          <h2
            className="text-xl sm:text-2xl font-bold text-[#163323]"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            Calendario de Ocupación en Tiempo Real
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented control month / year */}
          <div className="inline-flex p-1 bg-[#F4EFE6] border border-[#DCD4C0]">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-[#1B3B2B] text-white shadow-xs'
                  : 'text-[#4F6254] hover:text-[#19231A]'
              }`}
            >
              Vista Mensual
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                viewMode === 'year'
                  ? 'bg-[#1B3B2B] text-white shadow-xs'
                  : 'text-[#4F6254] hover:text-[#19231A]'
              }`}
            >
              Vista Anual {year}
            </button>
          </div>

          {currentUser.role === 'owner' && (
            <button
              onClick={onOpenBookingModal}
              className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
            >
              Reservar
            </button>
          )}
        </div>
      </div>

      {/* Selected Range Floating Action Bar if dates picked */}
      {selectedStart && (
        <div className="bg-[#17341B] text-[#FAF8F5] p-4 border border-[#2D4E35] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#BFA270] text-[#17341B] flex items-center justify-center font-bold text-xs shrink-0">
              {selectedDaysCount}d
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#BFA270]">
                Rango seleccionado
              </p>
              <p className="text-sm font-semibold">
                Desde: <span className="text-white">{selectedStart}</span>
                {selectedEnd ? (
                  <>
                    {' '}
                    — Hasta: <span className="text-white">{selectedEnd}</span> ({selectedDaysCount}{' '}
                    días totales)
                  </>
                ) : (
                  ' (seleccione la fecha de salida en el calendario)'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedStart(null);
                setSelectedEnd(null);
              }}
              className="px-3 py-1.5 text-xs text-[#D8CEB9] hover:text-white transition-colors cursor-pointer"
            >
              Cancelar Selección
            </button>

            {selectedEnd && (
              <button
                onClick={() => onSelectDateRange(selectedStart, selectedEnd)}
                className="px-4 py-1.5 bg-[#BFA270] hover:bg-[#A68853] text-[#17341B] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                Confirmar y Reservar Turno →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Monthly View */}
      {viewMode === 'month' ? (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          {/* Navigation Bar for Month */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#EFEAE0]">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-[#163323] tracking-wide">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={goToToday}
                className="text-xs px-2.5 py-1 bg-[#F4EFE6] hover:bg-[#EAE3D4] text-[#2D4E35] font-semibold transition-colors cursor-pointer"
              >
                Hoy
              </button>
            </div>

            {/* Month Summary counts */}
            <div className="hidden lg:flex items-center gap-4 text-xs text-[#526657]">
              <span>
                <strong className="text-emerald-800 font-mono tabular-nums">{freeCount}</strong> días libres
              </span>
              <span>·</span>
              <span>
                <strong className="text-[#8C4A28] font-mono tabular-nums">{bookedCount}</strong> días reservados
              </span>
              <span>·</span>
              <span>
                <strong className="text-amber-800 font-mono tabular-nums">{blockedCount}</strong> mantenimiento
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-2 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer border border-[#E0D9C5]"
                title="Mes Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 text-[#46574B] hover:text-[#163323] hover:bg-[#F4EFE6] transition-colors cursor-pointer border border-[#E0D9C5]"
                title="Mes Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="py-1.5 text-xs font-bold uppercase tracking-wider text-[#637568]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((item) => {
              if (item.empty) {
                return (
                  <div
                    key={item.key}
                    className="min-h-[75px] sm:min-h-[95px] bg-[#FAF8F5]/40 border border-transparent p-1"
                  />
                );
              }

              const { day, dateStr, info } = item;
              const isSelected =
                (selectedStart && dateStr === selectedStart) ||
                (selectedEnd && dateStr === selectedEnd);
              const isInSelectedRange =
                selectedStart &&
                selectedEnd &&
                dateStr >= selectedStart &&
                dateStr <= selectedEnd;

              let cellBg = 'bg-[#FAF8F5] hover:bg-[#F4EFE6]';
              let cellBorder = 'border-[#E8E2D2]';
              let badge = null;

              if (info.type === 'booking') {
                cellBg = 'bg-[#FFFFFF]';
                cellBorder = 'border-[#DDD5C0]';
                badge = (
                  <div
                    className="mt-1 px-1.5 py-0.5 text-[10px] font-semibold text-white truncate text-left shadow-2xs"
                    style={{ backgroundColor: info.color }}
                    title={`${info.booking.userName} (${info.booking.partName})`}
                  >
                    {info.booking.userName.split(' ')[0]}
                    {info.isCheckIn ? ' (In)' : info.isCheckOut ? ' (Out)' : ''}
                  </div>
                );
              } else if (info.type === 'block') {
                cellBg = 'bg-[#FFFBEB]';
                cellBorder = 'border-amber-300';
                badge = (
                  <div className="mt-1 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 bg-amber-100 flex items-center gap-1 truncate">
                    <Wrench className="w-2.5 h-2.5 shrink-0 text-amber-700" />
                    <span className="truncate">{info.block.title}</span>
                  </div>
                );
              } else if (info.type === 'cleaning') {
                cellBg = 'bg-[#F2F7F2]';
                cellBorder = 'border-emerald-200';
                badge = (
                  <div className="mt-1 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800 bg-emerald-50 flex items-center gap-1 truncate">
                    <Sparkles className="w-2.5 h-2.5 shrink-0 text-emerald-600" />
                    <span className="truncate">Sanitización 24h</span>
                  </div>
                );
              }

              if (isInSelectedRange) {
                cellBg = 'bg-[#EBF3ED]';
                cellBorder = 'border-[#1B3B2B]';
              }
              if (isSelected) {
                cellBg = 'bg-[#1B3B2B] text-white';
                cellBorder = 'border-[#1B3B2B] ring-2 ring-[#BFA270]';
              }

              return (
                <div
                  key={item.key}
                  onClick={() => handleDayClick(dateStr)}
                  className={`min-h-[75px] sm:min-h-[95px] p-1.5 sm:p-2 border transition-all cursor-pointer flex flex-col justify-between select-none relative group ${cellBg} ${cellBorder}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isSelected ? 'text-white' : 'text-[#19231A]'
                      }`}
                    >
                      {day}
                    </span>

                    {info.type === 'free' && !isInSelectedRange && (
                      <span className="text-[9px] text-emerald-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Libre
                      </span>
                    )}
                  </div>

                  {badge}

                  {/* Visual hint for selection */}
                  {info.type === 'free' && isInSelectedRange && (
                    <div className="text-[9px] text-[#1B3B2B] font-bold text-center mt-auto">
                      ✓ Seleccionado
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Color & Status Legend */}
          <div className="mt-8 pt-5 border-t border-[#EFEAE0]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block mb-3">
              Referencias y Partes del Fideicomiso
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* Owners */}
              {users
                .filter((u) => u.role === 'owner')
                .map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: u.color }}
                    />
                    <div className="truncate">
                      <span className="font-semibold text-[#163323] block leading-tight truncate">
                        {u.name}
                      </span>
                      <span className="text-[10px] text-[#7A8E7E] block truncate">{u.partName}</span>
                    </div>
                  </div>
                ))}

              {/* Maintenance */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-400 border border-amber-500 shrink-0" />
                <span className="text-[#35483A] font-medium truncate">Mantenimiento</span>
              </div>

              {/* Cleaning buffer */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-200 border border-emerald-400 shrink-0" />
                <span className="text-[#35483A] font-medium truncate">Limpieza post turno</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Annual 12-Month Heatmap View */
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#163323]">
              Vista Consolidada Anual {year} (12 Meses)
            </h3>
            <span className="text-xs text-[#7A8E7E]">
              Distribución de ocupación de las 4 partes y mantenimiento
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {monthNames.map((mName, mIdx) => {
              const daysCount = new Date(year, mIdx + 1, 0).getDate();
              const firstDay = (new Date(year, mIdx, 1).getDay() + 6) % 7;

              return (
                <div key={mName} className="p-3 bg-[#FAF8F5] border border-[#E6E0CF]">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#EAE4D5]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#163323]">
                      {mName}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentDate(new Date(year, mIdx, 1));
                        setViewMode('month');
                      }}
                      className="text-[10px] text-[#8C7A53] hover:underline cursor-pointer font-medium"
                    >
                      Abrir mes →
                    </button>
                  </div>

                  {/* Compact Days Grid */}
                  <div className="grid grid-cols-7 gap-1 text-[9px] font-mono text-center">
                    {/* Empty padding */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`emp-${i}`} className="h-4" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysCount }).map((_, i) => {
                      const d = i + 1;
                      const dStr = formatDateString(year, mIdx, d);
                      const info = getDayInfo(dStr);

                      let bg = 'bg-[#FFFFFF] text-[#637568]';
                      let title = `${d} de ${mName}: Libre`;

                      if (info.type === 'booking') {
                        bg = 'text-white font-bold';
                        title = `${d} de ${mName}: ${info.booking.userName}`;
                      } else if (info.type === 'block') {
                        bg = 'bg-amber-400 text-amber-950 font-bold';
                        title = `${d} de ${mName}: ${info.block.title}`;
                      } else if (info.type === 'cleaning') {
                        bg = 'bg-emerald-200 text-emerald-950';
                        title = `${d} de ${mName}: Limpieza post turno`;
                      }

                      return (
                        <div
                          key={d}
                          title={title}
                          style={info.type === 'booking' ? { backgroundColor: info.color } : {}}
                          className={`h-4.5 flex items-center justify-center rounded-2xs cursor-default ${bg}`}
                        >
                          {d}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
