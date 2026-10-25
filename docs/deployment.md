# 배포 파이프라인 (v1)

## 흐름
```
기능 브랜치 push ─→ GitHub Actions PR 검사 (린트, 타입 검사, 테스트, 빌드)
                 └→ Vercel 미리보기 배포 (HTTPS 주소)
                         │
                    PR 리뷰 후 머지 커밋으로 병합
                         ↓
main ─→ Vercel 운영 배포 (Root Directory: web)
```

- GitHub Actions는 검사만 한다. 배포는 Vercel의 GitHub 연동이 맡는다.
- git hook은 쓰지 않는다.

## 환경
| 환경 | 프론트엔드 | Supabase 프로젝트 | 용도 |
|---|---|---|---|
| 로컬 | next dev (localhost만) | 개발 프로젝트 | 개발 |
| 미리보기 | Vercel Preview | 개발 프로젝트 | 기능 브랜치 확인, iPhone 카메라 테스트 |
| 운영 | Vercel Production | 운영 프로젝트 | 제출본, 시연 |

- Supabase 무료 플랜의 프로젝트 2개를 개발용과 운영용으로 나눠 쓴다.
- 미리보기 주소가 HTTPS이므로 iPhone 카메라 테스트는 미리보기 배포로 한다.

## 환경 변수
| 이름 | 노출 범위 | 위치 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 클라이언트 | Vercel, 로컬 .env.local |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 클라이언트 | Vercel, 로컬 .env.local |
| SUPABASE_SECRET_KEY | 서버 전용 (RLS 우회) | Vercel 서버 환경 변수, 로컬 .env.local |
| NEXT_TELEMETRY_DISABLED=1 | 빌드 | Vercel, 로컬 |

