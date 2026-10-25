"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button } from "../../components/button";
import { InlineAlert } from "../../components/inline-alert";
import { TextField } from "../../components/text-field";
import { signIn, type SignInState } from "./actions";
import { formText, validateLoginFields, type LoginFieldErrors, type SignInError } from "./rules";

const MESSAGES: Record<SignInError, string> = {
  credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  unavailable: "지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.",
  forbidden: "이 계정으로는 들림을 쓸 수 없어요. 운영 담당자에게 문의해 주세요.",
};

const ERROR_ID = "login-error";

/**
 * Email and password form. Browser validation bubbles are off (noValidate); messages appear
 * under each field instead. After a failed sign-in the email stays and the password is cleared.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const errors = validateLoginFields(formText(form, "email"), formText(form, "password"));
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      event.preventDefault();
    }
  }

  const hasFieldErrors = Boolean(fieldErrors.email || fieldErrors.password);
  const serverError = !hasFieldErrors && state.error ? state.error : undefined;
  const describedBy = serverError ? ERROR_ID : undefined;

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="이메일"
        autoComplete="username"
        aria-required
        defaultValue={state.email}
        error={fieldErrors.email}
        aria-describedby={describedBy}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="비밀번호"
        autoComplete="current-password"
        aria-required
        error={fieldErrors.password}
        aria-describedby={describedBy}
      />
      {/* 32px above the button row: the form's 24px gap plus 8px. */}
      <div className="mt-1 flex flex-col gap-2">
        {/* Errors about the whole form sit right above the button (docs/components.md). */}
        {serverError ? (
          <InlineAlert id={ERROR_ID} tone="error">
            {MESSAGES[serverError]}
          </InlineAlert>
        ) : null}
        <Button type="submit" loading={pending}>
          로그인
        </Button>
      </div>
    </form>
  );
}
