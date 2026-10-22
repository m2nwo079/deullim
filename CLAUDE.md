# 들림 (Deullim) 프로젝트 규칙

전역 규칙(~/.claude/CLAUDE.md)을 따르며, 이 파일은 프로젝트 고유 내용만 담는다.
전역 규칙과 충돌하면 전역 규칙의 "예외 없는 절대 금지" 항목이 항상 우선한다.
작업별 절차는 .claude/skills/의 해당 스킬을 따른다.

## 프로젝트 개요
- 서비스명: 들림 (Deullim)
- 캐치프레이즈: 매일 들던 무게가, 이제는 들리게
- 서브카피: 인간공학 평가와 수리 최적화로, 한정된 예산 안에서 가장 효과적인 작업 개선을 찾습니다
- 개발: 1인 개발

## 역할 분담
이 프로젝트에서는 전역 규칙의 기본 역할 분담을 아래로 대체한다.

- 사용자: 아키텍처 설계, 데이터 모델, 모듈 경계, API 계약, 기술 선택, 코드 리뷰, 최종 승인
- Claude Code: 사용자가 확정한 설계 문서(docs/) 범위 안에서 구현 코드와 테스트 코드를 작성한다

### Claude Code는 설계 결정을 하지 않는다
아래에 해당하면 구현을 멈추고 사용자에게 묻는다.
- 설계 문서에 없는 모듈, 디렉터리, 파일 구조가 필요할 때
- 데이터 모델(테이블, 컬럼, 관계, 권한 정책)을 바꿔야 할 때
- API 엔드포인트나 요청·응답 형식을 추가하거나 바꿔야 할 때
- 설계 문서가 모호하거나, 구현 중 설계의 결함을 발견했을 때
  (우회 구현으로 메우지 않고 문제를 보고한다)

## 사용자 역할과 화면
- worker (현장 작업자): "들림" 모바일 웹. QR 진입, 자세 촬영, 위험도 리포트, 익명 통증 신고, 개선 제안
- manager (안전보건관리자): "들림 콘솔". 공정 히트맵, 수시 조사 알림, 개선 시뮬레이션, 투자 최적화, 보고서 초안과 근거 자료
- partner (개선 설비 업체): "들림 파트너스". 개선 요청 확인, 견적 제출
- 시스템 응답 문구 톤: "들려요"를 기본 확인 문구로 사용한다

## 도메인 용어 (코드 식별자 매핑)
| 한국어 | 코드 식별자 |
|---|---|
| 사업장 | site |
| 공정 | workstation |
| 단위작업 | task |
| 자세 촬영 세션 | capture_session |
| 관절 좌표 | keypoints |
| 위험도 평가 | assessment (method: reba, rula) |
| 통증 신고 | pain_report |
| 개선 제안 | suggestion |
| 개선안 | improvement_option |
| 개선 계획 | improvement_plan |
| 수시 조사 | adhoc_survey |
| 견적 | quote |

새 도메인 용어가 필요하면 임의로 정하지 않고 사용자에게 묻는다.

## 기술 스택
- 프론트엔드: Next.js (App Router), TypeScript strict 모드, Tailwind CSS. 세부 규칙은 deullim-ui 스킬
  - 개발 서버는 평소 localhost로만 연다. 실기기 테스트가 필요할 때만 사용자 승인 후 외부에 연다.
  - 검사 강제: GitHub Actions의 PR 검사(린트, 타입 검사, 테스트, 빌드)만 쓴다. git hook은 쓰지 않는다. 배포는 Vercel이 맡는다.
  - 화면에 보이는 한국어 문구는 이 프로젝트에 한해 컴포넌트에 직접 쓴다.
    식별자, 주석, 로그, 예외 메시지는 전역 규칙대로 영어로 쓴다.
- 자세 추정: MediaPipe Tasks Vision (Pose Landmarker), 브라우저에서만 실행
  - 카메라와 MediaPipe 코드는 클라이언트 컴포넌트에서만 실행한다. 서버 렌더링에서 불러오지 않는다.
  - 모델 종류(lite, full, heavy)와 실행 방식(GPU, CPU)은 TBD. 실기기 테스트 후 정한다.
  - 카메라 접근은 HTTPS 또는 localhost에서만 동작한다. iPhone 실기기 테스트는 HTTPS 환경에서 한다.
  - MediaPipe에 넣는 영상은 좌우반전하지 않는다. 거울 모드가 필요하면 화면의 영상과 점 레이어만 함께 뒤집는다.
    (좌우는 작업자 본인 기준이며 AI Hub 라벨과 같다. 스파이크에서 확인함)
- 백엔드 / DB / 인증: Supabase (Postgres, Auth, Row Level Security, Realtime). 세부 규칙은 deullim-data-auth 스킬
  - 서버 코드 위치: Next.js Route Handler. Supabase Edge Function은 쓰지 않는다.
