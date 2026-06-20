"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { sanitize } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  friends: { id: string; nickname: string }[];
}

export default function CreateCoQuestModal({ open, onClose, friends }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"form" | "invite">("form");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [date, setDate] = useState(() => {
    const d = new Date();
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("09:00");
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatType, setRepeatType] = useState<"daily" | "weekly" | "monthly" | null>(null);
  const [weekDays, setWeekDays] = useState([false, false, false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createdScheduleId, setCreatedScheduleId] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  const reset = () => {
    setStep("form");
    setTitle("");
    setMemo("");
    setDifficulty(1);
    const d = new Date();
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    setDate(kst.toISOString().slice(0, 10));
    setTime("09:00");
    setIsRecurring(false);
    setRepeatType(null);
    setWeekDays([false, false, false, false, false, false, false]);
    setError(null);
    setPending(false);
    setCreatedScheduleId(null);
    setSelectedFriends(new Set());
    setInviting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreateQuest = async () => {
    if (!title.trim()) { setError("퀘스트 제목을 입력해주세요!"); return; }
    setError(null);
    setPending(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      const start_at = `${date}T${time}:00`;

      // RRULE 생성
      let recurRule: string | null = null;
      if (isRecurring && repeatType) {
        if (repeatType === 'daily') recurRule = 'FREQ=DAILY';
        else if (repeatType === 'weekly') {
          const dayMap: Record<string, string> = { '일': 'SU', '월': 'MO', '화': 'TU', '수': 'WE', '목': 'TH', '금': 'FR', '토': 'SA' };
          const labels = ['일', '월', '화', '수', '목', '금', '토'];
          const days = labels.map((label, i) => (weekDays[i] ? dayMap[label] : null)).filter(Boolean).join(',');
          if (days) recurRule = `FREQ=WEEKLY;BYDAY=${days}`;
        } else if (repeatType === 'monthly') recurRule = 'FREQ=MONTHLY';
      }

      // 1) schedules에 퀘스트 추가
      const { data: schedule, error: sErr } = await supabase
        .from('schedules')
        .insert({
          user_id: user.id,
          title: sanitize(title),
          memo: memo ? sanitize(memo) : null,
          difficulty,
          start_at,
          is_recurring: isRecurring,
          recur_rule: recurRule,
        })
        .select()
        .single();

      if (sErr) throw sErr;

      setCreatedScheduleId(schedule.id);
      setStep("invite");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했어요.");
    }
    setPending(false);
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendInvites = async () => {
    if (selectedFriends.size === 0 || !createdScheduleId) return;
    setInviting(true);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      // co_quests 생성
      const { data: coQuest, error: cErr } = await supabase
        .from("co_quests")
        .insert({
          title: sanitize(title),
          goal_count: 1,
          creator_id: user.id,
          schedule_id: createdScheduleId,
          target_date: date,
        })
        .select()
        .single();

      if (cErr) throw cErr;

      // creator를 co_quest_members에 추가
      await supabase.from("co_quest_members").insert({
        quest_id: coQuest.id,
        user_id: user.id,
        status: "accepted",
      });

      // 초대할 친구들을 co_quest_members에 pending 상태로 추가
      const invites = Array.from(selectedFriends).map((fid) => ({
        quest_id: coQuest.id,
        user_id: fid,
        status: "pending" as const,
      }));

      await supabase.from("co_quest_members").insert(invites);

      // creator의 avatar_config.co_schedules에도 저장
      if (createdScheduleId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_config")
          .eq("id", user.id)
          .single();

        const cfg = (profile?.avatar_config as Record<string, unknown>) ?? {};
        const coSchedules = (cfg.co_schedules as Record<string, string>) ?? {};
        coSchedules[coQuest.id] = createdScheduleId;
        cfg.co_schedules = coSchedules;
        await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", user.id);
      }

      qc.invalidateQueries({ queryKey: ["co-quests"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "초대 중 오류가 발생했어요.");
      console.error("invite error:", e);
    }
    setInviting(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
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
              {step === "form" ? (
                <>
                  <h2 className="font-pixel text-base text-border mb-6">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    새 파티 퀘스트
                  </h2>

                  <label className="font-pixel text-xs text-border/70 block mb-2">제목</label>
                  <input
                    className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors mb-5"
                    placeholder="운동하기"
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <label className="font-pixel text-xs text-border/70 block mb-2">메모</label>
                  <textarea
                    className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors mb-5 resize-none"
                    rows={3}
                    placeholder="자세한 내용을 적어보세요"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />

                  <div className="flex gap-4 mb-5">
                    <div className="flex-1">
                      <label className="font-pixel text-xs text-border/70 block mb-2">날짜</label>
                      <input type="date" className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="w-[120px]">
                      <label className="font-pixel text-xs text-border/70 block mb-2">시간</label>
                      <input type="time" className="w-full border border-border/20 rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>
                  </div>

                  <label className="font-pixel text-xs text-border/70 block mb-2">난이도</label>
                  <div className="flex gap-3 mb-5">
                    {[1, 2, 3].map((n) => (
                      <button key={n} className={`pixel-btn px-4 py-2 text-sm ${difficulty === n ? "bg-maple text-white" : "bg-parchment text-border"}`} onClick={() => setDifficulty(n)}>
                        {"★".repeat(n)}{"☆".repeat(3 - n)}
                      </button>
                    ))}
                  </div>

                  <label className="font-pixel text-xs text-border/70 block mb-3">
                    <input type="checkbox" className="mr-2 accent-maple w-4 h-4 align-middle" checked={isRecurring} onChange={(e) => { setIsRecurring(e.target.checked); if (e.target.checked) setRepeatType(repeatType ?? 'daily'); else setRepeatType(null); }} />
                    <span className="align-middle">반복 퀘스트</span>
                  </label>

                  {isRecurring && (
                    <div className="mb-5 pl-1">
                      <div className="flex gap-3 mb-3">
                        {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                          <button key={t} className={`pixel-btn px-3 py-1.5 text-xs ${repeatType === t ? 'bg-maple text-white' : 'bg-parchment text-border'}`} onClick={() => setRepeatType(t)}>
                            {t === 'daily' ? '매일' : t === 'weekly' ? '매주' : '매월'}
                          </button>
                        ))}
                      </div>
                      {repeatType === 'weekly' && (
                        <div className="flex gap-2 flex-wrap">
                          {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
                            <button key={label} className={`pixel-btn px-2 py-1.5 text-xs min-w-[32px] ${weekDays[i] ? 'bg-maple text-white' : 'bg-parchment text-border'}`} onClick={() => setWeekDays((w) => w.map((v, j) => (j === i ? !v : v)))}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {error && <div className="text-danger font-pixel text-xs mb-4 bg-danger/5 rounded-xl px-4 py-3">{error}</div>}

                  <div className="flex gap-3 justify-end pt-2">
                    <button className="pixel-btn px-4 py-2 text-xs bg-parchment text-border" onClick={handleClose}>취소</button>
                    <button className="pixel-btn px-5 py-2 text-sm" onClick={handleCreateQuest} disabled={pending}>
                      {pending ? "생성 중..." : "퀘스트 수락!"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-pixel text-base text-border mb-6">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    파티 초대
                  </h2>
                  <p className="font-pixel text-xs text-border/70 mb-4">같이 할 친구를 선택해주세요!</p>

                  {friends.length === 0 ? (
                    <div className="text-border/40 font-pixel text-xs text-center py-6">초대할 친구가 없어요. 먼저 친구를 추가해보세요!</div>
                  ) : (
                    <div className="flex flex-col gap-2 mb-5 max-h-60 overflow-y-auto">
                      {friends.map((f) => (
                        <div key={f.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${selectedFriends.has(f.id) ? "bg-maple/20 border border-maple" : "bg-[#D1D4D6]"}`} onClick={() => toggleFriend(f.id)}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedFriends.has(f.id) ? "bg-maple border-maple" : "border-border/30"}`}>
                            {selectedFriends.has(f.id) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                          </div>
                          <span className="font-pixel text-xs text-border">{f.nickname}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && <div className="text-danger font-pixel text-xs mb-4 bg-danger/5 rounded-xl px-4 py-3">{error}</div>}

                  <div className="flex gap-3 justify-end pt-2">
                    <button className="pixel-btn px-4 py-2 text-xs bg-parchment text-border" onClick={handleClose}>건너뛰기</button>
                    <button className="pixel-btn px-5 py-2 text-sm" onClick={handleSendInvites} disabled={inviting || selectedFriends.size === 0}>
                      {inviting ? "초대 중..." : "초대 보내기"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
