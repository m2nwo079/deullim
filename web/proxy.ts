import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_LOGIN, loginPathFor, PARTNERS_LOGIN } from "./src/features/console-auth/rules";
import { updateSession } from "./src/lib/supabase/proxy";

/**
 * Refreshes the session and sends signed-out visitors to the login page.
 * This is only the first gate; console and partner layouts and pages check the session again on
 * the server.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (signedIn || pathname === CONSOLE_LOGIN || pathname === PARTNERS_LOGIN) {
    return response;
  }

  const login = request.nextUrl.clone();
  login.pathname = loginPathFor(pathname);
  login.search = "";
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

// Only signed-in console and partner routes carry a session. Worker routes never create one
// (docs/auth.md).
export const config = {
  matcher: ["/console/:path*", "/partners/:path*"],
};
