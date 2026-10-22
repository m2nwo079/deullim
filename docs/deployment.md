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
  - MediaPipe WASM과 모델 파일을 불러오는 방식(CDN 또는 자체 호스팅)이 발표장 네트워크에서 동작하는지
  - 시연 전 과정을 녹화한 백업 영상

## 확인 필요
- Vercel Hobby의 미리보기 배포 제공 조건
- GitHub Actions의 비공개 레포 무료 사용량
- Pretendard 글꼴 중복: web/public/fonts/pretendard의 CSS를 layout에서 import하면 woff2가 _next/static/media에 따로 번들되어 public 복사본은 실행 중 쓰이지 않는다
