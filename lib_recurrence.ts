// lib/recurrence.ts — RRULE 전개 (npm i rrule)
import { RRule } from "rrule";

// 조회 범위에 대해 반복 일정 인스턴스 날짜 목록 반환
export function expandRecurrence(recurRule: string, from: Date, to: Date): Date[] {
  const rule = RRule.fromString(recurRule); // "FREQ=WEEKLY;BYDAY=MO,WE"
  return rule.between(from, to, true);
}

// 인스턴스가 완료됐는지 (schedule_logs 조회 결과와 매칭)
export function isInstanceDone(
  logs: { target_date: string }[],
  date: Date
): boolean {
  const d = date.toISOString().slice(0, 10);
  return logs.some((l) => l.target_date === d);
}
