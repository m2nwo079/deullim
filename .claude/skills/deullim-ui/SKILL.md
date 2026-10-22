---
name: deullim-ui
description: 들림의 web/app 화면, 공통 컴포넌트, Tailwind 스타일, 디자인 토큰(web/app/globals.css)을 만들거나 고칠 때 사용한다. 화면 문구를 쓰거나 위험도 표시, 버튼, 카드, 배지를 다룰 때도 사용한다.
---

# 들림 화면과 디자인

## 읽을 문서
- docs/design-principles.md: 방향, 화면별 적용, 피하는 것
- docs/design-tokens.md: 원시·의미·컴포넌트 토큰, 형태, 타이포그래피, 표면, 모션
- docs/components.md: 공통 컴포넌트 목록, 크기, 상태, 사용 규칙
- docs/lint-rules.md: L6, L7, L13 (색상과 간격 규칙)

## 규칙
- Tailwind 기본 색상표는 끄고 docs/design-tokens.md의 토큰만 쓴다. 토큰의 CSS 정의는 web/app/globals.css에 있다.
- 공통 컴포넌트 규칙은 docs/components.md를 따른다.
- 화면 코드에서는 공통 컴포넌트를 쓰고, 긴 클래스 나열은 공통 컴포넌트 안에 둔다.

## 절차
1. 위 문서를 읽고, 만들 화면이나 컴포넌트가 문서의 어느 항목에 해당하는지 확인한다.
   문서에 없는 공통 컴포넌트나 토큰이 필요하면 만들지 않고 묻는다.
2. 토큰 문서가 바뀌었으면 web/app/globals.css가 같은 값인지 먼저 대조한다.
3. 구현 후 lint와 build를 실행한다.

## 점검표
- [ ] hex 값, 임의 색상, Tailwind 기본 색, 8px 단위의 소수 배수를 쓰지 않았다 (lint L6, L7, L13).
- [ ] 위험도 표시, 공감 카드, 버튼 상태가 docs/design-tokens.md와 docs/components.md의 사용 규칙과 맞는다.
- [ ] 화면 문구는 한국어로 컴포넌트에 직접 썼고, 식별자·주석·로그·예외 메시지는 영어로 썼다 (CLAUDE.md 기술 스택).
- [ ] 화면 문구의 가운뎃점은 양옆을 띄웠다 (docs/design-principles.md 문구 규칙).
- [ ] 문장형 안내에 마침표를 찍었다 (docs/design-principles.md 문구 규칙).
- [ ] 화면 문구에 "법정 평가 완료", "조사 대체" 같은 표현이 없다 (CLAUDE.md 평가 원칙).
- [ ] 사용자가 Chrome에서 확인할 주소와 화면에 보여야 하는 것을 보고에 적었다.
