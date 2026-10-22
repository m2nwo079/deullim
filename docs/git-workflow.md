# Git 작업 규칙

전역 규칙(~/.claude/CLAUDE.md)의 Git 항목을 따르며, 이 문서는 프로젝트 고유 규칙만 담는다.
Claude Code는 git add, commit, push를 실행하지 않는다(전역 규칙).

## 브랜치 전략: GitHub Flow
- main은 항상 배포와 제출이 가능한 상태로 유지한다. main에 직접 커밋하지 않는다.
- 모든 변경은 main에서 분기한 기능 브랜치에서 작업하고, PR로 병합한다.
- 작업 단위 하나에 브랜치 하나를 쓴다.

## 브랜치 이름
- 형식: <type>/<short-description>
- type은 커밋 type과 같은 값을 쓴다: feat, fix, docs, chore, refactor, test
- 설명은 영어 소문자와 하이픈으로 쓴다.
- 예: feat/worker-capture, chore/aihub-label-inference

## Claude Code의 브랜치 작업
- 브랜치 생성과 전환은 허용한다. 실행 전에 브랜치 이름과 분기 기준을 먼저 알린다.
- 작업 트리에 커밋되지 않은 변경이 있으면 전환하지 않고 보고한다.
- git fetch는 허용한다. git pull, merge, rebase, reset, stash, 브랜치 삭제, 태그 조작은
  실행하지 않고 사용자에게 묻는다.

## 커밋
- 형식: <type>(<scope>): <summary>
- scope 목록: worker, console, partners, assessment, optimizer, report,
  auth, db, infra, analysis, docs, ui
  - ui: 스타일, 디자인 토큰, 공통 컴포넌트, 화면
- 목록에 없는 scope가 필요하면 임의로 만들지 않고 묻는다.
- 예: feat(assessment): add 2D joint angle utilities

## PR
- 기능 브랜치 작업을 마치면 Claude Code가 커밋 목록과 메시지를 추천하고,
  사용자가 커밋, push, PR 생성을 한다.
- PR 본문 초안은 Claude Code가 CLAUDE.md의 리뷰 요청 형식으로 작성한다.
- 병합 방식은 머지 커밋만 사용한다. 스쿼시와 리베이스 병합은 쓰지 않는다.
- 병합된 기능 브랜치의 삭제는 사용자가 한다.

## 태그
- 결과물 제출 시점의 main에 v1.0.0 태그를 남긴다. 태그는 사용자가 만든다.
