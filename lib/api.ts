import { NextRequest } from "next/server";

export async function readJson<T>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON");
  }
}

export function query(request: NextRequest) {
  return Object.fromEntries(request.nextUrl.searchParams.entries());
}
