-- ============================================================
-- 일정 완료 + EXP 산정 서버 RPC (조작 방지: SECURITY DEFINER)
-- 클라에서 supabase.rpc('complete_schedule', { p_schedule_id, p_target_date })
-- ============================================================
create or replace function public.complete_schedule(
  p_schedule_id uuid,
  p_target_date date default current_date
)
returns json
language plpgsql security definer as $$
declare
  v_uid        uuid := auth.uid();
  v_diff       int;
  v_exp_gain   int;
  v_coin_gain  int;
  v_level      int;
  v_exp        int;
  v_need       int;
  v_leveled    boolean := false;
begin
  -- 본인 일정인지 + 난이도 확인
  select difficulty into v_diff
  from public.schedules
  where id = p_schedule_id and user_id = v_uid;
  if v_diff is null then
    raise exception 'schedule not found or not owned';
  end if;

  -- 보상 계산
  v_exp_gain  := 20 + v_diff * 30;   -- 난이도1:50, 2:80, 3:110
  v_coin_gain := 5  + v_diff * 5;

  -- idempotent: 이미 완료된 날짜면 중복 가산 막기
  insert into public.schedule_logs (schedule_id, user_id, target_date, completed, exp_gained)
  values (p_schedule_id, v_uid, p_target_date, true, v_exp_gain)
  on conflict (schedule_id, target_date) do nothing;
  if not found then
    return json_build_object('status','already_completed');
  end if;

  -- 일회성 일정이면 completed 플래그도 갱신
  update public.schedules
  set completed = true, completed_at = now()
  where id = p_schedule_id and is_recurring = false;

  -- EXP/coin 반영
  update public.profiles
  set exp = exp + v_exp_gain, coins = coins + v_coin_gain
  where id = v_uid
  returning level, exp into v_level, v_exp;

  -- 레벨업 루프 (임계치 = level * 100)
  loop
    v_need := v_level * 100;
    exit when v_exp < v_need;
    v_exp   := v_exp - v_need;
    v_level := v_level + 1;
    v_leveled := true;
  end loop;

  update public.profiles set level = v_level, exp = v_exp where id = v_uid;

  return json_build_object(
    'status','ok',
    'exp_gain', v_exp_gain,
    'coin_gain', v_coin_gain,
    'level', v_level,
    'exp', v_exp,
    'leveled_up', v_leveled
  );
end; $$;
