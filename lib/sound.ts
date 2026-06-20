// lib/sound.ts — Howler.js 사운드 관리
import { Howler, Howl } from "howler";

const BGM_LIST = [
  { name: "헤네시스", file: "/bgm/헤네시스.mp3" },
  { name: "엘리니아", file: "/bgm/엘리니아.mp3" },
  { name: "페리온", file: "/bgm/페리온.mp3" },
  { name: "커닝시티", file: "/bgm/커닝시티.mp3" },
  { name: "리스항구", file: "/bgm/리스항구.mp3" },
  { name: "오르비스", file: "/bgm/오르비스.mp3" },
  { name: "엘나스", file: "/bgm/엘나스.mp3" },
  { name: "루디브리엄", file: "/bgm/루디브리엄.mp3" },
  { name: "아쿠아리움", file: "/bgm/아쿠아리움.mp3" },
  { name: "리프레", file: "/bgm/리프레.mp3" },
  { name: "모라스", file: "/bgm/모라스.mp3" },
  { name: "츄츄아일랜드", file: "/bgm/츄츄아일랜드.mp3" },
  { name: "카르시온", file: "/bgm/카르시온.mp3" },
  { name: "도원경", file: "/bgm/도원경.mp3" },
  { name: "리스토니아", file: "/bgm/리스토니아.mp3" },
  { name: "발로라", file: "/bgm/발로라.mp3" },
  { name: "아리안트", file: "/bgm/아리안트.mp3" },
  { name: "마가티아", file: "/bgm/마가티아.mp3" },
  { name: "에델슈타인", file: "/bgm/에델슈타인.mp3" },
  { name: "리엔", file: "/bgm/리엔.mp3" },
  { name: "수련의 숲", file: "/bgm/수련의 숲.mp3" },
  { name: "슬리피우드", file: "/bgm/슬리피우드.mp3" },
  { name: "에우렐", file: "/bgm/에우렐.mp3" },
  { name: "에레브", file: "/bgm/에레브.mp3" },
  { name: "시간의신전", file: "/bgm/시간의신전.mp3" },
  { name: "시그너스의 전당", file: "/bgm/시그너스의 전당.mp3" },
  { name: "행복한 마을", file: "/bgm/행복한 마을.mp3" },
  { name: "코크타운", file: "/bgm/코크타운.mp3" },
  { name: "빛을 되찾은 사계", file: "/bgm/빛을 되찾은 사계.mp3" },
  { name: "폭풍이 사그라든 여명", file: "/bgm/폭풍이 사그라든 여명.mp3" },
  { name: "나린", file: "/bgm/나린.mp3" },
  { name: "뾰족귀 여우마을", file: "/bgm/뾰족귀 여우마을.mp3" },
  { name: "옥션", file: "/bgm/옥션.mp3" },
  { name: "메이플 아일랜드", file: "/bgm/메이플 아일랜드.mp3" },
  { name: "버섯의 성", file: "/bgm/버섯의 성.mp3" },
  { name: "커닝스퀘어", file: "/bgm/커닝스퀘어.mp3" },
  { name: "라무라무", file: "/bgm/라무라무.mp3" },
];

// BGM 이미지 매핑 (파일명 정규화)
function bgmImagePath(name: string): string {
  const map: Record<string, string> = {
    "시간의신전": "시간의 신전",
  };
  return `/${map[name] || name}.png`;
}

export { bgmImagePath };

let bgmInstance: Howl | null = null;
let bgmEnabled = false;
let currentBgmIndex = Math.floor(Math.random() * BGM_LIST.length);
let _shuffle = false;
let _shuffleHistory: number[] = [];
let _repeat = false;
let _bgmVolume = 0.3;       // BGM 전용 볼륨
let _sfxVolume = 0.2;       // 효과음 전용 볼륨 (20%)
let _unlocked = false;

export function getBgmVolume() { return _bgmVolume; }
export function getSfxVolume() { return _sfxVolume; }
export function setBgmVolume(v: number) { _bgmVolume = Math.max(0, Math.min(1, v)); if (bgmInstance) bgmInstance.volume(_bgmVolume); }
export function setSfxVolume(v: number) { _sfxVolume = Math.max(0, Math.min(1, v)); }

