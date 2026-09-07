import { cookies } from "next/headers";
import { AUTH_COOKIE, authCookieOptions } from "@/lib/auth/jwt";
import { jsonOk } from "@/lib/utils";

export async function POST() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
  return jsonOk({ message: "Гарлаа" });
}
