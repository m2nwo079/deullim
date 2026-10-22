---
name: deullim-task-flow
description: 들림 프로젝트에서 구현 작업을 시작할 때(브랜치 생성, 파일·패키지 제안), 작업 결과를 보고하고 리뷰를 요청할 때, 커밋 목록을 추천할 시점에 사용한다. 테스트 작성·실행 규칙, 보고 전 점검표, 리뷰 요청 형식, 커밋 scope 확인 절차를 담는다.
---

# 들림 작업 흐름

## 읽을 문서
- docs/git-workflow.md: 브랜치 이름, Claude Code가 실행할 수 있는 git 명령, 커밋 scope 목록, PR 규칙
- 작업 영역의 스킬: deullim-ui, deullim-assessment, deullim-data-auth, deullim-aihub-analysis

## 시작할 때
1. 현재 브랜치, git status, main과 origin/main의 차이를 확인한다.
2. 작업 영역의 설계 문서를 읽는다.
3. main에서 기능 브랜치를 만든다. 만들기 전에 이름과 분기 기준을 알린다.
4. 만들거나 고칠 파일 목록과 새 패키지(npm registry에서 확인한 버전, 용도)를 제안하고 승인받는다.

## 구현 중
- 기능 코드와 같은 작업 단위 안에서 테스트 코드를 함께 작성한다.
- 실패하는 테스트를 통과시키려고 테스트를 고치거나 단언을 약하게 바꾸지 않는다.
  테스트 수정이 필요하다고 판단되면 이유를 설명하고 승인을 받는다.
- web/ 설정을 고칠 때 유지할 것: next.config의 agentRules: false(에이전트 지침은 CLAUDE.md로만 관리),
  스크립트의 NEXT_TELEMETRY_DISABLED=1, dev 스크립트의 localhost 고정.

## 보고 전 점검
- [ ] web/에서 lint, typecheck, test를 실행했다. 화면이나 설정을 바꿨으면 build도 실행했다.
- [ ] 실행한 명령과 실제 결과(종료 코드, 통과·실패 수)를 그대로 적었다.
- [ ] eslint-disable을 썼다면 윗줄에 이유 주석을 달고 보고에 포함했다 (docs/lint-rules.md).
- [ ] 사용자가 직접 확인할 것이 있으면 확인 방법(주소, 명령, 보여야 하는 것)을 적었다.

## 리뷰 요청 형식
- 변경한 파일 목록과 각 변경의 이유
- 테스트 실행 결과
- 설계 문서와 다르게 구현한 부분과 그 이유 (없으면 "없음")

## 커밋 추천
- 형식과 scope는 docs/git-workflow.md를 따른다. 목록에 없는 scope가 필요하면 묻는다.
- 추천 목록에 data/, analysis/**/results/, .env.local, 생성 파일(web/next-env.d.ts, *.tsbuildinfo)이 없는지 확인한다.
- 사용자가 커밋했다고 하면 git log와 git status로 확인한 뒤 다음 단계로 넘어간다.
