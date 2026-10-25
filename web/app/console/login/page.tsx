import { redirect } from "next/navigation";
import { LOGIN } from "../../../src/features/console-auth/rules";

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

/** Old console sign-in address: forwards to the one sign-in with next kept; /login checks it. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  redirect(typeof next === "string" ? `${LOGIN}?next=${encodeURIComponent(next)}` : LOGIN);
}
