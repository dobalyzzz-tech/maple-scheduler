// components/LevelUpModal.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import copy from "@/copy.json";

export function LevelUpModal({ level, onClose }: { level: number; onClose: () => void }) {
  const msg = copy.levelUp[Math.floor(Math.random() * copy.levelUp.length)]
    .replace("{n}", String(level));
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50"
        initial={{ background: "rgba(255,210,63,0.8)" }}
        animate={{ background: "rgba(0,0,0,0.5)" }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      >
        <motion.div
          className="pixel-box px-8 py-6 text-center font-pixel space-y-4"
          initial={{ scale: 0.5, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          <motion.div
            className="text-2xl text-maple"
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: 2, duration: 0.4 }}
          >
            LEVEL UP!
          </motion.div>
          <p className="text-sm">{msg}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
