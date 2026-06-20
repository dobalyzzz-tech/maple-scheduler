// components/CompleteButton.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { completeSchedule } from "@/lib/supabaseClient";
import { useCharacterStore } from "@/store/useCharacterStore";

export function CompleteButton({ scheduleId }: { scheduleId: string }) {
  const [pop, setPop] = useState<number | null>(null);
  const apply = useCharacterStore((s) => s.applyReward);

  const onComplete = async () => {
    const r = await completeSchedule(scheduleId);
    if (r.status !== "ok") return;       // 중복 완료 방지
    setPop(r.exp_gain);
    apply(r);
    setTimeout(() => setPop(null), 600);
    if (r.leveled_up) {
      window.dispatchEvent(new CustomEvent("levelup", { detail: r.level }));
    }
  };

  return (
    <div className="relative inline-block">
      <button className="pixel-btn" onClick={onComplete}>완료</button>
      <AnimatePresence>
        {pop !== null && (
          <motion.span
            className="absolute -top-2 left-1/2 text-expgold font-pixel"
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
