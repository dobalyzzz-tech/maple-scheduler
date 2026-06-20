// lib/queries.ts — TanStack Query 훅 (schedules + schedule_logs)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { expandRecurrence } from "@/lib/recurrence";
import { useCharacterStore } from "@/store/useCharacterStore";

// ─── 타입 ────────────────────────────────────────────

export interface ScheduleRow {
  id: string;
  user_id: string;
  title: string;
  memo: string | null;
  difficulty: number;     // 1~3
  start_at: string;       // ISO
  is_recurring: boolean;
  recur_rule: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface QuestInstance {
  scheduleId: string;
  title: string;
  memo: string | null;
  difficulty: number;
  date: string;           // YYYY-MM-DD
  done: boolean;
}

export interface CalendarDay {
  date: string;           // YYYY-MM-DD
  instances: QuestInstance[];
}

// ─── 헬퍼: XSS sanitize ─────────────────────────────

export function sanitize(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── 헬퍼: 월 범위 계산 ─────────────────────────────

export function monthBoundary(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1)); // 다음 달 1일 (between exclusive)
  return {
    fromStr: from.toISOString().slice(0, 10),
    toStr: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10), // 마지막 날 문자열
    from,
    to,
  };
}

// ─── 쿼리: 월간 schedules → CalendarDay[] ──────────

