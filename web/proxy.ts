import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_LOGIN } from "./src/features/console-auth/rules";
import { updateSession } from "./src/lib/supabase/proxy";

/**
 * Refreshes the session and sends signed-out visitors to the login page.
 * This is only the first gate; console layouts and pages check the session again on the server.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  if (signedIn || pathname === CONSOLE_LOGIN) {
    return response;
  }

  const login = request.nextUrl.clone();
  login.pathname = CONSOLE_LOGIN;
  login.search = "";
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

// Only signed-in console routes carry a session. Worker routes never create one (docs/auth.md).
export const config = {
  matcher: ["/console/:path*"],
};
