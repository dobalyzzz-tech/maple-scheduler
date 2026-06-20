"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { useCharacterStore, expNeeded } from "@/store/useCharacterStore";
import { useSchedules, useDeleteSchedule, useQuestStats } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { LevelUpModal } from "@/components/LevelUpModal";
import { CompleteButton } from "@/components/CompleteButton";
import PixelCalendar from "@/components/PixelCalendar";
import AddQuestModal from "@/components/AddQuestModal";
import BackgroundGame from "@/components/BackgroundGame";
import { playLevelUpSound, lowerAllVolume, restoreAllVolume, unlockAudio, saveFailedQuestsChecked } from "@/lib/sound";

function getTodayStr() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const todayStr = getTodayStr();

const DAY_MESSAGES = [
  "일요일도 쉬지 않는 모험가! 🔥",
  "월요일, 시작이 반이에요! 💪",
  "화이팅! 오늘도 힘내봐요! ⚡",
  "수요일, 절반을 넘겼어요! 🌟",
  "목요일, 조금만 더 힘내요! 🎯",
  "드디어 금요일! 마무리 잘해봐요! 🚀",
  "토요일, 즐겁게 달려봐요! ✨",
];

function getDayMessage(day: number) {
  return DAY_MESSAGES[day] ?? "";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { level, exp, coins, nickname, title } = useCharacterStore();
  const [showLevelUp, setShowLevelUp] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<{
    id: string; title: string; memo: string | null;
    difficulty: number; start_at: string;
    is_recurring: boolean; recur_rule: string | null;
  } | null>(null);

  const now = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: monthData } = useSchedules(year, month);

  const selectedInstances = useMemo(() => {
    if (!monthData || !selectedDate) return [];
    const day = monthData.find((d) => d.date === selectedDate);
    return day?.instances ?? [];
  }, [monthData, selectedDate]);

  const pct = exp / expNeeded(level) * 100;
  const deleteSchedule = useDeleteSchedule();

  const [failedQuests, setFailedQuests] = useState<{id: string; title: string; difficulty: number}[] | null>(null);
  const { data: stats } = useQuestStats();

  useEffect(() => {
    const handler = (e: Event) => {
      const lv = (e as CustomEvent).detail;
      playLevelUpSound();
      lowerAllVolume();
      setShowLevelUp(lv);
      setTimeout(() => restoreAllVolume(), 3000);
    };
    window.addEventListener("levelup", handler);

    const failedHandler = (e: Event) => {
      setFailedQuests((e as CustomEvent).detail);
    };
    window.addEventListener("failed-quests", failedHandler);

    const questHandler = () => qc.invalidateQueries({ queryKey: ["quest-stats"] });
    window.addEventListener("quest-completed", questHandler);

    return () => {
      window.removeEventListener("levelup", handler);
      window.removeEventListener("failed-quests", failedHandler);
      window.removeEventListener("quest-completed", questHandler);
    };
  }, [qc]);

  const goPrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const openAddModal = () => {
    setEditData(null);
    setModalOpen(true);
  };
  const openEditModal = (inst: typeof selectedInstances[number]) => {
    setEditData({
      id: inst.scheduleId,
      title: inst.title,
      memo: inst.memo,
      difficulty: inst.difficulty,
      start_at: `${inst.date}T09:00:00`,
      is_recurring: false,
      recur_rule: null,
    });
    setModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개의 퀘스트를 삭제할까요?`)) return;
    selectedIds.forEach((id) => deleteSchedule.mutate(id));
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  const dayLabel = selectedDate === todayStr ? "오늘의 퀘스트" : `${selectedDate?.slice(5)} 퀘스트`;

  return (
    <div className="flex-1 flex flex-col w-full py-6 gap-6 min-h-0" style={{backgroundColor:"#4A5057"}}>
      {/* 3단 배치 (25% - 50% - 25%) */}
      <div className="flex px-6 gap-6 flex-1 min-h-0">
        {/* 왼쪽 영역 - 배경 게임 */}
        <div className="w-[25%] flex flex-col min-h-0">
          <div className="rounded-2xl flex flex-col flex-1 overflow-hidden border border-[#D1D4D6]" style={{backgroundColor:"#EEEEEE"}}>
            <BackgroundGame />
          </div>
        </div>

        {/* 가운데 영역 */}
        <div className="w-[50%] min-w-0 flex flex-col gap-6">
          {/* HUD */}
          <div className="rounded-2xl px-6 py-4 flex items-center gap-6 border border-[#D1D4D6]" style={{backgroundColor:"#EEEEEE"}}>
            <img src="/icon.png" alt="" className="w-12 h-12 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <span className="font-pixel text-sm text-border truncate">Lv.{level} {nickname}</span>
                <span className="font-pixel text-xs text-border/80 shrink-0 bg-white/60 px-3 py-1 rounded-lg">🪙 {coins}</span>
              </div>
              <div className="text-xs font-pixel text-border/70 mb-2 truncate">{title}</div>
              <div className="exp-bar w-full mb-1">
                <div className="exp-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="text-xs font-pixel text-border/60 text-right">{exp} / {expNeeded(level)} EXP</div>
            </div>
          </div>

          <PixelCalendar
            year={year}
            month={month}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
          />
        </div>

        {/* 오른쪽 영역 (퀘스트 목록) */}
        <div className="w-[25%] flex flex-col min-h-0">
          <div className="rounded-2xl px-5 py-4 flex flex-col flex-1 min-h-0 overflow-hidden border border-[#D1D4D6]" style={{backgroundColor:"#EEEEEE"}}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-pixel text-sm text-border">📜 {dayLabel}</span>
              <div className="flex items-center gap-2">
                {deleteMode ? (
                  <>
                    <button className="pixel-btn px-2 py-1.5 text-[10px] bg-parchment text-border" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>취소</button>
                    <button className="pixel-btn px-2 py-1.5 text-[10px] bg-danger text-white" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
                      {selectedIds.size > 0 ? `${selectedIds.size}개 삭제` : "선택"}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="pixel-btn px-2 py-1.5 text-[10px] bg-parchment text-border" onClick={() => setDeleteMode(true)}>삭제</button>
                    <button className="pixel-btn px-2 py-1.5 text-xs" onClick={openAddModal}>＋ 추가</button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 scrollbar-none">
              {selectedInstances.length === 0 ? (
                <div className="text-border/40 font-pixel text-xs text-center py-6">아직 퀘스트가 없어요. 새 퀘스트를 추가해보세요!</div>
              ) : (
                selectedInstances.map((inst) => (
                  <div key={inst.scheduleId + inst.date} className={`flex items-center gap-3 px-4 py-3 border border-border/20 rounded-xl ${
                    deleteMode && selectedIds.has(inst.scheduleId) ? "bg-danger/10 border-danger" :
                    inst.done ? "bg-[#7A818A] border border-[#6B7280]" : "bg-[#D1D4D6]"
                  }`}>
                    {deleteMode ? (
                      <>
                        <input type="checkbox" className="accent-maple w-4 h-4 shrink-0" checked={selectedIds.has(inst.scheduleId)} onChange={() => toggleSelect(inst.scheduleId)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-pixel text-xs text-border">{inst.title}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => !deleteMode && openEditModal(inst)}
                        >
                          <div className={`font-pixel text-xs ${inst.done ? "text-border" : "text-border"}`}>
                            {inst.title}
                            <span className="ml-2 text-border/40 text-[10px]">{"★".repeat(inst.difficulty)}</span>
                          </div>
                          {inst.memo && <div className="text-[10px] font-pixel text-border/50 truncate mt-0.5">{inst.memo}</div>}
                        </div>
                        {inst.done ? (
                          <span className="text-white shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        ) : (
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              className="pixel-btn text-[10px] px-2 py-1 flex items-center justify-center"
                              style={{backgroundColor:"#EEEEEE", color:"#3A2E2A"}}
                              onClick={() => openEditModal(inst)}
                              title="수정"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <CompleteButton scheduleId={inst.scheduleId} targetDate={inst.date} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 영역 - 통계 */}
      <div className="px-6 shrink-0">
        <div className="rounded-2xl px-5 py-[45px] flex items-center border border-[#D1D4D6]" style={{backgroundColor:"#EEEEEE"}}>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A2E2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <div className="font-pixel text-[10px] text-border/50">클리어한 퀘스트</div>
                <div className="font-pixel text-sm text-border">{stats?.totalCleared ?? 0}개</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A2E2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <div>
                <div className="font-pixel text-[10px] text-border/50">연속 클리어</div>
                <div className="font-pixel text-sm text-border">{stats?.streakDays ?? 0}일</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3A2E2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
              </svg>
              <div>
                <div className="font-pixel text-[10px] text-border/50">오늘 획득 EXP</div>
              <div className="font-pixel text-sm text-border">{stats ? (stats.todayExp > 0 ? `+${stats.todayExp}` : "-") : "-"}</div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-start pl-20">
            <div className="font-pixel text-base text-border/80">
              {getDayMessage(new Date().getDay())}
            </div>
          </div>
        </div>
      </div>

      <AddQuestModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null); }}
        initialDate={selectedDate ?? todayStr}
        editData={editData}
      />

      {failedQuests && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40" onClick={() => setFailedQuests(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-border/10 w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-pixel text-base text-border mb-4">💀 실패한 퀘스트</h2>
            <p className="font-pixel text-xs text-border/70 mb-4">어제 완료하지 못한 퀘스트가 있어요...</p>
            <div className="flex flex-col gap-2 mb-5">
              {failedQuests.map((q) => (
                <div key={q.id} className="flex items-center gap-3 px-3 py-2 bg-[#7A818A] rounded-xl">
                  <span className="text-white font-pixel text-xs">{q.title}</span>
                  <span className="text-white/60 text-[10px] ml-auto">{"★".repeat(q.difficulty)}</span>
                </div>
              ))}
            </div>
            <button
              className="pixel-btn px-4 py-2 text-xs w-full"
              onClick={() => {
                if (user?.id) saveFailedQuestsChecked(user.id);
                setFailedQuests(null);
              }}
            >
              알겠어요...
            </button>
          </div>
        </div>
      )}

      {showLevelUp !== null && (
        <LevelUpModal level={showLevelUp} onClose={() => setShowLevelUp(null)} />
      )}
    </div>
  );
}
