"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, createContext, useContext, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCharacterStore } from "@/store/useCharacterStore";
import { playFriendRequestSound, loadVolumeFromServer, playDeathSound, unlockAudio, loadFailedQuestsCheckedDate } from "@/lib/sound";
import type { User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true });
export const useAuth = () => useContext(AuthContext);

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const prevCountRef = useRef(0);
  const prevCoInviteCountRef = useRef(0);
  const lastCheckedDateRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    let prevDate = "";

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id);
        const todayStr = new Date().toISOString().slice(0, 10);
        lastCheckedDateRef.current = todayStr;
        prevDate = todayStr;
      }
      setLoading(false);
    });

    const { data: { subscription: listener } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile({ nickname: "모험가", level: 1, exp: 0, coins: 0, title: "초보 모험가" });
    });

    const interval = setInterval(async () => {
      const sess = (await supabase.auth.getSession()).data.session;
      if (!sess?.user) return;

      const nowStr = new Date().toISOString().slice(0, 10);
      if (lastCheckedDateRef.current && lastCheckedDateRef.current !== nowStr) {
        lastCheckedDateRef.current = nowStr;
        checkFailedQuests(sess.user.id);
      }

      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee", sess.user.id)
        .eq("status", "pending");

      const current = count ?? 0;
      if (current > prevCountRef.current) {
        playFriendRequestSound();
      }
      prevCountRef.current = current;

      // 협동 퀘스트 초대 알림
      const { data: coData } = await supabase
        .from("co_quest_members")
        .select("*")
        .eq("user_id", sess.user.id);

      const coCurrent = (coData ?? []).filter((r: { status: string }) => r.status === "pending").length;
      if (coCurrent > prevCoInviteCountRef.current) {
        playFriendRequestSound();
      }
      prevCoInviteCountRef.current = coCurrent;
    }, 1000);

    return () => {
      cancelled = true;
      listener?.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // equipment-changed 이벤트 수신 → 프로필 다시 로드
  useEffect(() => {
    const handler = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) loadProfile(user.id);
      });
    };
    window.addEventListener("equipment-changed", handler);
    return () => window.removeEventListener("equipment-changed", handler);
  }, []);

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, level, exp, coins, title, avatar_config")
      .eq("id", uid)
      .single();

    if (data) {
      setProfile({
        nickname: data.nickname,
        level: data.level,
        exp: data.exp,
        coins: data.coins,
        title: data.title ?? "초보 모험가",
      });
      loadVolumeFromServer(uid);
      unlockAudio();
      checkFailedQuests(uid);
      checkFriendRequests(uid);
      checkCoQuestInvites(uid);
      grantDefaultBackground(uid);
      grantDefaultTitle(uid);
    } else {
      // 프로필 없으면 새로 생성
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          id: uid,
          nickname: "모험가",
          level: 1,
          exp: 0,
          coins: 0,
        })
        .select("id, nickname, level, exp, coins, title, avatar_config")
        .single();

      if (newProfile) {
        setProfile({
          nickname: newProfile.nickname,
          level: newProfile.level,
          exp: newProfile.exp,
          coins: newProfile.coins,
          title: newProfile.title ?? "초보 모험가",
        });
        loadVolumeFromServer(uid);
        unlockAudio();
        checkFailedQuests(uid);
        checkFriendRequests(uid);
        checkCoQuestInvites(uid);
        grantDefaultBackground(uid);
        grantDefaultTitle(uid);
      }
    }
  }

  async function checkCoQuestInvites(uid: string) {
    try {
      const { data } = await supabase
        .from("co_quest_members")
        .select("*")
        .eq("user_id", uid);

      const pending = (data ?? []).filter((r: { status: string }) => r.status === "pending");
      if (pending.length > 0) {
        playFriendRequestSound();
      }
    } catch {}
  }

  async function checkFriendRequests(uid: string) {
    try {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee", uid)
        .eq("status", "pending");

      if (count && count > 0) {
        playFriendRequestSound();
      }
    } catch {}
  }

  async function grantDefaultBackground(uid: string) {
    try {
      const { data: bgItem } = await supabase
        .from("items")
        .select("id")
        .eq("asset_url", "/background/마야의 집.png")
        .single();

      if (!bgItem) return;

      const { data: invCheck } = await supabase
        .from("inventory")
        .select("item_id")
        .eq("user_id", uid)
        .eq("item_id", bgItem.id);

      if (invCheck && invCheck.length > 0) return;

      await supabase.from("inventory").insert({
        user_id: uid,
        item_id: bgItem.id,
        equipped: true,
      });
    } catch {
      console.error("grantDefaultBackground error:");
    }
  }

  async function grantDefaultTitle(uid: string) {
    try {
      const { data: titleItem } = await supabase
        .from("items")
        .select("id")
        .eq("name", "초보 모험가")
        .single();

      if (!titleItem) return;

      const { data: invCheck } = await supabase
        .from("inventory")
        .select("item_id")
        .eq("user_id", uid)
        .eq("item_id", titleItem.id);

      if (invCheck && invCheck.length > 0) return;

      await supabase.from("inventory").insert({
        user_id: uid,
        item_id: titleItem.id,
        equipped: true,
      });
    } catch {
      console.error("grantDefaultTitle error:");
    }
  }

  async function checkFailedQuests(uid: string) {
    try {
      const checkedDate = await loadFailedQuestsCheckedDate(uid);
      if (checkedDate) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, title, difficulty")
        .eq("user_id", uid);

      if (!schedules || schedules.length === 0) return;

      const scheduleIds = schedules.map((s: { id: string }) => s.id);

      const { data: logs } = await supabase
        .from("schedule_logs")
        .select("schedule_id")
        .in("schedule_id", scheduleIds)
        .eq("target_date", yesterdayStr);

      const completedIds = new Set((logs ?? []).map((l: { schedule_id: string }) => l.schedule_id));
      const failed = schedules.filter((s: { id: string }) => !completedIds.has(s.id));

      if (failed.length > 0) {
        playDeathSound();
        window.dispatchEvent(new CustomEvent("failed-quests", { detail: failed }));
      }
    } catch {}
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, loading }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
