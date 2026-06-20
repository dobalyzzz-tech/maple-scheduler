"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { supabase } from "@/lib/supabaseClient";
import {
  useFriends,
  useFriendRequests,
  useSearchProfiles,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRemoveFriend,
  useRejectFriendRequest,
  useCoQuests,
  useCreateCoQuest,
  usePendingCoQuestInvites,
  useAcceptCoQuestInvite,
  useRejectCoQuestInvite,
  useLeaveCoQuest,
} from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import CreateCoQuestModal from "@/components/CreateCoQuestModal";

export default function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests, isLoading: reqLoading } = useFriendRequests();
  const { data: coQuests, isLoading: coLoading } = useCoQuests();
  const { data: pendingInvites } = usePendingCoQuestInvites();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();
  const rejectRequest = useRejectFriendRequest();
  const createCoQuest = useCreateCoQuest();
  const acceptInvite = useAcceptCoQuestInvite();
  const rejectInvite = useRejectCoQuestInvite();
  const leaveCoQuest = useLeaveCoQuest();

  const [friendCode, setFriendCode] = useState("");
  const [myFriendCode, setMyFriendCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const { data: searchResults } = useSearchProfiles(friendCode);
  const [showNewCoQuest, setShowNewCoQuest] = useState(false);
  const [coTitle, setCoTitle] = useState("");
  const [coGoal, setCoGoal] = useState(10);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("friend_code")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.friend_code) setMyFriendCode(data.friend_code);
      });
  }, [user]);

  // 파티 퀘스트 업데이트 이벤트 수신
  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["co-quests"] });
    window.addEventListener("co-quest-updated", handler);
    return () => window.removeEventListener("co-quest-updated", handler);
  }, [qc]);

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col px-3 pt-0 pb-2 gap-1.5 max-w-4xl mx-auto w-full">
      {/* 내 친구코드 */}
      {myFriendCode && (
        <div className="rounded-2xl px-6 py-4 text-center bg-[#EEEEEE] border border-[#D1D4D6]">
          <span className="font-pixel text-xs text-border/70">내 친구코드</span>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="font-pixel text-lg text-maple tracking-widest">{myFriendCode}</span>
            <button
              className="pixel-btn px-3 py-1.5 text-[10px]"
              onClick={() => {
                navigator.clipboard.writeText(myFriendCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
            >
              {codeCopied ? "복사됨!" : "복사"}
            </button>
          </div>
        </div>
      )}

      {/* 친구 검색 (친구코드) */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6]">
        <h2 className="font-pixel text-sm text-border mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          친구코드로 검색</h2>
        <input
          className="w-full border border-[#D1D4D6] rounded-xl px-4 py-3 font-pixel text-xs text-border outline-none focus:border-maple/50 transition-colors mb-3 uppercase tracking-widest"
          placeholder="친구코드 6자리 입력"
          value={friendCode}
          maxLength={6}
          onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
        />
        {searchResults && searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults
              .filter((p) => p.id !== user.id)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-[#D1D4D6] rounded-xl">
                  <span className="font-pixel text-xs text-border">
                    {p.nickname} Lv.{p.level}
                    {p.friend_code && <span className="text-border/40 ml-2 text-[10px]">({p.friend_code})</span>}
                  </span>
                  <button
                    className="pixel-btn px-3 py-1.5 text-[10px]"
                    onClick={() => sendRequest.mutate(p.id)}
                    disabled={sendRequest.isPending}
                  >
                    친구 신청
                  </button>
                </div>
              ))}
          </div>
        )}
        {friendCode.length === 6 && searchResults?.length === 0 && (
          <div className="text-border/40 font-pixel text-xs text-center py-4">
            해당 친구코드의 모험가가 없어요
          </div>
        )}
      </div>

      {/* 받은 친구 요청 */}
      {requests && requests.length > 0 && (
        <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border-2 border-maple/50">
          <h2 className="font-pixel text-sm text-maple mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            받은 친구 요청</h2>
          <div className="flex flex-col gap-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-4 py-3 bg-[#D1D4D6] rounded-xl">
                <span className="font-pixel text-xs text-border">{req.nickname} Lv.{req.level}</span>
                <div className="flex gap-2">
                  <button className="pixel-btn px-3 py-1.5 text-[10px] bg-success text-white" onClick={() => acceptRequest.mutate(req.id)} disabled={acceptRequest.isPending}>수락</button>
                  <button className="pixel-btn px-3 py-1.5 text-[10px] bg-danger text-white" onClick={() => rejectRequest.mutate(req.id)} disabled={rejectRequest.isPending}>거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 받은 파티 퀘스트 초대 */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border-2 border-maple/50">
          <h2 className="font-pixel text-sm text-maple mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            파티 퀘스트 초대</h2>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <div key={inv.quest_id} className="flex items-center justify-between px-4 py-3 bg-[#D1D4D6] rounded-xl">
                <div>
                  <div className="font-pixel text-xs text-border">{inv.quest_title}</div>
                  <div className="font-pixel text-[10px] text-border/50">from {inv.creator_nickname}</div>
                </div>
                <div className="flex gap-2">
                  <button className="pixel-btn px-3 py-1.5 text-[10px] bg-success text-white" onClick={() => acceptInvite.mutate(inv.quest_id)} disabled={acceptInvite.isPending}>수락</button>
                  <button className="pixel-btn px-3 py-1.5 text-[10px] bg-danger text-white" onClick={() => rejectInvite.mutate(inv.quest_id)} disabled={rejectInvite.isPending}>거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 내 친구 목록 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6]">
        <h2 className="font-pixel text-sm text-border mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          내 친구 ({friends?.length ?? 0})</h2>
        {friendsLoading ? (
          <div className="text-border/40 font-pixel text-xs text-center py-4">불러오는 중...</div>
        ) : !friends || friends.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-4">아직 친구가 없어요. 친구코드를 공유하고 모험가를 찾아보세요!</div>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 bg-[#D1D4D6] rounded-xl">
                <span className="font-pixel text-xs text-border">
                  {f.nickname} Lv.{f.level}
                  {f.title && <span className="text-border/50 ml-2 text-[10px]">{f.title}</span>}
                </span>
                <button className="pixel-btn px-3 py-1.5 text-[10px] bg-danger text-white" onClick={() => removeFriend.mutate(f.id)}>삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 파티 퀘스트 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6] mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-sm text-border">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            파티 퀘스트</h2>
          <button className="pixel-btn px-3 py-1.5 text-xs" onClick={() => setShowNewCoQuest(true)}>＋ 생성</button>
        </div>

        {coLoading ? (
          <div className="text-border/40 font-pixel text-xs text-center py-4">불러오는 중...</div>
        ) : !coQuests || coQuests.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-4">진행 중인 파티 퀘스트가 없어요. 친구와 함께 도전해보세요!</div>
        ) : (
          <div className="flex flex-col gap-3">
            {coQuests.map((q) => {
              const pct = Math.min((q.current_count / q.goal_count) * 100, 100);
              const doneCount = q.members.filter((m) => m.done).length;
              const donePct = q.members.length > 0 ? Math.round((doneCount / q.members.length) * 100) : 0;
              const myId = user.id;
              const isCreator = q.members.some((m) => m.user_id === myId);
              return (
                <div key={q.id} className="rounded-2xl px-4 py-3 bg-[#D1D4D6] border border-[#D1D4D6]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-pixel text-xs text-border">{q.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-[10px] text-maple">{doneCount}/{q.members.length}</span>
                      <button
                        className="pixel-btn px-2 py-1 text-[8px] bg-danger text-white"
                        onClick={() => leaveCoQuest.mutate(q.id)}
                        disabled={leaveCoQuest.isPending}
                        title="탈퇴"
                      >
                        탈퇴
                      </button>
                    </div>
                  </div>
                  <div className="exp-bar w-full mb-2">
                    <div className="exp-fill" style={{ width: `${donePct}%`, backgroundColor: "#38bdf8" }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.members.map((m) => (
                      <span key={m.user_id} className={`font-pixel text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 ${m.done ? "text-white" : "bg-parchment text-border/60"}`} style={m.done ? { backgroundColor: "#38bdf8" } : {}}>
                        {m.nickname}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateCoQuestModal
        open={showNewCoQuest}
        onClose={() => setShowNewCoQuest(false)}
        friends={(friends ?? []).filter((f) => f.id !== user.id).map((f) => ({ id: f.id, nickname: f.nickname }))}
      />
    </div>
  );
}
