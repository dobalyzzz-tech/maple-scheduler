"use client";

import { useAuth } from "@/app/providers";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { signOut } from "@/lib/supabaseClient";
import { toggleBgm, isBgmPlaying, getCurrentBgmName, nextBgm, prevBgm, stopBgm, toggleShuffle, isShuffleOn, toggleRepeat, isRepeatOn, getBgmList, getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume, saveVolumeToServer, loadVolumeFromServer, unlockAudio, bgmImagePath } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import FriendsPage from "./friends/page";
import ShopPage from "./shop/page";
import InventoryPage from "./inventory/page";

const BGM_LIST = getBgmList();

const IconUsers = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconShop = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
const IconBag = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>;
const IconMusic = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
const IconMute = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const IconLogout = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconVolume = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const IconHeadphones = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [bgmOn, setBgmOn] = useState(false);
  const [bgmName, setBgmName] = useState("");
  const [showBgmModal, setShowBgmModal] = useState(false);
  const [bgmVol, setBgmVol] = useState(getBgmVolume());
  const [sfxVol, setSfxVol] = useState(getSfxVolume());
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [hoverPlay, setHoverPlay] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const handleToggle = useCallback(() => {
    const on = toggleBgm();
    setBgmOn(on);
  }, []);

  const handleNext = useCallback(() => {
    nextBgm();
    setBgmName(getCurrentBgmName());
    setBgmOn(isBgmPlaying());
  }, []);

  const handlePrev = useCallback(() => {
    prevBgm();
    setBgmName(getCurrentBgmName());
    setBgmOn(isBgmPlaying());
  }, []);

  // 재생 상태 모니터링 (0.5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const playing = isBgmPlaying();
      setBgmOn(playing);
      if (playing) {
        const name = getCurrentBgmName();
        setBgmName((prev) => prev !== name ? name : prev);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    unlockAudio();
    loadVolumeFromServer(user.id).then((vol) => {
      if (vol) { setBgmVol(vol.bgm); setSfxVol(vol.sfx); }
    });
    if (!isBgmPlaying()) {
      const on = toggleBgm();
      setBgmOn(on);
      setBgmName(getCurrentBgmName());
    } else {
      setBgmOn(true);
      setBgmName(getCurrentBgmName());
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => saveVolumeToServer(user.id), 3000);
    return () => clearTimeout(timer);
  }, [bgmVol, sfxVol, user]);

  if (loading)
    return <div className="flex-1 flex items-center justify-center font-pixel text-border bg-parchment">모험을 불러오는 중...</div>;

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{backgroundColor:"#2E353D"}}>
      <div className="px-6 py-3 border-b border-border/20" style={{backgroundColor:"#F1E9D8"}}>
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/dashboard" className={`font-pixel text-xs pixel-btn px-3 py-1.5 flex items-center gap-1.5 ${pathname === "/dashboard" ? "bg-maple text-white" : "bg-parchment text-border"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            홈
          </Link>
          <button className={`font-pixel text-xs pixel-btn px-3 py-1.5 flex items-center gap-1.5 bg-parchment text-border`} onClick={() => setShowFriendsModal(true)}><IconUsers /> 친구</button>
          <button className={`font-pixel text-xs pixel-btn px-3 py-1.5 flex items-center gap-1.5 bg-parchment text-border`} onClick={() => setShowShopModal(true)}><IconShop /> 상점</button>
          <button className={`font-pixel text-xs pixel-btn px-3 py-[5.3px] flex items-center gap-1.5 bg-parchment text-border`} onClick={() => setShowInventoryModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6z"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><circle cx="12" cy="13" r="1.5"/><path d="M2 14h3"/><path d="M19 14h3"/></svg>
            인벤토리
          </button>
          <div className="flex-1" />
          <button className={`font-pixel text-[10px] pixel-btn px-3 py-1.5 flex items-center gap-1.5 ${bgmOn ? "bg-maple text-white" : "bg-parchment text-border"}`} onClick={() => setShowBgmModal(true)}>
            {bgmOn ? <IconMusic /> : <IconMute />}
          </button>
          <button className="font-pixel text-xs pixel-btn px-3 py-1.5 bg-parchment text-border flex items-center gap-1.5" onClick={async () => { await signOut(); router.push("/login"); }}>
            <IconLogout /> 로그아웃
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showBgmModal && (
          <motion.div className="fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowBgmModal(false)}>
            <motion.div
              className="relative w-full max-w-5xl mx-4 rounded-2xl overflow-hidden shadow-2xl border border-border/10 flex"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.12) 100%)", height: "80vh", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", opacity: 0.95 }}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col w-full h-full">
                <div className="flex flex-1 min-h-0">
                  <div className="w-[20%] border-r border-border/10 flex flex-col">
                    <div className="px-4 pt-4 pb-2 border-b border-border/10 shrink-0">
                      <h2 className="font-pixel text-xs text-sky-500">Playlist</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
                      {BGM_LIST.map((bgm) => (
                        <button key={bgm.name}
                          className={`w-full text-left px-4 py-2.5 rounded-lg mb-1 font-pixel text-base transition-all ${bgm.name === bgmName && bgmOn ? "bg-sky-500 text-white" : "text-border/70 hover:bg-border/5 hover:text-border"}`}
                          onClick={() => { while (getCurrentBgmName() !== bgm.name) nextBgm(); setBgmName(getCurrentBgmName()); setBgmOn(true); }}
                        >{bgm.name}</button>
                      ))}
                    </div>
                  </div>

                  <div className="w-[80%] flex flex-col min-h-0">
                    <div className="flex-1 relative h-full">
                      <div className="absolute left-6 w-[20%] aspect-square rounded-lg overflow-hidden border-2 border-border/10 shadow-lg bg-border/10" style={{ bottom: "2rem" }}>
                        {bgmName && (
                          <img src={bgmImagePath(bgmName)} alt={bgmName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        )}
                      </div>
                      <div className="absolute top-8 left-8">
                        <div className="text-border/60 font-pixel text-[10px]">NOW PLAYING</div>
                        <div className="text-border/80 font-pixel text-sm drop-shadow-sm mt-2">{bgmOn ? bgmName || "재생 중..." : "일시정지"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 px-6 py-4 border-t border-border/10 bg-border/5">
                  <div className="flex items-center gap-3">
                    <div className="w-[20%] min-w-0">
                      <div className="font-pixel text-xs text-border/80 truncate">{bgmName || (bgmOn ? "재생 중..." : "일시정지")}</div>
                    </div>

                    <div className="flex-1 flex items-center justify-center gap-4">
                      <button className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${shuffleOn ? "bg-maple/40 text-maple" : "bg-border/5 hover:bg-border/10 text-border/80"}`}
                        onClick={() => { const s = toggleShuffle(); setShuffleOn(s); }} title="셔플">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />
                        </svg>
                      </button>
                      <button className="w-7 h-7 rounded-full bg-border/5 hover:bg-border/10 flex items-center justify-center text-border/80 transition-all"
                        onClick={handlePrev} title="이전 곡">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" /></svg>
                      </button>
                      <button className="w-9 h-9 rounded-full bg-border/10 hover:bg-white/30 flex items-center justify-center text-border/80 transition-all"
                        onClick={handleToggle} onMouseEnter={() => setHoverPlay(true)} onMouseLeave={() => setHoverPlay(false)} title={bgmOn ? "일시정지" : "재생"}>
                        {bgmOn && hoverPlay ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                        ) : bgmOn ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        )}
                      </button>
                      <button className="w-7 h-7 rounded-full bg-border/5 hover:bg-border/10 flex items-center justify-center text-border/80 transition-all"
                        onClick={() => { nextBgm(); setBgmName(getCurrentBgmName()); }} title="다음 곡">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" /></svg>
                      </button>
                      <button className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${repeatOn ? "bg-maple/40 text-maple" : "bg-border/5 hover:bg-border/10 text-border/80"}`}
                        onClick={() => { const r = toggleRepeat(); setRepeatOn(r); }} title="반복">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                    </div>

                    <div className="w-[20%] flex justify-end relative">
                      <button className="w-8 h-8 rounded-full bg-border/5 hover:bg-border/10 flex items-center justify-center text-border/80 transition-all"
                        onClick={() => setShowVolume(!showVolume)} title="볼륨">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </button>
                      {showVolume && (
                        <div className="absolute bottom-full right-0 mb-2 px-4 py-3 rounded-xl bg-border/5 backdrop-blur-md border border-border/10 shadow-lg" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-3 min-w-[120px]">
                            <div className="flex items-center gap-3">
                              <span className="text-border/60 text-[10px] font-pixel">BGM</span>
                              <input type="range" min="0" max="100" value={Math.round(bgmVol * 100)}
                                onChange={(e) => { const v = Number(e.target.value) / 100; setBgmVol(v); setBgmVolume(v); }}
                                className="flex-1 accent-maple h-1" />
                              <span className="text-border/60 text-[10px] font-pixel w-6 text-right">{Math.round(bgmVol * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-border/60 text-[10px] font-pixel">SFX</span>
                              <input type="range" min="0" max="100" value={Math.round(sfxVol * 100)}
                                onChange={(e) => { const v = Number(e.target.value) / 100; setSfxVol(v); setSfxVolume(v); }}
                                className="flex-1 accent-maple h-1" />
                              <span className="text-border/60 text-[10px] font-pixel w-6 text-right">{Math.round(sfxVol * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 친구 모달 */}
      <AnimatePresence>
        {showFriendsModal && (
          <motion.div className="fixed inset-0 flex items-start justify-center z-50 pt-12" onClick={() => setShowFriendsModal(false)}>
            <motion.div
              className="relative w-full max-w-3xl mx-4 rounded-2xl overflow-hidden"
              style={{ backgroundColor:"transparent", maxHeight: "80vh" }}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              drag dragMomentum={false} dragElastic={0}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: "rgba(46,53,61,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
              <div className="relative z-10">
                <div className="px-5 pt-1 pb-0">
                  <span className="font-pixel text-sm tracking-widest" style={{color:"#DDFE01"}}>FRIENDS</span>
                </div>
                <div className="overflow-y-auto p-[1.5px] scrollbar-none" style={{ maxHeight: "calc(80vh - 40px)" }}>
                  <FriendsPage />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 상점 모달 */}
      <AnimatePresence>
        {showShopModal && (
          <motion.div className="fixed inset-0 flex items-start justify-center z-50 pt-12" onClick={() => setShowShopModal(false)}>
            <motion.div
              className="relative w-full max-w-3xl mx-4 rounded-2xl overflow-hidden"
              style={{ backgroundColor:"transparent", maxHeight: "80vh" }}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              drag dragMomentum={false} dragElastic={0}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: "rgba(46,53,61,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
              <div className="relative z-10">
                <div className="px-5 pt-1 pb-0">
                  <span className="font-pixel text-sm tracking-widest" style={{color:"#DDFE01"}}>SHOP</span>
                </div>
                <div className="overflow-y-auto p-[1.5px] scrollbar-none" style={{ maxHeight: "calc(80vh - 40px)" }}>
                  <ShopPage />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 인벤토리 모달 */}
      <AnimatePresence>
        {showInventoryModal && (
          <motion.div className="fixed inset-0 flex items-start justify-center z-50 pt-12" onClick={() => { setShowInventoryModal(false); window.dispatchEvent(new CustomEvent("inventory-closed")); }}>
            <motion.div
              className="relative w-full max-w-3xl mx-4 rounded-2xl overflow-hidden"
              style={{ backgroundColor:"transparent", maxHeight: "80vh" }}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              drag dragMomentum={false} dragElastic={0}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: "rgba(46,53,61,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
              <div className="relative z-10">
                <div className="px-5 pt-1 pb-0">
                  <span className="font-pixel text-sm tracking-widest" style={{color:"#DDFE01"}}>INVENTORY</span>
                </div>
                <div className="overflow-y-auto p-[1.5px] scrollbar-none" style={{ maxHeight: "calc(80vh - 40px)" }}>
                  <InventoryPage />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}
