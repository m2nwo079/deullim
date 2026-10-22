# 들림 디자인 토큰 (초안 v2, 라이트 모드)

## 원칙
- 토큰은 세 층으로 둔다: 원시(primitive) → 의미(semantic) → 컴포넌트(component).
- 컴포넌트 코드에서는 원시 토큰이나 hex 값을 직접 쓰지 않는다. 의미 토큰 또는 컴포넌트 토큰만 쓴다.
- 위험도 색은 위험도 정보에만 쓴다. 브랜드 요소, 장식, 일반 상태 표시에 쓰지 않는다.
- 색만으로 정보를 전달하지 않는다. 위험도에는 항상 텍스트 라벨(낮음, 주의, 높음, 매우 높음)이나 아이콘을 함께 쓴다.
- 대비 기준(WCAG 2.x AA): 본문 글자 4.5:1 이상, 큰 글자와 UI 요소 3:1 이상.
- 아래 대비 값은 모두 실제로 계산한 값이다(흰 배경 #FFFFFF 기준, 따로 적은 경우 제외).

## 1. 원시 토큰

### 1.1 브랜드 (hue shift 단계 색상)
밝을수록 페리윙클 쪽, 어두울수록 작업복 인디고 쪽으로 색조가 이동한다. OKLCH로 명도가 고르게 이어지게 계산했다.

| 토큰 | 값 | OKLCH | 흰 배경 대비 | 비고 |
|---|---|---|---|---|
| brand-50 | #F6F6FD | 0.975 0.010 286 | 1.08 | |
| brand-100 | #EDEDFB | 0.950 0.018 285 | 1.16 | |
| brand-200 | #D8D9F7 | 0.895 0.040 284 | 1.38 | |
| brand-300 | #B6B8ED | 0.800 0.075 283 | 1.90 | |
| brand-400 | #888AD1 | 0.660 0.105 282 | 3.18 | 글자 금지, 아이콘·큰 글자만 |
| brand-500 | #6567AE | 0.545 0.110 281 | 5.12 | 페리 |
| brand-600 | #46519C | 0.465 0.120 274 | 7.20 | 웜 울트라마린 |
| brand-700 | #314B81 | 0.420 0.095 263 | 8.56 | 작업복 인디고 |
| brand-800 | #23375C | 0.340 0.070 262 | 11.85 | |
| brand-900 | #19263F | 0.270 0.050 263 | 15.10 | |

### 1.2 따뜻한 회색
| 토큰 | 값 | 흰 배경 대비 | 비고 |
|---|---|---|---|
| gray-0 | #FFFFFF | 1.00 | |
| gray-50 | #F6F5F2 | 1.09 | |
| gray-100 | #EEEDE8 | 1.17 | |
| gray-200 | #E4E1DA | 1.31 | |
| gray-300 | #D2CDC5 | 1.58 | |
| gray-400 | #A9A49B | 2.48 | 장식 전용 |
| gray-500 | #7F7971 | 4.31 | 본문 글자 금지 (4.5 미만), 비활성·아이콘만 |
| gray-600 | #625D56 | 6.52 | |
| gray-700 | #49443F | 9.62 | |
| gray-800 | #312D29 | 13.65 | |
| gray-900 | #1D1A17 | 17.32 | |

### 1.3 위험도
base는 막대·점·채움 전용이다. 글자는 strong을 쓰고, 배경은 soft를 쓴다.

| 단계 | base | base 대비 | strong (글자) | strong 대비 | soft (배경) | strong / soft 대비 |
|---|---|---|---|---|---|---|
| low (낮음) | #399D57 | 3.42 | #246E3A | 6.24 | #E4F8E7 | 5.61 |
| caution (주의) | #E6B731 | 1.88 | #845A0F | 6.09 | #FFF5D7 | 5.59 |
| high (높음) | #E87F25 | 2.80 | #A84811 | 5.83 | #FFEEDE | 5.15 |
| very-high (매우 높음) | #CF4040 | 4.71 | #B02A2D | 6.53 | #FFECEB | 5.74 |

- caution과 high의 base는 흰 배경 대비가 3:1 미만이다. 이 색을 단독 UI 요소로 쓸 때는 테두리(strong)나 라벨을 함께 둔다.
- 위험도 단계와 REBA 조치 수준의 대응은 docs/assessment-rules.md를 따른다 (낮음 1~3, 주의 4~7, 높음 8~10, 매우 높음 11~15).

## 2. 의미 토큰 (라이트 모드)

| 토큰 | 참조 | 용도 |
|---|---|---|
| surface | gray-0 | 기본 배경, 카드 |
| surface-muted | gray-50 | 페이지 배경, 보조 영역 |
| surface-sunken | gray-100 | 입력 필드 배경, 구획 |
| border | gray-200 | 기본 구분선 |
| border-strong | gray-300 | 입력 필드 테두리 |
| text | brand-900 | 본문, 제목 |
| text-secondary | gray-600 | 보조 설명 |
| text-disabled | gray-500 | 비활성 (UI 요소 기준 3:1 이상) |
| primary | brand-600 | 주 버튼, 링크 |
| primary-hover | brand-700 | 주 버튼 hover |
| primary-active | brand-800 | 주 버튼 누름 |
| on-primary | gray-0 | 주 버튼 위 글자 (brand-600 위 7.20) |
| nav | brand-700 | 관리자 콘솔 내비게이션, 섹션 제목 |
| empathy-bg | brand-50 | "들려요" 응답, 신고 완료, 빈 화면 안내 배경 |
| empathy-fg | brand-500 | 공감 문구 강조 글자 |
| focus-ring | brand-500 | 키보드 포커스 표시 |
| risk-{level} | risk-{level}-base | 위험도 막대, 히트맵 칸 |
| risk-{level}-text | risk-{level}-strong | 위험도 라벨 글자 |
| risk-{level}-bg | risk-{level}-soft | 위험도 배지 배경 |

## 3. 컴포넌트 토큰 (예시)

| 컴포넌트 | 속성 | 기본 | hover | 누름 | 비활성 |
|---|---|---|---|---|---|
| 주 버튼 | 배경 | primary | primary-hover | primary-active | surface-sunken |
| 주 버튼 | 글자 | on-primary | on-primary | on-primary | text-disabled |
| 공감 카드 | 배경 | empathy-bg | - | - | - |
| 공감 카드 | 강조 글자 | empathy-fg | - | - | - |
| 위험도 배지 | 배경 / 글자 | risk-{level}-bg / risk-{level}-text | - | - | - |

## 4. 형태 토큰
- 간격: 8px 배수만 쓴다 (8, 16, 24, 32, 40, 48, 64)
- 모서리: 컨트롤과 표면을 나눈다. 비율은 2:3 ~ 2:4
  - radius-control: 8px (버튼, 입력 필드, 배지, 토글)
  - radius-surface: 12px (카드, 패널)
  - radius-surface-lg: 16px (모달, 하단 시트)
  - 이전 초안의 원형 끝(pill) 버튼은 쓰지 않는다
- 작업자 화면의 터치 영역: 최소 48px (장갑 착용을 고려한 제안이며 현장 테스트로 조정)

## 4.1 타이포그래피
- 글꼴: Pretendard (한글, 라틴, 숫자 공통). 라이선스는 도입 시 배포처에서 확인한다.
- 한글 글꼴은 파일이 크므로 필요한 글자만 불러오는 방식(서브셋)을 쓴다. 방식은 스캐폴딩 때 정한다.
- 관리자 콘솔의 표와 수치에는 고정폭 숫자(tabular figures)를 쓴다.
- 굵기는 400(본문), 500(라벨, 버튼), 700(제목)만 쓴다.

| 토큰 | 크기 / 줄 높이 (px) | 용도 |
|---|---|---|
| caption | 12 / 16 | 표의 보조 정보 |
| small | 14 / 24 | 콘솔 본문, 라벨 |
| body | 16 / 24 | 기본 본문 |
| body-lg | 18 / 28 | 작업자 화면 본문 (줄 높이만 8배수 예외) |
| title-sm | 20 / 32 | 카드 제목 |
| title | 24 / 32 | 화면 제목 |
| display | 32 / 40 | 작업자 화면의 핵심 수치, 큰 제목 |

## 4.2 표면
그림자보다 테두리와 배경 차이로 층을 구분한다. 그림자는 화면 위에 떠야 하는 요소에만 쓴다.

| 층 | 용도 | 배경 | 구분 |
|---|---|---|---|
| 0. 페이지 | 화면 바탕 | surface-muted | - |
| 1. 카드 | 카드, 패널, 표 | surface | border, 그림자 없음 |
| 2. 떠 있는 요소 | 드롭다운, 팝오버, 툴팁 | surface | shadow-sm |
| 3. 덮는 요소 | 모달, 하단 시트 | surface | shadow-lg + scrim |
| 공감 | "들려요" 응답, 신고 완료 | empathy-bg | 테두리 없음 |
| 위험도 | 위험도 배지, 경고 영역 | risk-{level}-bg | 위험도 라벨 필수 |

| 토큰 | 값 (시작값, 화면에서 조정) |
|---|---|
| shadow-sm | 0 2px 8px rgba(29, 26, 23, 0.06) |
| shadow-md | 0 8px 24px rgba(29, 26, 23, 0.10) |
| shadow-lg | 0 16px 48px rgba(29, 26, 23, 0.14) |
| scrim | rgba(29, 26, 23, 0.40) |

- 그림자와 가림막의 색은 gray-900(#1D1A17)을 투명하게 쓴다.

## 4.3 모션
| 토큰 | 값 | 용도 |
|---|---|---|
| motion-fast | 120ms | hover, 누름, 체크 |
| motion-base | 200ms | 탭 전환, 토글, 토스트 등장 |
| motion-slow | 320ms | 모달, 하단 시트 등장 |
| motion-emphasis | 480ms | "들려요" 확인 (한 번만) |
| ease-standard | cubic-bezier(0.2, 0, 0, 1) | 화면 안에서 움직이는 요소 |
| ease-decelerate | cubic-bezier(0, 0, 0, 1) | 나타나는 요소 |
| ease-accelerate | cubic-bezier(0.3, 0, 1, 1) | 사라지는 요소 |

- 모션은 상태 변화를 설명할 때만 쓴다. 반복되거나 장식적인 애니메이션은 쓰지 않는다.
- 촬영 화면에서는 애니메이션을 최소화한다. 필요하면 transform과 opacity만 쓴다.
- 위험도 값의 변화는 흔들림이나 깜빡임 없이 부드럽게만 표현한다.
- prefers-reduced-motion이 켜져 있으면 opacity 변화만 남긴다.
- 대표 모션: "들려요" 공감 카드가 scale 0.96 → 1, opacity 0 → 1로 motion-emphasis 동안 한 번 나타난다.
- 진동 피드백은 iOS Safari 지원 여부를 확인한 뒤 정한다.

## 5. 다크 모드
TBD. 지원하기로 정하면 의미 토큰마다 어두운 배경용 값을 추가하고 대비를 다시 검증한다.

## 6. CSS 변수 (초안)
```css
/* Primitive tokens */
:root {
  --brand-50: #F6F6FD;
  --brand-100: #EDEDFB;
  --brand-200: #D8D9F7;
  --brand-300: #B6B8ED;
  --brand-400: #888AD1;
  --brand-500: #6567AE;
  --brand-600: #46519C;
  --brand-700: #314B81;
  --brand-800: #23375C;
  --brand-900: #19263F;

  --gray-0: #FFFFFF;
  --gray-50: #F6F5F2;
  --gray-100: #EEEDE8;
  --gray-200: #E4E1DA;
  --gray-300: #D2CDC5;
  --gray-400: #A9A49B;
  --gray-500: #7F7971;
  --gray-600: #625D56;
  --gray-700: #49443F;
  --gray-800: #312D29;
  --gray-900: #1D1A17;

  --risk-low-base: #399D57;
  --risk-low-strong: #246E3A;
  --risk-low-soft: #E4F8E7;
  --risk-caution-base: #E6B731;
  --risk-caution-strong: #845A0F;
  --risk-caution-soft: #FFF5D7;
  --risk-high-base: #E87F25;
  --risk-high-strong: #A84811;
  --risk-high-soft: #FFEEDE;
  --risk-very-high-base: #CF4040;
  --risk-very-high-strong: #B02A2D;
  --risk-very-high-soft: #FFECEB;
}

/* Semantic tokens (light mode) */
:root {
  --surface: var(--gray-0);
  --surface-muted: var(--gray-50);
  --surface-sunken: var(--gray-100);
  --border: var(--gray-200);
  --border-strong: var(--gray-300);
  --text: var(--brand-900);
  --text-secondary: var(--gray-600);
  --text-disabled: var(--gray-500);
  --primary: var(--brand-600);
  --primary-hover: var(--brand-700);
  --primary-active: var(--brand-800);
  --on-primary: var(--gray-0);
  --nav: var(--brand-700);
  --empathy-bg: var(--brand-50);
  --empathy-fg: var(--brand-500);
  --focus-ring: var(--brand-500);
}
```

## 7. 미결정 사항
- Tailwind CSS 버전과 기본 색상표 비활성화 방법 (설치 시 확인)
- 다크 모드 지원 여부
