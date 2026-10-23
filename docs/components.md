# 들림 공통 컴포넌트 (초안 v1)

원칙은 docs/design-principles.md, 토큰은 docs/design-tokens.md를 따른다. 이 문서는 컴포넌트의 종류, 크기, 상태, 사용 규칙을 정한다.

## 원칙
- 화면 코드에서는 이 문서의 공통 컴포넌트를 쓴다. 긴 Tailwind 클래스 나열은 공통 컴포넌트 안에만 둔다.
- 컴포넌트 안에서도 의미 토큰과 컴포넌트 토큰만 쓴다. hex 값과 Tailwind 기본 색은 쓰지 않는다.
- 위험도 색은 RiskBadge, RiskBar, HeatmapCell에서만 쓴다.
- 새 공통 컴포넌트가 필요하면 임의로 만들지 않고 사용자에게 묻는다.

## 크기
| 화면 | 컨트롤 높이 | 비고 |
|---|---|---|
| 관리자 콘솔, 파트너 페이지 | 40px | |
| 작업자 화면 | 최소 48px | 장갑 착용 고려 |
| 작업자 화면의 핵심 동작 (촬영 시작, 신고 보내기) | 56px | 화면당 하나 |

- 모서리: 컨트롤은 radius-control(8px), 카드와 패널은 radius-surface(12px), 모달과 하단 시트는 radius-surface-lg(16px)

## 상태
모든 컨트롤은 아래 여섯 상태를 정의한다.

| 상태 | 표현 |
|---|---|
| 기본 | 컴포넌트별 정의 |
| hover | 한 단계 진한 토큰 (예: primary → primary-hover), motion-fast |
| 누름 | 두 단계 진한 토큰 (예: primary-active) |
| 키보드 포커스 | focus-ring 색 2px 테두리, 2px 간격 |
| 비활성 | surface-sunken 배경, text-disabled 글자, 포인터 비활성 |
| 로딩 | 라벨 자리에 진행 표시, 크기 유지, 중복 입력 차단 |

