import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE } from "@/lib/auth/cookie";

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-smart-billiard-jwt-secret-change-me-32c"
  );
}

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/play",
  "/admin/login",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      role = String(payload.role || "");
    } catch {
      role = null;
    }
  }

  const isAdminArea = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  const isRegister = pathname === "/register";
  const isClientAuth = ["/login", "/forgot-password", "/reset-password"].includes(pathname);

  if (isRegister) {
    return NextResponse.next();
  }

  if (isClientAuth && role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (isClientAuth && role === "CLIENT") {
    const redirect = request.nextUrl.searchParams.get("redirect") || "";
    const target = redirect && !redirect.startsWith("/admin") ? redirect : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }
  if (isAdminLogin && role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (isAdminLogin && role === "CLIENT") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/login" : "/login";
    url.search = "";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