// 볼륨 값 Supabase 저장/로드
export async function saveVolumeToServer(uid: string) {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.from("profiles").select("avatar_config").eq("id", uid).single();
    const cfg = (data?.avatar_config as Record<string, unknown>) ?? {};
    cfg.bgm_volume = _bgmVolume;
    cfg.sfx_volume = _sfxVolume;
    await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", uid);
  } catch {}
}

// 실패 퀘스트 확인 상태 Supabase 저장
export async function saveFailedQuestsChecked(uid: string) {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.from("profiles").select("avatar_config").eq("id", uid).single();
    const cfg = (data?.avatar_config as Record<string, unknown>) ?? {};
    cfg.failed_quests_checked = new Date().toISOString().slice(0, 10);
    await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", uid);
  } catch {}
}

// 실패 퀘스트 확인 상태 불러오기
export async function loadFailedQuestsCheckedDate(uid: string): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.from("profiles").select("avatar_config").eq("id", uid).single();
    const cfg = data?.avatar_config as { failed_quests_checked?: string } | null;
    return cfg?.failed_quests_checked ?? null;
  } catch { return null; }
}

export async function loadVolumeFromServer(uid: string): Promise<{ bgm: number; sfx: number } | null> {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.from("profiles").select("avatar_config").eq("id", uid).single();
    if (data?.avatar_config) {
      const cfg = data.avatar_config as { bgm_volume?: number; sfx_volume?: number };
      if (typeof cfg.bgm_volume === "number") setBgmVolume(cfg.bgm_volume);
      if (typeof cfg.sfx_volume === "number") setSfxVolume(cfg.sfx_volume);
      return { bgm: typeof cfg.bgm_volume === "number" ? cfg.bgm_volume : _bgmVolume, sfx: typeof cfg.sfx_volume === "number" ? cfg.sfx_volume : _sfxVolume };
    }
  } catch {}
  return null;
}

// AudioContext 강제 활성화 (여러 방식 시도)
export async function unlockAudio() {
  if (_unlocked) return;
  if (typeof window === "undefined") return;
  try {
    Howler.volume(_bgmVolume);
    // 방식 1: Howler 자체 AudioContext 사용
    const ctx = Howler.ctx as AudioContext | undefined;
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().then(() => { _unlocked = true; }).catch(() => { tryFallback(); });
      } else {
        _unlocked = true;
      }
      return;
    }
    tryFallback();
  } catch { tryFallback(); }

  function tryFallback() {
    if (_unlocked) return;
    try {
      const newCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (newCtx.state === "suspended") newCtx.resume();
      const buf = newCtx.createBuffer(1, 1, 22050);
      const src = newCtx.createBufferSource();
      src.buffer = buf;
      src.connect(newCtx.destination);
      src.start();
      _unlocked = true;
    } catch {}
  }
}

export function getBgmList() { return BGM_LIST; }
export function getCurrentBgmName(): string { return BGM_LIST[currentBgmIndex]?.name ?? ""; }
export function isBgmPlaying(): boolean { return bgmEnabled && bgmInstance !== null && bgmInstance.playing(); }

export function toggleBgm(): boolean {
  bgmEnabled = !bgmEnabled;
  if (bgmEnabled) {
    unlockAudio();
    if (bgmInstance && !bgmInstance.playing()) {
      bgmInstance.play();
    } else {
      playBgm();
    }
  } else {
    if (bgmInstance) { bgmInstance.stop(); bgmInstance.unload(); bgmInstance = null; }
    bgmEnabled = false;
  }
  return bgmEnabled;
}

function playBgm() {
  if (!bgmEnabled) return;
  const src = BGM_LIST[currentBgmIndex];
  if (!src) { bgmEnabled = false; return; }
  stopBgm();
  bgmEnabled = true;
  bgmInstance = new Howl({
    src: [src.file], loop: false, volume: _bgmVolume, html5: true,
    onend: () => {
      if (_repeat) {
        playBgm(); // 같은 곡 반복
      } else {
        currentBgmIndex = (currentBgmIndex + 1) % BGM_LIST.length;
        playBgm();
      }
    },
  });
  bgmInstance.play();
}

export function stopBgm() {
  if (bgmInstance) { bgmInstance.stop(); bgmInstance.unload(); bgmInstance = null; }
  bgmEnabled = false;
}

