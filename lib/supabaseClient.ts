// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 구글 로그인
export async function signInWithGoogle() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || location.origin;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
}

// 로그아웃
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

// 일정 완료 (서버 RPC 호출 — EXP/레벨업 결과 반환)
export async function completeSchedule(scheduleId: string, targetDate?: string) {
  const { data, error } = await supabase.rpc("complete_schedule", {
    p_schedule_id: scheduleId,
    p_target_date: targetDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as {
    status: string; exp_gain: number; coin_gain: number;
    level: number; exp: number; leveled_up: boolean;
  };
}
