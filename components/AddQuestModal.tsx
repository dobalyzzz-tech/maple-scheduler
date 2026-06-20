"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAddSchedule, useUpdateSchedule, useDeleteSchedule, sanitize } from "@/lib/queries";
import copy from "@/copy.json";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const RRULE_MAP: Record<string, string> = {
  일: "SU", 월: "MO", 화: "TU", 수: "WE", 목: "TH", 금: "FR", 토: "SA",
};

interface ScheduleForm {
  id?: string;
  title: string;
  memo: string;
  difficulty: number;
  date: string;
  time: string;
  isRecurring: boolean;
  repeatType: "daily" | "weekly" | "monthly" | null;
  weekDays: boolean[];
}

const emptyForm: ScheduleForm = {
  title: "",
  memo: "",
  difficulty: 1,
  date: new Date().toISOString().slice(0, 10),
  time: "09:00",
  isRecurring: false,
  repeatType: null,
  weekDays: [false, false, false, false, false, false, false],
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  editData?: {
    id: string;
    title: string;
    memo: string | null;
    difficulty: number;
    start_at: string;
    is_recurring: boolean;
    recur_rule: string | null;
  } | null;
}

function buildRRule(repeatType: string, weekDays: boolean[]): string | null {
  if (repeatType === "daily") return "FREQ=DAILY";
  if (repeatType === "weekly") {
    const days = weekDays
      .map((v, i) => (v ? RRULE_MAP[WEEKDAYS[i]] : null))
      .filter(Boolean)
      .join(",");
    if (!days) return null;
    return `FREQ=WEEKLY;BYDAY=${days}`;
  }
  if (repeatType === "monthly") return "FREQ=MONTHLY";
  return null;
}

