import { cookies } from "next/headers";
import { AUTH_COOKIE, verifyAuthToken } from "@/lib/auth/jwt";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import type { AuthUser, Role } from "@/types";

export async function getAuthUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAuthToken(token);
    await connectDB();
    const user = await User.findById(payload.sub);
    if (!user || user.status === "BLOCKED") return null;
    return {
      id: String(user._id),
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]) {
  const user = await getAuthUser();
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (roles && !roles.includes(user.role)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export function httpError(error: unknown) {
  const message = error instanceof Error ? error.message : "Server error";
  if (message === "UNAUTHORIZED") {
    return Response.json({ success: false, message: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return Response.json({ success: false, message: "Эрх хүрэхгүй байна" }, { status: 403 });
  }
  const status = (error as { status?: number }).status || 500;
  return Response.json({ success: false, message }, { status });
}
