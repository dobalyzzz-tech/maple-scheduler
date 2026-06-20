// store/useCharacterStore.ts
import { create } from "zustand";

interface CharacterState {
  level: number; exp: number; coins: number; nickname: string; title: string;
  setProfile: (p: Partial<CharacterState>) => void;
  applyReward: (r: { exp: number; level: number; coin_gain: number; leveled_up: boolean }) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  level: 1, exp: 0, coins: 0, nickname: "새내기 모험가", title: "초보 모험가",
  setProfile: (p) => set(p),
  applyReward: (r) =>
    set((s) => ({ level: r.level, exp: r.exp, coins: s.coins + r.coin_gain })),
}));

// 다음 레벨까지 필요 EXP = level * 100
export const expNeeded = (level: number) => level * 100;