export default function AddQuestModal({ open, onClose, initialDate, editData }: Props) {
  const addMutation = useAddSchedule();
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();

  function buildForm(ed: typeof editData, initDate?: string): ScheduleForm {
    if (ed) {
      const d = new Date(ed.start_at);
      const parsedWeekDays = [false, false, false, false, false, false, false];
      let repeatType: ScheduleForm["repeatType"] = null;

      if (ed.recur_rule) {
        if (ed.recur_rule.includes("FREQ=DAILY")) repeatType = "daily";
        else if (ed.recur_rule.includes("FREQ=WEEKLY")) {
          repeatType = "weekly";
          const dayMatch = ed.recur_rule.match(/BYDAY=([A-Z,]+)/);
          if (dayMatch) {
            const rev: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
            dayMatch[1].split(",").forEach((d2) => { if (rev[d2] !== undefined) parsedWeekDays[rev[d2]] = true; });
          }
        }
        else if (ed.recur_rule.includes("FREQ=MONTHLY")) repeatType = "monthly";
      }

      return {
        id: ed.id,
        title: ed.title,
        memo: ed.memo ?? "",
        difficulty: ed.difficulty,
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
        isRecurring: ed.is_recurring,
        repeatType,
        weekDays: parsedWeekDays,
      };
    }
    return {
      ...emptyForm,
      date: initDate ?? new Date().toISOString().slice(0, 10),
    };
  }

  const [form, setForm] = useState<ScheduleForm>(() => buildForm(editData, initialDate));

  // editData 변경 시 form 동기화
  useEffect(() => {
    setForm(buildForm(editData, initialDate));
  }, [editData, initialDate]);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((): string | null => {
    if (!form.title.trim()) return "퀘스트 제목을 입력해주세요!";
    if (form.title.length > 100) return "제목이 너무 길어요 (100자 이하)";
    const today = new Date().toISOString().slice(0, 10);
    if (form.date < today) return "과거 날짜는 선택할 수 없어요!";
    if (form.isRecurring && !form.repeatType) return "반복 유형을 선택해주세요!";
    if (form.repeatType === "weekly" && form.weekDays.every((v) => !v))
      return "반복 요일을 하나 이상 선택해주세요!";
    return null;
  }, [form]);

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);

    const start_at = `${form.date}T${form.time}:00`;
    const recurRule = form.isRecurring ? buildRRule(form.repeatType!, form.weekDays) : null;

    try {
      if (form.id) {
        await updateMutation.mutateAsync({
          id: form.id,
          title: sanitize(form.title),
          memo: form.memo ? sanitize(form.memo) : null,
          difficulty: form.difficulty,
          start_at,
          is_recurring: form.isRecurring,
          recur_rule: recurRule,
        });
      } else {
        await addMutation.mutateAsync({
          title: sanitize(form.title),
          memo: form.memo ? sanitize(form.memo) : undefined,
          difficulty: form.difficulty,
          start_at,
          is_recurring: form.isRecurring,
          recur_rule: recurRule,
        });
      }
      onClose();
    } catch {
      setError("저장 중 오류가 발생했어요. 다시 시도해주세요.");
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("정말 이 퀘스트를 삭제할까요?")) return;
    try {
      await deleteMutation.mutateAsync(form.id);
      onClose();
    } catch {
      setError("삭제 중 오류가 발생했어요.");
    }
  };

  const pending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const toggleDay = (idx: number) => {
    setForm((f) => ({
      ...f,
      weekDays: f.weekDays.map((v, i) => (i === idx ? !v : v)),
    }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-xl border border-border/10 w-full max-w-lg mx-4 overflow-y-auto"
            style={{ maxHeight: "85vh" }}
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="font-pixel text-base text-border mb-6">
                {form.id ? "✏️ 퀘스트 수정" : "📜 새 퀘스트"}
              </h2>

              {/* 제목 */}
              <label className="font-pixel text-xs text-border/70 block mb-2">제목</label>
              <input
                className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors mb-5"
                placeholder="운동하기"
                value={form.title}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />

              {/* 메모 */}
              <label className="font-pixel text-xs text-border/70 block mb-2">메모</label>
              <textarea
                className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors mb-5 resize-none"
                rows={3}
                placeholder="자세한 내용을 적어보세요"
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              />

              {/* 날짜 + 시간 */}
              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <label className="font-pixel text-xs text-border/70 block mb-2">날짜</label>
                  <input
                    type="date"
                    className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="w-[120px]">
                  <label className="font-pixel text-xs text-border/70 block mb-2">시간</label>
                  <input
                    type="time"
                    className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* 난이도 */}
              <label className="font-pixel text-xs text-border/70 block mb-2">난이도</label>
              <div className="flex gap-3 mb-5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`pixel-btn px-4 py-2 text-sm ${form.difficulty === n ? "bg-maple text-white" : "bg-parchment text-border"}`}
                    onClick={() => setForm((f) => ({ ...f, difficulty: n }))}
                  >
                    {"★".repeat(n)}{"☆".repeat(3 - n)}
                  </button>
                ))}
              </div>

              {/* 반복 */}
              <label className="font-pixel text-xs text-border/70 block mb-3">
                <input
                  type="checkbox"
                  className="mr-2 accent-maple w-4 h-4 align-middle"
                  checked={form.isRecurring}
                  onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked, repeatType: e.target.checked ? f.repeatType ?? "daily" : null }))}
                />
                <span className="align-middle">반복 퀘스트</span>
              </label>

              {form.isRecurring && (
                <div className="mb-5 pl-1">
                  <div className="flex gap-3 mb-3">
                    {(["daily", "weekly", "monthly"] as const).map((t) => (
                      <button
                        key={t}
                        className={`pixel-btn px-3 py-1.5 text-xs ${form.repeatType === t ? "bg-maple text-white" : "bg-parchment text-border"}`}
                        onClick={() => setForm((f) => ({ ...f, repeatType: t }))}
                      >
                        {t === "daily" ? "매일" : t === "weekly" ? "매주" : "매월"}
                      </button>
                    ))}
                  </div>
                  {form.repeatType === "weekly" && (
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map((label, i) => (
                        <button
                          key={label}
                          className={`pixel-btn px-2 py-1.5 text-xs min-w-[32px] ${form.weekDays[i] ? "bg-maple text-white" : "bg-parchment text-border"}`}
                          onClick={() => toggleDay(i)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <div className="text-danger font-pixel text-xs mb-4 bg-danger/5 rounded-xl px-4 py-3">{error}</div>
              )}

              {/* 하단 버튼 */}
              <div className="flex gap-3 justify-end pt-2">
                {form.id && (
                  <button
                    className="pixel-btn px-4 py-2 text-xs bg-danger text-white"
                    onClick={handleDelete}
                    disabled={pending}
                  >
                    삭제
                  </button>
                )}
                <button
                  className="pixel-btn px-4 py-2 text-xs bg-parchment text-border"
                  onClick={onClose}
                >
                  취소
                </button>
                <button
                  className="pixel-btn px-5 py-2 text-sm"
                  onClick={handleSave}
                  disabled={pending}
                >
                  {pending ? "저장 중..." : form.id ? "수정 완료" : "퀘스트 수락!"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
