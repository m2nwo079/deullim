# 린트와 포맷 규칙 (v1)

## 도구
- ESLint (flat config) + typescript-eslint + eslint-plugin-react-hooks + eslint-plugin-jsx-a11y
- Prettier + prettier-plugin-tailwindcss (Tailwind 클래스 순서 정렬)
- 패키지 버전과 Next.js 연동 방식은 스캐폴딩 때 확인한다. 새 패키지는 설치 전에 사용자 승인을 받는다.

## 강제 시점
- GitHub Actions의 PR 검사에서 린트, 타입 검사, 테스트, 빌드를 실행한다. 하나라도 실패하면 병합하지 않는다.
- git hook은 쓰지 않는다.
- Claude Code는 작업 보고 전에 린트, 타입 검사, 테스트를 실행하고 결과를 보고한다.

## 들림 고유 규칙
| 번호 | 규칙 | 근거 | 구현 |
|---|---|---|---|
| L1 | 주석은 코드와 같은 줄에 쓰지 않는다 | 전역 규칙 | `line-comment-position: ["error", { position: "above" }]`, `no-inline-comments: "error"` |
| L2 | web/src/core/에서 react, next, @supabase, @mediapipe를 import하지 않는다 | CLAUDE.md 디렉터리 규칙 | core 경로 override에 `no-restricted-imports` |
| L3 | @mediapipe/*는 web/src/features/capture/ 안에서만 import한다 | 클라이언트 전용 실행 원칙 | 전체에 `no-restricted-imports`, capture 경로만 해제 |
| L4 | `process.env.SUPABASE_SERVICE_ROLE_KEY`는 web/src/lib/supabase/admin.ts에서만 참조한다 | 보안 원칙 | 전체에 `no-restricted-syntax`, 해당 파일만 해제 |
| L5 | admin.ts는 서버 전용임을 표시한다 | 보안 원칙 | 파일 첫 줄 `import "server-only"`를 코드 리뷰로 확인 (패키지 도입 시 승인 필요) |
| L6 | 클래스에 임의 색상 값(`bg-[#...]`, `text-[rgb(...)]` 등)을 쓰지 않는다 | 디자인 토큰 원칙 | 문자열과 템플릿 리터럴에 `no-restricted-syntax` 정규식 검사 |
| L7 | TS, TSX 파일에 hex 색상 리터럴을 쓰지 않는다 | 디자인 토큰 원칙 | 문자열 리터럴 `/#[0-9a-fA-F]{3,8}\b/` 검사. 토큰 CSS 파일은 대상 아님 |
| L8 | `any` 금지 | TypeScript strict | `@typescript-eslint/no-explicit-any: "error"` |
| L9 | 처리하지 않은 Promise 금지 | 런타임 오류 방지 | `@typescript-eslint/no-floating-promises: "error"` (타입 정보 사용) |
| L10 | Hooks 규칙 | React | `react-hooks/rules-of-hooks: "error"`, `react-hooks/exhaustive-deps: "warn"` |
| L11 | 접근성 기본 규칙 | 접근성 | jsx-a11y recommended |
| L12 | web/src에서 console.log 금지 | 운영 로그 정리 | `no-console: ["error", { allow: ["warn", "error"] }]` |

- 화면의 한국어 문구는 컴포넌트에 직접 쓸 수 있다 (CLAUDE.md 결정). 한글 문자열을 막는 규칙은 두지 않는다.
- Tailwind 기본 색 이름(`bg-blue-600` 등) 사용 검출은 Tailwind 전용 린트 플러그인이 현재 Tailwind 버전을 지원하는 경우에만 추가한다. 지원하지 않으면 코드 리뷰로 확인한다.
- 규칙을 끄는 주석(eslint-disable)은 이유를 윗줄 주석으로 적고, 리뷰 요청에 포함한다.

## 설정 예시 (구조만, 경로와 패키지명은 스캐폴딩 때 확정)
```js
// eslint.config.mjs
// Project-specific rules for Deullim. Package versions are confirmed at scaffolding.
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "line-comment-position": ["error", { position: "above" }],
      "no-inline-comments": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@mediapipe/*"], message: "Import MediaPipe only inside src/features/capture." }]
      }],
      "no-restricted-syntax": ["error",
        {
          selector: "MemberExpression[object.object.name='process'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message: "Use the service role key only in src/lib/supabase/admin.ts."
        },
        {
          selector: "Literal[value=/\\[(#|rgb|hsl|oklch)/]",
          message: "Use design tokens instead of arbitrary color values."
        },
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Use design tokens instead of hex colors."
        }
      ]
    }
  },
  {
    files: ["src/features/capture/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" }
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["react", "react-*", "next", "next/*", "@supabase/*", "@mediapipe/*"], message: "src/core must stay framework-free." }]
      }]
    }
  }
];
```
- L4는 admin.ts 경로 override에서 해당 selector만 해제하는 방식으로 구현한다.
- L6, L7의 정규식은 템플릿 리터럴(TemplateElement)에도 같은 검사를 추가한다.
- L7은 `#add`처럼 hex 문자로만 이루어진 일반 문자열도 검출할 수 있다. 이런 경우는 eslint-disable 규칙(이유 주석 필수)으로 처리한다.
- 위 예시는 구조를 보여주기 위한 것이며, 실제 설정은 스캐폴딩 때 동작을 확인한 뒤 확정한다.
