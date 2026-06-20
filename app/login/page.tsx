"use client";

import { signInWithGoogle } from "@/lib/supabaseClient";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { playLoginBgm, stopLoginBgm, isLoginBgmPlaying, unlockAudio } from "@/lib/sound";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bgmOn, setBgmOn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      stopLoginBgm();
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // 로그인 페이지 진입 시 바로 BGM 재생 시도
  useEffect(() => {
    playLoginBgm();
    try { localStorage.setItem("audio_unlocked", "1"); } catch {}
    const timer = setTimeout(() => setBgmOn(isLoginBgmPlaying()), 1000);
    return () => { stopLoginBgm(); clearTimeout(timer); };
  }, []);

  const handleToggleBgm = async () => {
    await unlockAudio();
    if (isLoginBgmPlaying()) {
      stopLoginBgm();
      setBgmOn(false);
    } else {
      stopLoginBgm(); // 기존 실패한 인스턴스 제거
      playLoginBgm();
      setBgmOn(true);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center font-pixel text-border">모험을 불러오는 중...</div>;
  if (user) return null;

  return (
    <>
      <div
        className="flex-1 flex flex-col items-center justify-center bg-cover bg-center min-h-screen"
        style={{ backgroundImage: "url('/로그인화면.png')" }}
      >
        <div className="pixel-box px-6g py-4g text-center max-w-sm w-full bg-parchment/90 backdrop-blur-sm">
          <div className="text-5xl mb-3g">🎮</div>
          <h1 className="text-2xl font-pixel text-maple mb-1g">
            도트 스케줄러
          </h1>
          <p className="text-sm font-pixel text-border mb-4g">
            일정은 퀘스트, 당신은 모험가<br />
            오늘의 모험을 시작하세요!
          </p>

          <button
            className="pixel-btn px-4g py-2g text-lg w-full"
            onClick={() => {
              playLoginBgm();
              signInWithGoogle();
            }}
          >
            모험 시작하기
          </button>
        </div>

        <p className="text-xs text-border/60 mt-3g font-pixel bg-parchment/60 px-2g py-1g rounded-sm">
          Google 계정으로 로그인하면 바로 시작할 수 있어요
        </p>
      </div>

      {/* 우측 하단 음소거 버튼 (fixed, layout 밖) */}
      <button
        className="fixed bottom-6g right-6g w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 flex items-center justify-center transition-all z-50"
        onClick={handleToggleBgm}
        title={bgmOn ? "음소거" : "소리 켜기"}
      >
        {bgmOn ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>
    </>
  );
}