export function nextBgm() {
  if (_repeat) {
    // 반복이지만 수동 클릭은 인덱스 이동
    if (!_shuffle) {
      currentBgmIndex = (currentBgmIndex + 1) % BGM_LIST.length;
    } else {
      _shuffleHistory.push(currentBgmIndex);
      const remaining = BGM_LIST.map((_, i) => i).filter(i => !_shuffleHistory.includes(i));
      if (remaining.length === 0) _shuffleHistory = [];
      const pool = remaining.length > 0 ? remaining : BGM_LIST.map((_, i) => i);
      currentBgmIndex = pool[Math.floor(Math.random() * pool.length)];
    }
    if (bgmEnabled) playBgm();
    return;
  }
  if (_shuffle) {
    _shuffleHistory.push(currentBgmIndex);
    const remaining = BGM_LIST.map((_, i) => i).filter(i => !_shuffleHistory.includes(i));
    if (remaining.length === 0) _shuffleHistory = [];
    const pool = remaining.length > 0 ? remaining : BGM_LIST.map((_, i) => i);
    currentBgmIndex = pool[Math.floor(Math.random() * pool.length)];
  } else {
    currentBgmIndex = (currentBgmIndex + 1) % BGM_LIST.length;
  }
  if (bgmEnabled) playBgm();
}

export function prevBgm() {
  if (_repeat) {
    // 반복이지만 수동 클릭은 인덱스 이동
    currentBgmIndex = (currentBgmIndex - 1 + BGM_LIST.length) % BGM_LIST.length;
    if (bgmEnabled) playBgm();
    return;
  }
  currentBgmIndex = (currentBgmIndex - 1 + BGM_LIST.length) % BGM_LIST.length;
  if (bgmEnabled) playBgm();
}

export function toggleShuffle(): boolean {
  _shuffle = !_shuffle;
  if (_shuffle) _shuffleHistory = [currentBgmIndex];
  return _shuffle;
}

export function isShuffleOn(): boolean { return _shuffle; }

// 반복 토글
export function toggleRepeat(): boolean {
  _repeat = !_repeat;
  return _repeat;
}

export function isRepeatOn(): boolean { return _repeat; }

// ─── HTML5 Audio 기반 효과음 ──────────────────────

const sfxCache = new Map<string, HTMLAudioElement>();

function playSfxHtml5(src: string) {
  const vol = _sfxVolume;
  let audio = sfxCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    sfxCache.set(src, audio);
  }
  audio.currentTime = 0;
  audio.volume = vol;
  const p = audio.play();
  if (p) p.catch(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      audio.play().catch(() => {});
    } catch {}
  });
}

export function playCompleteSound() { try { playSfxHtml5("/bgm/완료.mp3"); } catch {} }
export function playFriendRequestSound() { try { playSfxHtml5("/bgm/친추.mp3"); } catch {} }
export function playLevelUpSound() { try { playSfxHtml5("/bgm/레벨업.mp3"); } catch {} }

// 실패(죽음) 효과음
export function playDeathSound() {
  try {
    // 죽음 효과음 재생 중 다른 소리 줄임
    lowerAllVolume();
    const audio = new Audio("/bgm/죽음.mp3");
    audio.volume = Math.min(1, _sfxVolume * 4);
    audio.play().then(() => {
      audio.onended = () => restoreAllVolume();
    }).catch(() => restoreAllVolume());
  } catch { restoreAllVolume(); }
}

// ─── 로그인 페이지 BGM ────────────────────────────

let loginBgm: HTMLAudioElement | null = null;

export function playLoginBgm() {
  if (loginBgm) return;
  unlockAudio();
  try {
    loginBgm = new Audio("/bgm/메이플스토리-로그인.mp3");
    loginBgm.loop = true;
    loginBgm.volume = 0.15;
    loginBgm.play().catch(() => {});
  } catch {}
}

export function isLoginBgmPlaying(): boolean {
  return loginBgm !== null && !loginBgm.paused;
}

export function stopLoginBgm() {
  if (loginBgm) {
    loginBgm.pause();
    loginBgm = null;
  }
}

// ─── 레벨업 시 BGM/효과음 볼륨 동시 제어 ──────────

let _savedBgmVol = _bgmVolume;
let _savedSfxVol = _sfxVolume;

export function lowerAllVolume() {
  _savedBgmVol = _bgmVolume;
  _savedSfxVol = _sfxVolume;
  setBgmVolume(_bgmVolume * 0.2);   // BGM 80%↓
  setSfxVolume(_sfxVolume * 0.2);   // 효과음 80%↓
}

export function restoreAllVolume() {
  setBgmVolume(_savedBgmVol);
  setSfxVolume(_savedSfxVol);
}
