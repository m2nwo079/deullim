---
name: deullim-assessment
description: 들림의 web/src/core에 있는 각도 계산, 자세 평가(REBA 점수 산정), 좌표 필터, 투자 최적화(다중 선택 배낭 동적계획법) 코드나 tests/fixtures의 합성 테스트 벡터를 만들거나 고칠 때 사용한다.
---

# 들림 평가와 최적화 코드

## 읽을 문서
- docs/assessment-rules.md: 입력, 전처리, 부위별 각도, 점수표, 위험도 단계, 검증 (algorithm_version)
- docs/optimization-model.md: 기호, 정식화, 풀이, 출력, 경고, 테스트 (solver_version)
- docs/aihub-label-codes.md: AI Hub 라벨로 검증할 때만
- docs/lint-rules.md: L2 (src/core import 제한)

## 절차
1. 구현할 내용이 문서의 어느 절에 해당하는지 확인한다. 문서에 없는 가중치, 구간, 예외 처리가 필요하면 묻는다.
2. 규칙이나 모델의 동작을 바꾸는 작업이면 문서의 algorithm_version 또는 solver_version을 올려야 하는지 묻는다.
3. 순수 함수로 작성하고, 대상 파일 옆에 테스트를 둔다.
4. Python과 함께 쓰는 테스트 벡터는 tests/fixtures/<이름>_v<번호>.json에 둔다.
   형식이나 기존 케이스의 기대값을 바꿀 때는 기존 파일을 고치지 않고 새 번호의 파일을 만든다.
   케이스 추가는 같은 파일에 할 수 있다.
5. TypeScript 테스트는 fixture를 readFileSync(new URL("<상대 경로>", import.meta.url))로 읽는다.
   import로 불러오면 next build의 타입 검사가 web/ 밖 파일에 의존하게 된다 (스캐폴딩에서 확인).

## 점검표
- [ ] 문서의 예시 값과 경계값(구간의 양 끝, 0 길이 벡터, 무효 점)을 테스트했다.
- [ ] 각도는 atan2(|cross|, dot) 방식의 공용 함수(web/src/core/angle.ts)를 쓴다.
- [ ] fixture에 AI Hub 데이터나 실제 영상에서 나온 값이 없다.
- [ ] src/core에서 react, next, @supabase, @mediapipe를 import하지 않았다 (lint L2).
