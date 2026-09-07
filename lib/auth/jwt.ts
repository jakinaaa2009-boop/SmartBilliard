import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload, Role } from "@/types";
export { AUTH_COOKIE } from "@/lib/auth/cookie";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: JwtPayload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return new SignJWT({ role: payload.role, phone: payload.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: String(payload.sub),
    role: payload.role as Role,
    phone: String(payload.phone || ""),
  } satisfies JwtPayload;
}

export function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