## 목록
| 분류 | 컴포넌트 | 규칙 |
|---|---|---|
| 기본 | Button | 종류: primary, secondary, text. 화면당 primary는 하나 |
| 기본 | IconButton | 아이콘만 있을 때도 접근성 이름(aria-label)을 반드시 둔다 |
| 기본 | MoneyField | 원 단위 금액 입력. 입력하는 동안 천 단위 쉼표를 붙이고 커서 위치를 숫자 기준으로 유지한다. 숫자 키패드(inputMode="numeric"). 서버에는 쉼표를 뺀 숫자만 보낸다. 나머지 규칙은 TextField와 같다 |
| 기본 | TextField, Select, Checkbox, Toggle, SegmentedControl, Tabs | 라벨은 항상 보이게 둔다. placeholder를 라벨 대신 쓰지 않는다. 입력 오류는 브라우저 말풍선 대신 칸 아래 문구로 알리고, aria-invalid와 aria-describedby로 칸에 연결하며, 칸 테두리를 border-text로 바꾼다 |
| 피드백 | Toast | motion-base로 나타나고 4초 후 사라진다 (시작값). 중요한 결과는 Toast만으로 알리지 않는다 |
| 피드백 | InlineAlert | 정보, 기한, 오류 표시. 위험도 색을 쓰지 않고 중립 배경과 아이콘으로 표시한다. 종류: 일반(info), 오류(error). 오류는 왼쪽 3px 막대와 굵은 글자, alert 아이콘을 모두 text 색으로 표시하고 role="alert"로 바로 알린다 |
| 피드백 | EmpathyCard | "들려요" 응답 전용. empathy-bg, empathy-fg, 대표 모션 |
| 피드백 | EmptyState, Skeleton, ProgressIndicator | 빈 화면 안내는 공감 톤의 문구를 쓴다 |
| 데이터 | RiskBadge | 표지형: 왼쪽 3px 색 막대 + 라벨 글자. 배경 없음, 모서리 없음. 콘솔에서 낮음·주의는 중립 회색 |
| 데이터 | RiskBar | 색 막대와 함께 수치 또는 라벨을 표시한다 |
| 데이터 | HeatmapCell | 칸마다 위험 단계 숫자나 짧은 라벨을 표시한다. 색으로만 구분하지 않는다. 콘솔에서는 높음 이상만 색 |
| 데이터 | Sparkline | 작은 추이 선 그래프. 기본은 중립 회색, 콘솔에서는 높음 이상만 위험도 색. 여러 행은 같은 눈금(0~100%)으로 그린다 |
| 데이터 | DataTable, StatStrip | 숫자는 고정폭, 오른쪽 정렬. 요약 수치는 카드 여러 장 대신 하나의 테두리 안에서 세로선으로 나눈다 (StatStrip) |
| 덮는 요소 | Modal | 관리자 콘솔용. 표면 3층. 네이티브 dialog(showModal)로 포커스를 안에 가두고, Esc로 닫으며, 닫으면 연 요소로 포커스를 돌려준다. 버튼은 취소를 먼저 둔다. 창의 폭은 min(480px, 화면 폭 − 32px)이다. 본문은 한글 띄어쓰기 단위로 줄바꿈하고, 한 단어가 창보다 길 때만 단어 중간에서 끊는다. 창 안에 가로 스크롤을 만들지 않는다 |
| 덮는 요소 | BottomSheet | 작업자 화면용. 표면 3층 |
| 덮는 요소 | Popover | 표면 2층 |
| 내비게이션 | ConsoleSidebar | nav 토큰 |
| 내비게이션 | WorkerTopBar | 작업장 이름과 뒤로 가기만 둔다 |
| 들림 전용 | CameraCaptureView | 아래 별도 규칙 |
| 들림 전용 | CaptureTimer | 촬영 남은 시간 표시. 촬영 중 화면 위 애니메이션은 최소화 |
| 들림 전용 | BodyMap | 통증 부위 선택. 부위마다 텍스트 라벨을 둔다. MVP는 ChoiceChipGrid로 구현한다 |
| 기본 | ChoiceChipGrid | 여러 개를 고르는 칩 격자. 작업자 화면에서 칩 높이 48px, 선택 상태는 테두리와 글자색으로 표시 |
| 기본 | Icon | 선(outline) 아이콘. 선 굵기 통일, 크기 16px 또는 20px, 색은 currentColor. 장식용은 aria-hidden, 아이콘만 있는 버튼은 aria-label. 이모지를 쓰지 않는다 |
| 기본 | IconTile | 회색 32px 타일 안의 아이콘. 공정 유형 표시와 EmptyState(옅은 타일)에 쓴다 |
| 기본 | FilterTabs | 개수가 붙은 토글 버튼. 선택된 탭도 중립색이며 브랜드 색과 위험도 색을 쓰지 않는다 |
| 기본 | SearchField | 검색 입력. 라벨을 항상 보이게 두고, 안내 문구(placeholder)는 text-secondary |
| 들림 전용 | OptimizerResultTable | 선택된 개선안, 비용, 예상 위험 감소량을 표로 표시 |
| 들림 전용 | QrEntryScreen | QR 접속 직후 첫 화면. 익명이라는 점을 먼저 안내한다 |
| 들림 전용 | QrCode | 공정 QR. text 색 칸과 surface 배경, 4칸 여백. 칸 배열은 서버에서 만들어 넘기고 QR 라이브러리를 브라우저에 싣지 않는다 |

## 카드 사용
- 카드는 공감 카드(EmpathyCard), 모달, 하단 시트에만 쓴다. 목록과 요약은 표와 구분선으로 정리한다.

## 위험한 동작
- 삭제처럼 되돌릴 수 없는 동작은 secondary 버튼으로 두고, 누르면 Modal로 결과를 설명한 뒤 한 번 더 확인받는다.
- 빨간 버튼은 쓰지 않는다 (위험도 색 규칙과 충돌).

## CameraCaptureView 규칙
- 영상은 video 요소, 관절 점은 그 위의 canvas에 그린다.
- MediaPipe에 넣는 영상은 좌우반전하지 않는다. 거울 모드에서는 video와 canvas를 함께 뒤집는다.
- 가시성 기준 미만인 점은 무효로 처리하고, 무효 점이 포함된 각도는 표시하지 않는다.
- 카메라 권한 거부, 카메라 없음, 분석 실패 상태를 각각 정의한다.
- 촬영 중에는 transform과 opacity 외의 애니메이션을 쓰지 않는다.
