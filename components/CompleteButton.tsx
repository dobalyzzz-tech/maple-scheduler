"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { completeSchedule } from "@/lib/supabaseClient";
import { useRefreshSchedules } from "@/lib/queries";
import { playCompleteSound } from "@/lib/sound";
import { unlockAudio } from "@/lib/sound";
import { supabase } from "@/lib/supabaseClient";

export function CompleteButton({ scheduleId, targetDate }: { scheduleId: string; targetDate?: string }) {
  const [pop, setPop] = useState<number | null>(null);
  const refresh = useRefreshSchedules();

  const onComplete = async () => {
    // 과거 날짜 체크
    if (targetDate) {
      const today = new Date();
      const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = kst.toISOString().slice(0, 10);
      if (targetDate < todayStr) {
        return;
      }
    }
    unlockAudio();
    playCompleteSound();
    const r = await completeSchedule(scheduleId, targetDate);
    if (r.status !== "ok") return;
    setPop(r.exp_gain);
    if (r.leveled_up) {
      window.dispatchEvent(new CustomEvent("levelup", { detail: r.level }));
    }
    await refresh(r);
    window.dispatchEvent(new CustomEvent("quest-completed"));

    // 협동 퀘스트 완료 시 contribution 증가 및 캐시 갱신
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_config")
          .eq("id", user.id)
          .single();

        const cfg = profile?.avatar_config as { co_schedules?: Record<string, string> } | null;
        if (cfg?.co_schedules) {
          const questEntry = Object.entries(cfg.co_schedules).find(([, sid]) => sid === scheduleId);
          if (questEntry) {
            const questId = questEntry[0];
            const { error } = await supabase
              .from("co_quest_members")
              .update({ contribution: 1 })
              .eq("quest_id", questId)
              .eq("user_id", user.id);
            if (error) console.error("coQuest contribution update error:", error);
            // 캐시 갱신을 위해 커스텀 이벤트
            window.dispatchEvent(new CustomEvent("co-quest-updated"));
          }
        }
      }
    } catch (e) {
      console.error("coQuest contribution error:", e);
    }

    setTimeout(() => setPop(null), 600);
  };

  return (
    <div className="relative inline-block">
      <button className="pixel-btn text-xs px-3 py-1.5" style={{backgroundColor:"#38bdf8", color:"white"}} onClick={onComplete}>완료</button>
      <AnimatePresence>
        {pop !== null && (
          <motion.span
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-expgold font-pixel text-[10px] whitespace-nowrap"
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            +{pop} EXP
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