export function useSchedules(year: number, month: number) {
  const { from, to, fromStr, toStr } = monthBoundary(year, month);

  return useQuery<CalendarDay[]>({
    queryKey: ["schedules", year, month],
    queryFn: async () => {
      // 1) 반복 일정은 start_at 관계없이 모두 조회, 일회성은 현재 달 범위만
      const { data: recurringSchedules, error: recErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("is_recurring", true);

      const { data: onceSchedules, error: onceErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("is_recurring", false)
        .gte("start_at", fromStr)
        .lte("start_at", toStr + "T23:59:59Z")
        .order("start_at");

      const error = recErr || onceErr;
      const schedules = [...(recurringSchedules ?? []), ...(onceSchedules ?? [])] as ScheduleRow[];

      if (error) throw error;
      if (!schedules || schedules.length === 0) return [];

      const scheduleIds = schedules.map((s: ScheduleRow) => s.id);

      // 2) 같은 기간 schedule_logs 조회
      const { data: logs, error: logsError } = await supabase
        .from("schedule_logs")
        .select("schedule_id, target_date")
        .in("schedule_id", scheduleIds)
        .gte("target_date", fromStr)
        .lte("target_date", toStr);

      if (logsError) throw logsError;

      // 3) 일자별 맵 구성
      const dayMap = new Map<string, QuestInstance[]>();
      for (const s of schedules as ScheduleRow[]) {
        let dates: Date[] = [];

        if (s.is_recurring && s.recur_rule) {
          // 반복 일정: RRULE 전개
          dates = expandRecurrence(s.recur_rule, from, to);
        } else {
          // 일회성: 시작일만
          const d = new Date(s.start_at);
          if (d >= from && d <= to) dates = [d];
        }

        for (const d of dates) {
          const dateStr = d.toISOString().slice(0, 10);
          const done = (logs ?? []).some(
            (l) => l.schedule_id === s.id && l.target_date === dateStr
          );
          const inst: QuestInstance = {
            scheduleId: s.id,
            title: s.title,
            memo: s.memo,
            difficulty: s.difficulty,
            date: dateStr,
            done,
          };
          const arr = dayMap.get(dateStr) ?? [];
          arr.push(inst);
          dayMap.set(dateStr, arr);
        }
      }

      // CalendarDay[]로 변환
      const result: CalendarDay[] = [];
      const cursor = new Date(from);
      while (cursor <= to) {
        const dateStr = cursor.toISOString().slice(0, 10);
        result.push({
          date: dateStr,
          instances: dayMap.get(dateStr) ?? [],
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      return result;
    },
    staleTime: 30_000,
  });
}

// ─── 쿼리: 오늘의 퀘스트 ─────────────────────────────

export function useTodayQuests(year: number, month: number) {
  const today = new Date().toISOString().slice(0, 10);
  const query = useSchedules(year, month);
  const data = query.data ?? [];

  const todayData = data.find((d) => d.date === today);
  return {
    ...query,
    data: todayData?.instances ?? [],
  };
}

// ─── 뮤테이션: 일정 추가 ─────────────────────────────

export function useAddSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      memo?: string;
      difficulty: number;
      start_at: string;
      is_recurring: boolean;
      recur_rule?: string | null;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data, error } = await supabase
        .from("schedules")
        .insert({
          user_id: user.id,
          title: sanitize(input.title),
          memo: input.memo ? sanitize(input.memo) : null,
          difficulty: input.difficulty,
          start_at: input.start_at,
          is_recurring: input.is_recurring,
          recur_rule: input.recur_rule ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// ─── 뮤테이션: 일정 수정 ─────────────────────────────

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      memo?: string | null;
      difficulty?: number;
      start_at?: string;
      is_recurring?: boolean;
      recur_rule?: string | null;
    }) => {
      const payload: Record<string, unknown> = {};
      if (input.title !== undefined) payload.title = sanitize(input.title);
      if (input.memo !== undefined) payload.memo = input.memo ? sanitize(input.memo) : null;
      if (input.difficulty !== undefined) payload.difficulty = input.difficulty;
      if (input.start_at !== undefined) payload.start_at = input.start_at;
      if (input.is_recurring !== undefined) payload.is_recurring = input.is_recurring;
      if (input.recur_rule !== undefined) payload.recur_rule = input.recur_rule ?? null;

      const { error } = await supabase
        .from("schedules")
        .update(payload)
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// ─── 뮤테이션: 일정 삭제 ─────────────────────────────

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// ─── 뮤테이션: 완료 후 캐시 갱신 (CompleteButton에서 사용) ──

export function useRefreshSchedules() {
  const qc = useQueryClient();
  const applyReward = useCharacterStore((s) => s.applyReward);

  return async (result: {
    status: string;
    exp_gain: number;
    coin_gain: number;
    level: number;
    exp: number;
    leveled_up: boolean;
  }) => {
    if (result.status === "ok") {
      applyReward(result);
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["quest-stats"] });
    }
    return result;
  };
}

// ─── 친구 시스템 ────────────────────────────────────

export interface FriendProfile {
  id: string;
  nickname: string;
  level: number;
  title: string | null;
  friend_code: string;
}

export interface FriendshipRow {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
}

// 내 친구 목록 (accepted)
export function useFriends() {
  return useQuery<FriendProfile[]>({
    queryKey: ["friends"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];

      const { data: rels, error } = await supabase
        .from("friendships")
        .select("requester, addressee")
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
        .eq("status", "accepted");

      if (error) throw error;
      if (!rels || rels.length === 0) return [];

      const friendIds = rels.map((r: { requester: string; addressee: string }) =>
        r.requester === user.id ? r.addressee : r.requester
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, level, title, friend_code")
        .in("id", friendIds);

      return (profiles ?? []) as FriendProfile[];
    },
    staleTime: 30_000,
  });
}

// 받은 친구 요청 (pending, 내가 addressee)
export function useFriendRequests() {
  return useQuery<{ id: string; requester_id: string; nickname: string; level: number }[]>({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];

      const { data: reqs, error } = await supabase
        .from("friendships")
        .select("id, requester")
        .eq("addressee", user.id)
        .eq("status", "pending");

      if (error) throw error;
      if (!reqs || reqs.length === 0) return [];

      const requesterIds = reqs.map((r: { requester: string }) => r.requester);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, level")
        .in("id", requesterIds);

      return reqs.map((r: { id: string; requester: string }) => {
        const p = (profiles ?? []).find((pr: { id: string }) => pr.id === r.requester);
        return {
          id: r.id,
          requester_id: r.requester,
          nickname: p?.nickname ?? "??",
          level: p?.level ?? 1,
        };
      });
    },
    staleTime: 10_000,
  });
}

// 친구 검색 (닉네임)
export function useSearchProfiles(friendCode: string) {
  return useQuery<FriendProfile[]>({
    queryKey: ["search-profiles", friendCode],
    queryFn: async () => {
      if (!friendCode.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, level, title, friend_code")
        .eq("friend_code", friendCode.toUpperCase())
        .limit(1);
      return (data ?? []) as FriendProfile[];
    },
    enabled: friendCode.trim().length > 0,
    staleTime: 10_000,
  });
}

// 친구 신청
export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addresseeId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("friendships").insert({
        requester: user.id,
        addressee: addresseeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

// 친구 요청 수락
export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

// 친구 삭제
export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      await supabase
        .from("friendships")
        .delete()
        .or(`and(requester.eq.${user.id},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${user.id})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

// 친구 요청 거절 (friendship id로 삭제)
export function useRejectFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      await supabase.from("friendships").delete().eq("id", friendshipId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

// ─── 파티 퀘스트 ────────────────────────────────────

export interface CoQuest {
  id: string;
  title: string;
  goal_count: number;
  current_count: number;
  ends_at: string | null;
  schedule_id: string | null;
  members: { user_id: string; nickname: string; contribution: number; done: boolean }[];
}

// 참여 중인 파티 퀘스트 목록
export function useCoQuests() {
  return useQuery<CoQuest[]>({
    queryKey: ["co-quests"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];

      const { data: members, error: mErr } = await supabase
        .from("co_quest_members")
        .select("quest_id, user_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (mErr) throw mErr;
      if (!members || members.length === 0) return [];

      const questIds = [...new Set(members.map((m: { quest_id: string }) => m.quest_id))];

      const { data: quests } = await supabase
        .from("co_quests")
        .select("*")
        .in("id", questIds)
        .eq("deleted", false);

      const { data: allMembers } = await supabase
        .from("co_quest_members")
        .select("quest_id, user_id, contribution")
        .in("quest_id", questIds)
        .eq("status", "accepted");

      const allUserIds = [...new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", allUserIds);

      // 오늘 날짜의 모든 멤버 완료 상태 조회
      const today = new Date().toISOString().slice(0, 10);
      const scheduleIds = (quests ?? [])
        .map((q: { schedule_id: string | null }) => q.schedule_id)
        .filter(Boolean) as string[];

      let todayLogs: { user_id: string; schedule_id: string }[] = [];
      if (scheduleIds.length > 0) {
        const { data: logs } = await supabase
          .from("schedule_logs")
          .select("schedule_id")
          .in("schedule_id", scheduleIds)
          .eq("target_date", today);
        todayLogs = (logs ?? []).map((l: { schedule_id: string }) => ({ user_id: user.id, schedule_id: l.schedule_id }));
      }

      // 멤버별 완료 여부: avatar_config.co_schedules에 저장된 schedule_id와 schedule_logs 비교
      // 각자의 schedule_id는 avatar_config에 저장되어 있음
      // (상대방의 avatar_config는 읽을 수 없으므로, contribution으로 대체)
      return ((quests ?? []) as CoQuest[]).map((q) => {
        const qMembers = (allMembers ?? [])
          .filter((m: { quest_id: string }) => m.quest_id === q.id)
          .map((m: { user_id: string; contribution: number }) => ({
            user_id: m.user_id,
            nickname: (profiles ?? []).find((p: { id: string }) => p.id === m.user_id)?.nickname ?? "??",
            contribution: m.contribution,
            done: m.contribution > 0 || todayLogs.some((l) => l.schedule_id === q.schedule_id),
          }));
        return { ...q, members: qMembers };
      });
    },
    staleTime: 1_000,
  });
}

// 파티 퀘스트 생성
export function useCreateCoQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; goal_count: number; memberIds: string[] }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data: quest, error } = await supabase
        .from("co_quests")
        .insert({ title: input.title, goal_count: input.goal_count })
        .select()
        .single();
      if (error) throw error;

      const allMembers = [...new Set([user.id, ...input.memberIds])];
      const { error: mErr } = await supabase.from("co_quest_members").insert(
        allMembers.map((uid) => ({ quest_id: quest.id, user_id: uid }))
      );
      if (mErr) throw mErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["co-quests"] }),
  });
}

// 받은 파티 퀘스트 초대 목록
export function usePendingCoQuestInvites() {
  return useQuery<{ quest_id: string; quest_title: string; creator_nickname: string; creator_id: string }[]>({
    queryKey: ["co-quest-invites"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];

      const { data: invites, error } = await supabase
        .from("co_quest_members")
        .select("quest_id, user_id")
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
      if (!invites || invites.length === 0) return [];

      const questIds = [...new Set(invites.map((i: { quest_id: string }) => i.quest_id))];

      const { data: quests } = await supabase
        .from("co_quests")
        .select("id, title, creator_id")
        .in("id", questIds);

      const creatorIds = [...new Set((quests ?? []).map((q: { creator_id: string }) => q.creator_id))];

      const { data: creators } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", creatorIds);

      return (quests ?? []).map((q: { id: string; title: string; creator_id: string }) => ({
        quest_id: q.id,
        quest_title: q.title,
        creator_id: q.creator_id,
        creator_nickname: (creators ?? []).find((c: { id: string }) => c.id === q.creator_id)?.nickname ?? "??",
      }));
    },
    staleTime: 10_000,
  });
}

// 파티 퀘스트 초대 수락
export function useAcceptCoQuestInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // co_quest_members 상태를 accepted로 변경
      await supabase
        .from("co_quest_members")
        .update({ status: "accepted" })
        .eq("quest_id", questId)
        .eq("user_id", user.id);

      // co_quests에서 퀘스트 정보를 읽어서 내 schedules에 추가
      const { data: coQuest } = await supabase
        .from("co_quests")
        .select("title, target_date, recur_rule")
        .eq("id", questId)
        .single();

      if (coQuest) {
        const targetDate = coQuest.target_date ?? new Date().toISOString().slice(0, 10);
        const { data: newSchedule } = await supabase
          .from("schedules")
          .insert({
            user_id: user.id,
            title: coQuest.title,
            memo: null,
            difficulty: 1,
            start_at: `${targetDate}T09:00:00`,
            is_recurring: !!coQuest.recur_rule,
            recur_rule: coQuest.recur_rule ?? null,
          })
          .select("id")
          .single();

        if (newSchedule) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_config")
            .eq("id", user.id)
            .single();

          const cfg = (profile?.avatar_config as Record<string, unknown>) ?? {};
          const coSchedules = (cfg.co_schedules as Record<string, string>) ?? {};
          coSchedules[questId] = newSchedule.id;
          cfg.co_schedules = coSchedules;
          await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", user.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["co-quests"] });
      qc.invalidateQueries({ queryKey: ["co-quest-invites"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// 파티 퀘스트 초대 거절
export function useRejectCoQuestInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      await supabase
        .from("co_quest_members")
        .delete()
        .eq("quest_id", questId)
        .eq("user_id", user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["co-quest-invites"] }),
  });
}

// 파티 퀘스트 탈퇴
export function useLeaveCoQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // creator 확인을 위해 먼저 co_quests 조회
      const { data: coQuest } = await supabase
        .from("co_quests")
        .select("creator_id, schedule_id")
        .eq("id", questId)
        .single();

      if (coQuest?.creator_id === user.id) {
        // 방장 탈퇴: 다른 멤버에게 방장 위임
        // 멤버 삭제 전에 다른 멤버 확인
        const { data: allQuestMembers } = await supabase
          .from("co_quest_members")
          .select("*")
          .eq("quest_id", questId);

        const otherMember = (allQuestMembers ?? []).find((m: { user_id: string }) => m.user_id !== user.id);

        if (otherMember) {
          // 다른 멤버가 있으면 방장 위임 후 자신만 탈퇴
          await supabase.from("co_quests").update({ creator_id: otherMember.user_id }).eq("id", questId);
          // 자신의 멤버 레코드와 스케줄 삭제
          await supabase.from("co_quest_members").delete().eq("quest_id", questId).eq("user_id", user.id);
          if (coQuest.schedule_id) {
            await supabase.from("schedules").delete().eq("id", coQuest.schedule_id);
          }
        } else {
          // 남은 멤버가 없으면 퀘스트 완전 삭제
          await supabase.from("co_quest_members").delete().eq("quest_id", questId);
          if (coQuest.schedule_id) {
            await supabase.from("schedules").delete().eq("id", coQuest.schedule_id);
          }
          await supabase.from("co_quests").delete().eq("id", questId);
        }
      } else {
        // 일반 멤버 탈퇴: 자신의 스케줄도 삭제
        await supabase.from("co_quest_members").delete().eq("quest_id", questId).eq("user_id", user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_config")
          .eq("id", user.id)
          .single();

        const cfg = profile?.avatar_config as { co_schedules?: Record<string, string> } | null;
        if (cfg?.co_schedules && cfg.co_schedules[questId]) {
          await supabase.from("schedules").delete().eq("id", cfg.co_schedules[questId]);
          delete cfg.co_schedules[questId];
          await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", user.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["co-quests"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// ─── 상점 시스템 ────────────────────────────────────

export interface ShopItem {
  id: string;
  name: string;
  category: "avatar" | "theme" | "title" | "background";
  price: number;
  asset_url: string | null;
}

export function useShopItems() {
  return useQuery<ShopItem[]>({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const { data } = await supabase.from("items").select("*").order("price");
      return (data ?? []) as ShopItem[];
    },
    staleTime: 60_000,
  });
}

export function useMyInventory() {
  return useQuery<{ item_id: string; equipped: boolean; name: string; category: string; asset_url: string | null }[]>({
    queryKey: ["my-inventory"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];
      const { data: inv } = await supabase
        .from("inventory")
        .select("item_id, equipped")
        .eq("user_id", user.id);
      if (!inv || inv.length === 0) return [];

      const { data: items } = await supabase
        .from("items")
        .select("id, name, category, asset_url")
        .in("id", inv.map((i: { item_id: string }) => i.item_id));

      return inv.map((i: { item_id: string; equipped: boolean }) => {
        const item = (items ?? []).find((it: { id: string }) => it.id === i.item_id);
        return {
          item_id: i.item_id,
          equipped: i.equipped,
          name: item?.name ?? "??",
          category: item?.category ?? "unknown",
          asset_url: item?.asset_url ?? null,
        };
      });
    },
    staleTime: 15_000,
  });
}

export function useBuyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data: item } = await supabase.from("items").select("price").eq("id", itemId).single();
      if (!item) throw new Error("아이템을 찾을 수 없어요.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", user.id)
        .single();
      if (!profile || profile.coins < item.price) throw new Error("코인이 부족해요!");

      const { error: buyErr } = await supabase.rpc("buy_item", {
        p_item_id: itemId,
        p_price: item.price,
      });
      if (buyErr) throw buyErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-inventory"] });
      qc.invalidateQueries({ queryKey: ["shop-items"] });
    },
  });
}

export function useEquipItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, equipped }: { itemId: string; equipped: boolean }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // 항상 아이템 정보 먼저 조회 (장착/해제 모두 필요)
      const { data: item } = await supabase
        .from("items")
        .select("category, name")
        .eq("id", itemId)
        .single();

      const targetItem = item as { category: string; name: string } | null;

      if (equipped) {
        if (targetItem) {
          if (targetItem.category === "avatar") {
            // 아바타: 같은 부위(slot)만 해제 (헤어/얼굴/상의/하의/악세서리)
            const slotMap: Record<string, string[]> = {
              hair: ["더벅 머리", "커닝시티 헤어", "토벤 머리"],
              face: ["자신있는 얼굴", "도전적인 얼굴", "신중한 얼굴"],
              top: ["주황색 츄리닝 상의", "주황색 점퍼", "흰색 셔츠"],
              bottom: ["주황색 츄리닝 하의", "청반바지", "흰색 청바지"],
              accessory: ["오렌지색 선글라스", "파란색 비니", "하늘색 고글 비니"],
            };
            const slot = Object.entries(slotMap).find(([, names]) => names.includes(targetItem.name))?.[0];
            if (slot) {
              const slotItemNames = slotMap[slot];
              const { data: slotItems } = await supabase
                .from("items")
                .select("id")
                .eq("category", "avatar")
                .in("name", slotItemNames);
              if (slotItems && slotItems.length > 0) {
                await supabase
                  .from("inventory")
                  .update({ equipped: false })
                  .eq("user_id", user.id)
                  .in("item_id", slotItems.map((i: { id: string }) => i.id));
              }
            }
          } else {
            // 아바타 외: 같은 카테고리 전체 해제
            const { data: sameCategory } = await supabase
              .from("items")
              .select("id")
              .eq("category", targetItem.category);

            if (sameCategory && sameCategory.length > 0) {
              await supabase
                .from("inventory")
                .update({ equipped: false })
                .eq("user_id", user.id)
                .in("item_id", sameCategory.map((i: { id: string }) => i.id));
            }
          }
        }
      }

      // 대상 아이템 토글
      if (!equipped && targetItem?.category === "title") {
        // 칭호 해제 시 같은 카테고리에서 최소 하나는 장착되어 있어야 함
        const { data: sameCategoryItems } = await supabase
          .from("items")
          .select("id")
          .eq("category", "title");

        if (sameCategoryItems && sameCategoryItems.length > 0) {
          const { count } = await supabase
            .from("inventory")
            .select("item_id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("equipped", true)
            .in("item_id", sameCategoryItems.map((i: { id: string }) => i.id));
          if (count !== null && count <= 1) return; // 마지막 칭호는 해제 불가
        }
      }

      if (!equipped && targetItem?.category === "background") {
        // 배경 해제 시 같은 카테고리에서 최소 하나는 장착되어 있어야 함
        const { data: sameCategoryItems } = await supabase
          .from("items")
          .select("id")
          .eq("category", "background");

        if (sameCategoryItems && sameCategoryItems.length > 0) {
          const { count } = await supabase
            .from("inventory")
            .select("item_id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("equipped", true)
            .in("item_id", sameCategoryItems.map((i: { id: string }) => i.id));
          if (count !== null && count <= 1) return; // 마지막 배경은 해제 불가
        }
      }

      await supabase
        .from("inventory")
        .update({ equipped })
        .eq("user_id", user.id)
        .eq("item_id", itemId);

      // 칭호 장착 시 profiles.title 업데이트
      if (equipped && targetItem?.category === "title") {
        await supabase.from("profiles").update({ title: targetItem.name }).eq("id", user.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-inventory"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("equipment-changed"));
      }
    },
  });
}

// ─── 통계 ────────────────────────────────────

export interface QuestStats {
  totalCleared: number;
  streakDays: number;
  todayExp: number;
  yesterdayExp: number;
  expChangePercent: number;
}

export function useQuestStats() {
  return useQuery<QuestStats>({
    queryKey: ["quest-stats"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return { totalCleared: 0, streakDays: 0, todayExp: 0, yesterdayExp: 0, expChangePercent: 0 };
      }

      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const today = kstNow.toISOString().slice(0, 10);
      const yesterday = new Date(kstNow.getTime() - 86400000).toISOString().slice(0, 10);

      const { count: totalCleared } = await supabase
        .from("schedule_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { data: todayLogs } = await supabase
        .from("schedule_logs")
        .select("exp_gained")
        .eq("user_id", user.id)
        .eq("target_date", today);

      const { data: yesterdayLogs } = await supabase
        .from("schedule_logs")
        .select("exp_gained")
        .eq("user_id", user.id)
        .eq("target_date", yesterday);

      const todayExp = (todayLogs ?? []).reduce((sum: number, l: { exp_gained: number }) => sum + (l.exp_gained ?? 0), 0);
      const yesterdayExp = (yesterdayLogs ?? []).reduce((sum: number, l: { exp_gained: number }) => sum + (l.exp_gained ?? 0), 0);
      const expChangePercent = yesterdayExp > 0 ? Math.round((todayExp / yesterdayExp) * 100) : todayExp > 0 ? 100 : 0;

      const { data: logDates } = await supabase
        .from("schedule_logs")
        .select("target_date")
        .eq("user_id", user.id)
        .order("target_date", { ascending: false });

      const uniqueDates = [...new Set((logDates ?? []).map((l: { target_date: string }) => l.target_date))].sort().reverse();
      let streak = 0;
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000);
      for (let i = 0; i < uniqueDates.length; i++) {
        const expected = new Date(kstToday.getTime() - i * 86400000).toISOString().slice(0, 10);
        if (uniqueDates[i] === expected) streak++;
        else break;
      }

      return { totalCleared: totalCleared ?? 0, streakDays: streak, todayExp, yesterdayExp, expChangePercent };
    },
    staleTime: 30_000,
  });
}
