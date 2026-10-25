import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_LOGIN, LOGIN, PARTNERS_LOGIN } from "./src/features/console-auth/rules";
import { updateSession } from "./src/lib/supabase/proxy";

/**
 * Refreshes the session and sends signed-out visitors to the one login page.
 * This is only the first gate; console and partner layouts and pages check the session again on
 * the server. The old console and partner login pages forward to /login themselves.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname } = request.nextUrl;
  if (signedIn || pathname === LOGIN || pathname === CONSOLE_LOGIN || pathname === PARTNERS_LOGIN) {
    return response;
  }

  // Drop ?done= so a past result notice does not show again after sign-in; signedInPath
  // drops it too, for next values that arrive another way.
  const params = new URLSearchParams(request.nextUrl.search);
  params.delete("done");
  const query = params.size > 0 ? `?${params}` : "";
  const login = request.nextUrl.clone();
  login.pathname = LOGIN;
  login.search = "";
  login.searchParams.set("next", `${pathname}${query}`);
  return NextResponse.redirect(login);
}

// Only signed-in console and partner routes carry a session; /login is here to refresh it.
// Worker routes never create one (docs/auth.md).
export const config = {
  matcher: ["/login", "/console/:path*", "/partners/:path*"],
};
