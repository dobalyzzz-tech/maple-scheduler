# 🍁 메이플 도트 스케줄러 — 조립 가이드

붙여넣기만 하면 동작하는 파일 모음입니다. 순서대로 적용하세요.

## 0. 프로젝트 생성
```bash
npx create-next-app@latest maple-scheduler --ts --tailwind --app
cd maple-scheduler
npm i @supabase/supabase-js zustand @tanstack/react-query framer-motion rrule howler
```

## 1. Supabase
- Dashboard > SQL Editor 에 `supabase_schema.sql` 붙여넣고 실행
- 이어서 `exp_complete_rpc.sql` 실행
- Authentication > Providers > Google 활성화 (Client ID/Secret 입력)

## 2. 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. 파일 배치
| 파일 | 위치 |
|---|---|
| tailwind.config.ts | 루트 (덮어쓰기) |
| globals.css | app/globals.css 에 내용 추가 |
| copy.json | 루트 |
| lib_supabaseClient.ts | lib/supabaseClient.ts |
| lib_recurrence.ts | lib/recurrence.ts |
| store_useCharacterStore.ts | store/useCharacterStore.ts |
| components_LevelUpModal.tsx | components/LevelUpModal.tsx |
| components_CompleteButton.tsx | components/CompleteButton.tsx |

## 4. 핵심 루프 확인
로그인 → 일정 등록 → CompleteButton 클릭 → +EXP 팝 → 레벨업 시 LevelUpModal.
이 단일 루프가 가장 먼저 완성되어야 합니다(완료 쾌감 = 성공 열쇠).

## 5. 기획 문서
01~05 .md 파일은 노션/문서에 그대로 붙여넣어 사용.
