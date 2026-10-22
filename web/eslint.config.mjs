// Project-specific rules for Deullim. Rule numbers L1-L13 follow docs/lint-rules.md.
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.{ts,tsx}"];
const SECRET_KEY = "SUPABASE_SECRET_KEY";

// L3: dynamic import() is not covered by no-restricted-imports.
const mediapipeDynamicImport = {
  selector: "ImportExpression[source.value=/^@mediapipe\\//]",
  message: "Import MediaPipe only inside src/features/capture.",
};

// L4: dot access, bracket access, and destructuring of the secret key.
const secretKeyAccess = [
  {
    selector: `MemberExpression[object.object.name='process'][object.property.name='env'][property.name='${SECRET_KEY}']`,
    message: "Use the Supabase secret key only in src/lib/supabase/admin.ts.",
  },
  {
    selector: `MemberExpression[object.object.name='process'][object.property.name='env'][property.value='${SECRET_KEY}']`,
    message: "Use the Supabase secret key only in src/lib/supabase/admin.ts.",
  },
  {
    selector: `VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.name='${SECRET_KEY}']`,
    message: "Use the Supabase secret key only in src/lib/supabase/admin.ts.",
  },
];

// Checks applied to both string literals and template literal parts.
function stringChecks(regex, message) {
  return [
    { selector: `Literal[value=${regex}]`, message },
    { selector: `TemplateElement[value.raw=${regex}]`, message },
  ];
}

const tokenChecks = [
  // L6: arbitrary color values in class names.
  ...stringChecks("/\\[(#|rgb|hsl|oklch)/", "Use design tokens instead of arbitrary color values."),
  // L7: hex color literals.
  ...stringChecks("/#[0-9a-fA-F]{3,8}\\b/", "Use design tokens instead of hex colors."),
  // L13: fractional multiples of the 8px spacing unit (p-0.5, gap-1.5, -mt-2.5, md:w-1.5).
  ...stringChecks(
    "/(^|[\\s:!])-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|size|[wh]|min-[wh]|max-[wh]|inset(-[xy])?|top|right|bottom|left|start|end|translate-[xy]|scroll-[mp][xytrblse]?|indent|leading|basis)-[0-9]*[.][0-9]+($|[\\s!])/",
    "Spacing and sizing classes must use whole multiples of the 8px unit.",
  ),
];

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: TS_FILES })),
  {
    files: TS_FILES,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      // L1
      "line-comment-position": ["error", { position: "above" }],
      "no-inline-comments": "error",
      // L8, L9
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      // L10
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // L3 (static imports)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mediapipe/*"],
              message: "Import MediaPipe only inside src/features/capture.",
            },
          ],
        },
      ],
      // L3 (dynamic imports), L4, L6, L7, L13
      "no-restricted-syntax": ["error", mediapipeDynamicImport, ...secretKeyAccess, ...tokenChecks],
    },
  },
  // L11
  { ...jsxA11y.flatConfigs.recommended, files: TS_FILES },
  {
    // L12
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-console": ["error", { allow: ["warn", "error"] }] },
  },
  {
    // L2
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-*",
                "react/*",
                "next",
                "next/*",
                "@supabase/*",
                "@mediapipe/*",
              ],
              message: "src/core must stay framework-free.",
            },
          ],
        },
      ],
    },
  },
  {
    // L3 exception
    files: ["src/features/capture/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...secretKeyAccess, ...tokenChecks],
    },
  },
  {
    // L4 exception
    files: ["src/lib/supabase/admin.ts"],
    rules: {
      "no-restricted-syntax": ["error", mediapipeDynamicImport, ...tokenChecks],
    },
  },
);
