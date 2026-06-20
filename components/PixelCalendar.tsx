"use client";

import { useMemo } from "react";
import { useSchedules, type CalendarDay } from "@/lib/queries";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function calcGrid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, rows: cells.length / 7 };
}

function getTodayStr() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

const todayStr = getTodayStr();

interface Props {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function CalendarCell({
  day,
  dayData,
  isToday,
  isSelected,
  onSelect,
  year,
  month,
}: {
  day: number;
  dayData: CalendarDay | undefined;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
  year: number;
  month: number;
}) {
  const dateStr = dayData?.date ?? "";
  const total = dayData?.instances.length ?? 0;
  const done = dayData?.instances.filter((i) => i.done).length ?? 0;
  const allDone = total > 0 && done === total;
  const dayOfWeek = new Date(year, month, day).getDay();

  let cellBg = "bg-[#F1E9D8]";
  if (isSelected) cellBg = "bg-[#44DDDD]";
  else if (isToday) cellBg = "bg-[#F1E9D8]";
  else if (allDone) cellBg = "bg-success/15";

  return (
    <button
      onClick={onSelect}
      className={`${cellBg} ${isToday ? "border-2 border-[#44DDDD]" : "border border-border/20"} rounded-lg flex flex-col items-center justify-start pt-2 pb-1 cursor-pointer transition-colors hover:bg-sky-100 min-h-[64px] h-full`}
    >
      <span
        className={`font-pixel text-xs leading-none ${
          isToday ? "text-white font-bold" : dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-border/70"
        }`}
      >
        {isToday ? "TODAY" : day}
      </span>
      {total > 0 && (
        <div className="flex flex-wrap gap-[2px] mt-2 justify-center px-1">
          {dayData!.instances.map((inst) => (
            <span
              key={inst.scheduleId + inst.date}
              className={`inline-block w-[6px] h-[6px] rounded-sm ${
                inst.done ? "bg-success" : "bg-maple/60"
              }`}
            />
          ))}
        </div>
      )}
    </button>
  );
}

export default function PixelCalendar({
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const { data: monthData, isLoading } = useSchedules(year, month);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    if (monthData) for (const d of monthData) m.set(d.date, d);
    return m;
  }, [monthData]);

  const { cells, rows } = useMemo(() => calcGrid(year, month), [year, month]);

  return (
    <div className="rounded-2xl px-4 py-4 select-none flex-1 flex flex-col border border-[#D1D4D6]" style={{backgroundColor:"#F0EDE6"}}>
      {/* 월 헤더 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button className="pixel-btn px-3 py-1.5 text-xs" onClick={onPrevMonth}>◀</button>
        <span className="font-pixel text-sm text-border">
          {year}. {String(month + 1).padStart(2, "0")}
        </span>
        <button className="pixel-btn px-3 py-1.5 text-xs" onClick={onNextMonth}>▶</button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
        {DAY_LABELS.map((label, idx) => (
          <div key={label} className={`text-center font-pixel text-[10px] py-2 ${idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-border/50"}`}>
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      {isLoading ? (
        <div className="text-center font-pixel text-xs text-border/40 py-6 flex-1 flex items-center justify-center">캘린더를 불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1 flex-1" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[64px] h-full" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayData = dayMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <CalendarCell
                key={dateStr}
                day={day}
                dayData={dayData}
                isToday={isToday}
                isSelected={isSelected}
                onSelect={() => onSelectDate(dateStr)}
                year={year}
                month={month}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