- 최적화: 다중 선택 배낭 문제를 TypeScript 동적계획법으로 직접 구현한다. 외부 솔버는 쓰지 않는다.
- 배포: Vercel Hobby (비상업적 용도로만 사용)
- 무료 티어 안에서만 운영한다.

## 디렉터리 구조
```
deullim/
├── web/              Next.js 앱. npm 명령은 이 폴더에서 실행한다
│   ├── app/          라우트 (worker, console, partners 화면과 api)
│   ├── src/core/     순수 TypeScript: 각도, 점수 산정, 필터, DP 최적화
│   ├── src/features/ 화면별 컴포넌트와 로직
│   ├── src/lib/      Supabase 클라이언트 등
│   └── public/
├── supabase/         DB 마이그레이션, RLS 정책
├── tests/fixtures/   합성 테스트 벡터 (Python과 TypeScript가 함께 읽는다)
├── analysis/         Python 분석 도구 (서비스와 독립)
├── docs/
└── data/             원본 데이터 (커밋하지 않음)
```
- Vercel 프로젝트의 Root Directory는 web으로 지정한다.
- web/src/core/에서는 React, Next.js, Supabase를 import하지 않는다. 브라우저와 Route Handler가 함께 쓴다.
- 테스트 파일은 대상 파일 옆에 둔다 (예: src/core/angle.ts → src/core/angle.test.ts).
- tests/fixtures/에는 합성 데이터만 둔다. AI Hub 데이터나 실제 작업 영상에서 나온 값은 넣지 않는다.
- 라우트의 구체적인 URL 설계는 TBD.

## 보안과 개인정보 원칙
- 촬영 영상과 프레임 이미지는 서버로 전송하거나 저장하지 않는다. 브라우저에서 관절 좌표만 추출한다.
- 서버는 관절 좌표를 받아 위험도 점수를 다시 계산해 저장한다. 클라이언트가 보낸 점수를 그대로 신뢰하지 않는다.
- 통증 신고는 개인을 식별하지 않으며 공정 단위로만 집계한다.
  - 인원이 5명 미만인 공정은 단독으로 노출하지 않고 상위 단위로 합산한다.
  - 차감으로 역산되지 않도록, 합산 대상 공정이 생기면 같은 상위 단위의 다른 공정을 하나 이상 함께 묶는다.
  - 5명 미만 공정의 신고는 실시간으로 반영하지 않고 모아서 지연 반영한다.
- 역할별 접근 권한은 서버(DB 정책)에서 강제한다. 프론트엔드 화면 분기만으로 권한을 처리하지 않는다.
- secret key(SUPABASE_SECRET_KEY)는 서버 환경 변수에만 두고 web/src/lib/supabase/admin.ts에서만 읽는다.
  클라이언트 코드와 커밋에 포함하지 않는다.
- 개발과 검증에 쓰는 실제 작업 영상은 data/ 아래에만 두며 커밋하지 않는다.

## 평가와 최적화 원칙
- 들림은 상시 선별 도구이자 정밀 조사 대상 추천 도구이며, 법정 유해요인조사를 대체하지 않는다.
  화면 문구, 보고서 템플릿, 출력 문자열에 "법정 평가 완료", "조사 대체" 같은 표현을 쓰지 않는다.
- 보고서 기능은 보고서 초안과 근거 자료를 생성하며, 최종 조사와 근로자 참여는 사업장이 수행한다.
- 자세 평가는 docs/assessment-rules.md의 규칙만 따른다. 임의로 가중치나 구간을 바꾸지 않는다.
- 최적화 모델의 목적함수와 제약은 docs/optimization-model.md를 기준으로 한다.
- 수작업 평가 대조 파일(validation/)의 판정 값은 사용자가 채운다.

## 주요 명령어
web/ 폴더에서 실행한다. Node는 24.x(web/.nvmrc)이며, 로컬 Node가 다르면 npm install 때 EBADENGINE 경고가 난다.
- npm run dev: 개발 서버 (localhost만, http://localhost:3000)
- npm run build: 프로덕션 빌드
- npm run lint: ESLint (docs/lint-rules.md L1~L13)
- npm run typecheck: tsc --noEmit
- npm run test: Vitest 단위 테스트
- npm run format / npm run format:check: Prettier 적용 / 검사
- 작업 보고 전: npm run lint && npm run typecheck && npm run test

## 문서 목록 (필요할 때 읽는다)
- 디자인: docs/design-principles.md, docs/design-tokens.md, docs/components.md
- 평가와 최적화: docs/assessment-rules.md, docs/optimization-model.md, docs/aihub-label-codes.md
- 데이터와 인증: docs/data-model.md, docs/auth.md
- 배포와 린트: docs/deployment.md, docs/lint-rules.md

## 브랜치와 커밋 규칙
@docs/git-workflow.md
