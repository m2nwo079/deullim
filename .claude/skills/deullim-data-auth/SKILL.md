---
name: deullim-data-auth
description: 들림의 DB 스키마, supabase/migrations의 마이그레이션, RLS 정책, 로그인과 인증, web/src/lib/supabase의 클라이언트, web/app의 Route Handler(api)를 만들거나 고칠 때 사용한다. Supabase 키나 환경 변수를 다룰 때도 사용한다.
---

# 들림 데이터, 인증, 서버 코드

## 읽을 문서
- docs/data-model.md: 테이블, 집계 뷰, 권한(RLS 요약), 미결정
- docs/auth.md: 사용자별 인증 방식, 권한 강제, 세션
- docs/deployment.md: 환경 변수, DB 변경 순서, 확인 필요
- docs/lint-rules.md: L4, L5 (secret key 참조 위치)

## 규칙
- Route Handler에서 secret key(SUPABASE_SECRET_KEY, RLS 우회)를 쓸 때는 요청한 사용자의 역할과 소속을 코드에서 직접 확인한다.
- 신규 Supabase 프로젝트는 Data API를 쓰려면 테이블별 Postgres 권한을 명시적으로 부여해야 한다.
- 무료 플랜은 7일간 활동이 없으면 프로젝트가 일시 정지된다. 발표 전에 접속해 상태를 확인한다.

## 절차
1. 테이블, 컬럼, 관계, 권한 정책을 바꿔야 하면 구현하지 않고 묻는다.
2. DB 변경은 docs/deployment.md의 "DB 변경" 절차를 따른다. 마이그레이션 적용은 사용자가 한다.
3. Route Handler는 클라이언트가 보낸 점수를 저장하지 않고, 관절 좌표로 서버에서 다시 계산한다
   (계산은 deullim-assessment의 src/core 함수를 쓴다).

## 점검표
- [ ] 새 테이블에 RLS를 켜고, docs/data-model.md의 권한 표대로 정책과 Postgres 권한을 두었다.
- [ ] 통증 신고 집계가 CLAUDE.md의 소규모 공정 규칙(5명 미만 합산, 역산 방지, 지연 반영)을 지킨다.
- [ ] secret key를 web/src/lib/supabase/admin.ts에서만 읽고, 클라이언트 코드와 커밋에 없다 (CLAUDE.md 보안 원칙, lint L4).
- [ ] admin.ts가 서버 전용인지 확인했다 (lint L5).
- [ ] 화면 분기만으로 권한을 처리한 곳이 없다.
