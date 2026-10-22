import type { NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only signed-in console routes carry a session. Worker routes never create one (docs/auth.md).
export const config = {
  matcher: ["/console/:path*"],
};
