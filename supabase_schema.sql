-- ============================================================
-- 메이플 도트 스케줄러 : Supabase 전체 스키마
-- Supabase Dashboard > SQL Editor 에 그대로 붙여넣어 실행
-- ============================================================

-- 1) profiles : 캐릭터/유저
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  nickname      text not null default '새내기 모험가',
  level         int  not null default 1,
  exp           int  not null default 0,
  coins         int  not null default 0,
  title         text default '초보 모험가',
  avatar_config jsonb default '{}'::jsonb,
  streak_days   int  not null default 0,
  last_login    date,
  created_at    timestamptz not null default now()
);

-- 2) schedules : 일정(퀘스트)
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  memo         text,
  difficulty   int  not null default 1 check (difficulty between 1 and 3),
  start_at     timestamptz not null,
  is_recurring boolean not null default false,
  recur_rule   text,                       -- RRULE: FREQ=WEEKLY;BYDAY=MO,WE
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_schedules_user on public.schedules(user_id, start_at);

-- 3) schedule_logs : 반복 일정 날짜별 완료 이력
create table if not exists public.schedule_logs (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  target_date  date not null,
  completed    boolean not null default true,
  exp_gained   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (schedule_id, target_date)         -- 중복 완료 방지(idempotency)
);
create index if not exists idx_logs_user on public.schedule_logs(user_id, target_date);

-- 4) friendships : 친구 관계
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  unique (requester, addressee)
);

-- 5) co_quests : 협동/경쟁 퀘스트
create table if not exists public.co_quests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  goal_count    int  not null,
  current_count int  not null default 0,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);
create table if not exists public.co_quest_members (
  quest_id     uuid references public.co_quests(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  contribution int not null default 0,
  primary key (quest_id, user_id)
);

-- 6) achievements / items / inventory
create table if not exists public.achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_code)
);
create table if not exists public.items (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  category  text not null,            -- avatar / theme / title
  price     int  not null default 0,
  asset_url text
);
create table if not exists public.inventory (
  user_id  uuid references public.profiles(id) on delete cascade,
  item_id  uuid references public.items(id) on delete cascade,
  equipped boolean not null default false,
  primary key (user_id, item_id)
);

-- ============================================================
-- 가입 시 profiles 자동 생성 트리거
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '새내기 모험가'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS 정책
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.schedules      enable row level security;
alter table public.schedule_logs  enable row level security;
alter table public.friendships    enable row level security;
alter table public.achievements   enable row level security;
alter table public.inventory      enable row level security;

create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create policy "own schedules" on public.schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own logs" on public.schedule_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own friendship" on public.friendships
  for all using (auth.uid() = requester or auth.uid() = addressee);

create policy "own achievements" on public.achievements
  for select using (auth.uid() = user_id);

create policy "own inventory" on public.inventory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- EXP/coins 는 클라가 직접 update 못 하도록 위 own profile update 정책에서
-- 컬럼 제한을 두거나, 아래 RPC(SECURITY DEFINER)로만 변경하도록 운영.