- Supabase 키는 publishable key와 secret key를 쓴다. anon, service_role 키는 legacy이며 2026년 말까지 폐기 예정이다
  (https://supabase.com/docs/guides/api/api-keys, 2026-10-22 확인). secret key는 service_role 역할로 동작해 RLS를 우회한다.
- .env.local은 .gitignore의 `.env.*`에 포함되어 커밋되지 않는다. 필요한 변수 이름은 .env.example에 값 없이 적는다.
- QR의 사이트 주소는 Vercel 시스템 환경 변수로 정한다. VERCEL_ENV가 production이면 VERCEL_PROJECT_PRODUCTION_URL,
  preview이면 VERCEL_URL, 그 밖(로컬)이면 http://localhost:3000. "Enable access to System Environment Variables"가 켜져 있어야 한다.

## MediaPipe 파일
- WASM과 자세 모델은 같은 사이트의 /mediapipe/에서 제공한다. 시연 때 외부 CDN에 기대지 않기 위해서다.
- web/scripts/fetch-mediapipe.mjs가 npm run dev와 npm run build 전에 실행된다(predev, prebuild).
  - WASM 4개(SIMD, SIMD 미지원 각 .js와 .wasm)는 설치된 @mediapipe/tasks-vision에서 복사한다.
  - 모델은 버전이 고정된 주소에서 받아 SHA-256을 대조하고, 다르면 빌드를 실패시킨다. 빌드할 때만 Google 저장소에 접속한다.
  - 결과는 web/public/mediapipe/에 생기며 커밋하지 않는다(.gitignore). 모델 종류와 실행 방식은 web/src/features/capture/pose-model.json 한 곳에서 바꾼다.

## DB 변경
- 변경은 supabase/migrations/의 SQL 파일로만 한다.
- 적용 순서: 개발 프로젝트 → 확인 → 운영 프로젝트.
- 적용은 사용자가 Supabase SQL 편집기 또는 Supabase CLI로 한다. 인증 CLI의 출력은 Claude Code가 보지 않는다 (전역 규칙).

## PR 검사 (GitHub Actions)
- 실행: 린트, 타입 검사, 단위 테스트, 빌드 (web/ 기준)
- 테스트 데이터는 합성 데이터만 쓴다. AI Hub 데이터는 CI에서 쓰지 않는다.
- 비공개 레포의 무료 사용량 한도는 확인하지 않았다. 확인 후 이 문서에 적는다.

## 제출과 시연
- 2026-11-18 제출 시점의 main에 v1.0.0 태그를 남긴다. 태그는 사용자가 만든다.
- 발표 전날 확인 목록
  - Supabase 운영 프로젝트가 일시 정지되지 않았는지 (7일 미사용 시 정지)
  - 시연용 계정으로 로그인되는지
  - 운영 주소에서 iPhone 카메라와 자세 추정이 동작하는지
  - 운영 주소에서 /mediapipe/ 아래 WASM과 모델 파일이 받아지는지 (같은 주소에서 제공하므로 외부 CDN은 쓰지 않는다)
  - 시연 전 과정을 녹화한 백업 영상

## 시연 데이터
- 파일: supabase/demo-data.sql(넣기), supabase/demo-cleanup.sql(지우기), supabase/verify.sql 14번·18번 블록(확인).
  모든 시연 데이터는 합성 사업장 하나(이름은 tests/fixtures/demo_data_v1.json의 site_name, 지금 "시연 공장")에 넣고, 지울 때는 그 사업장을 지워 아래 표를 모두 cascade로 지운다.
  가상 설비 업체 3곳("(가상)"이 붙은 이름)은 사업장 아래가 아니라서 이름으로 따로 지운다. seed.sql의 "합성 설비 업체"는 지우지 않는다.
- 관리자는 합성 제1공장의 manager를 그대로 시연 사업장 멤버로 넣는다. 복사할 manager가 없으면 멈춘다. 이미 넣었으면 멈춘다(다시 넣으려면 먼저 지운다).
- 내용은 tests/fixtures/demo_data_v1.json(합성 자세 조합, 관리자 입력, 개선안)에서 온다. AI Hub 데이터나 실제 영상 값은 쓰지 않는다.
  - 평가 값, 공정·단위작업·개선안 INSERT, 수시 조사 기한 대응표, 사업장 이름은 테스트가 생성한다(web/src/core/demo-data.test.ts, web/src/features/adhoc-surveys/demo-due-dates.test.ts).
  - fixture를 바꾼 뒤 web/에서 `DEMO_SQL_WRITE=1 npx vitest run demo --no-file-parallelism`으로 생성 부분을 다시 쓴다. 평소 테스트는 SQL이 fixture와 다르면 실패한다.
  - 기한 대응표는 발생일 2026-06-01~2028-02-29 범위다. 이 범위를 벗어난 날에 넣으면 멈춘다.
  - 2차 내용은 tests/fixtures/demo_extra_v1.json에서 온다. 시연 촬영 3건(리프트 테이블, 작업대 높이 조절, 보조 롤러. 합성 자세를 실제 계산 경로로 채점해 manual 값을 바꿈), 가상 업체 3곳, 견적 요청 4건(초안, 공개 견적 4건, 수락으로 마감, 수락 없이 마감)이다.
    합성 설비 업체도 견적을 내서, 파트너 계정 화면에 제출, 수락(보조 롤러 110만 원), 미선정 견적이 하나씩 보인다. 수락된 견적은 보조 롤러 비용을 110만 원으로 바꾼다.
- 시각은 넣는 시점(now(), 오늘 Asia/Seoul) 기준이다. 넣은 날이 지날수록 기한 알림, 최근 4주 권고, 이번 주 신고가 달라지므로 발표 당일에 다시 넣는다.
- 저장 계획은 SQL로 넣지 않는다. 넣은 뒤 콘솔 개선 계획 화면에서 예산 500만 원(총비용 490만 원, 감소 27.36)과 1,000만 원(940만 원, 34.52)으로 계산해 저장한다. 이 값은 demo-data.test.ts가 fixture로 확인한다.
- 처음 넣는 순서: 마이그레이션 → seed.sql → seed-tasks.sql → link-accounts.sql → demo-data.sql → verify.sql 14번·18번 블록 → 계획 2건 저장 → 시연 공정 QR 발급.
- 발표 절차 (2026-11-23 월요일)
  - 전날: 운영 Supabase 프로젝트에 접속해 일시 정지되지 않았는지 확인한다(무료 플랜은 7일 활동이 없으면 정지). 시연 계정으로 로그인해 본다.
  - 당일 09:00 이후(KST): demo-cleanup.sql → demo-data.sql → verify.sql 14번·18번 블록 → 계획 2건 저장 → QR 관리에서 시연 공정 QR 재발급·인쇄(지우기로 토큰도 지워진다).
  - 견적 수락과 시연 촬영은 되돌릴 수 없다. 리허설을 했으면 발표 전에 위 순서로 다시 넣는다.
  - 시연 순서(약 3분 30초)
    1. 개요(20초): 맨 위의 수시 조사 기한 알림과 검토 권고(용접 1라인, 물류 묶음), 요약 줄의 매우 높음 공정 2곳(첫 공정 이름은 그 공정 상세로 가는 링크), 위험 단계가 높은 공정부터 놓인 공정 표.
    2. 견적 요청 → 자동 용접 지그(45초): 견적 4건 비교 → 표의 선택 열에서 가람설비(가상) 450만 원 견적을 고르고 "선택한 견적 수락" → 확인 창의 "가람설비(가상) 견적 수락" → 개선안 비용이 "견적가"로 바뀐 것.
    3. 개선 계획 1,000만 원(45초): 계산하면 회전 거치대가 더해져 990만 원, 감소 37.11. 결과 아래 "저장된 계획과 비교"에서 저장한 1,000만 원 계획(940만 원, 34.52)을 고르면 총비용·감소량 차이와 함께 회전 거치대가 "+ 추가", 자동 용접 지그가 "바뀜"(견적가)으로 맨 위에 보인다. 근거 표시에 시연 촬영값과 관리자 추정값이 섞인 것을 보여 준 뒤 주요 버튼 "이 계획 저장"을 누른다.
    4. 보고서 초안(30초): "함께 넣을 개선 계획" 선택에서 방금 저장한 계획을 골라 근거 표시와 시연 촬영 한계 문장을 보여 준다.
    5. 시연 촬영(70초, 마지막): 개선안 → 조립 A라인 → 공구 밸런서 "시연 촬영" QR → iPhone으로 30초 촬영 → 결과 화면 → 콘솔 개선안 화면의 "(시연 촬영 1)" 표시만 보여 준다. 계획은 다시 계산하지 않는다(결과를 미리 알 수 없다).
  - 실패했을 때: 수락이 안 되면 보조 롤러의 "견적가 · 합성 설비 업체"를 보여 주고, 개선 계획에서 1,000만 원으로 계산한 뒤 비교 대상을 저장된 500만 원 계획으로 바꿔 추가된 개선안과 차이로 설명한다. 비교 절에 "저장된 계획이 없어"가 보이면 계획 2건 저장을 빠뜨린 것이다. 촬영이 안 되면 작업대 높이 조절의 수정 화면("시연 촬영 · 날짜")을 보여 준다. 네트워크가 안 되면 리허설 때 녹화한 영상을 쓴다.
  - 월요일이라 이번 주는 당일 0시부터다. 1~6시간 전 신고가 이번 주 신고로 보이도록 09:00 이후에 넣는다.
  - 물류 묶음의 신고는 24시간 뒤 반영이라, 당일 넣은 데이터에서는 이번 주 수가 0이다. 최근 4주 권고에는 25시간 이전 신고가 들어가 영향이 없다.

## 확인 필요
- Vercel Hobby의 미리보기 배포 제공 조건
- GitHub Actions의 비공개 레포 무료 사용량
- Pretendard 글꼴 중복: web/public/fonts/pretendard의 CSS를 layout에서 import하면 woff2가 _next/static/media에 따로 번들되어 public 복사본은 실행 중 쓰이지 않는다
