import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMNT(amount: number) {
  return `${Math.round(amount).toLocaleString("mn-MN")}₮`;
}

export function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export function remainingSeconds(expiresAt: string | Date) {
  return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
}

export function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} минут`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} цаг`;
  return `${hours.toFixed(1)} цаг`;
}

export function tableDisplayName(number: number, name?: string) {
  return name || `Ширээ №${number}`;
}

export function relativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "яг одоо";
  if (seconds < 60) return `${seconds} сек өмнө`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  return `${days} өдрийн өмнө`;
}

export function generateId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `${prefix}-${time}${rand}`;
}

export function generateSecret(bytes = 24) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const array = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) out += alphabet[array[i] % alphabet.length];
    return out;
  }
  for (let i = 0; i < bytes; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseBoolean(value: string | undefined, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isMockPaymentEnabled() {
  return process.env.NODE_ENV !== "production" && parseBoolean(process.env.MOCK_PAYMENT);
}

export function isMockIotEnabled() {
  return process.env.NODE_ENV !== "production" && parseBoolean(process.env.MOCK_IOT);
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ success: false, message, ...extra }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ success: true, ...normalize(data) }, { status });
}

function normalize<T>(data: T) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { data };
}

export function toObject(doc: unknown) {
  if (!doc) return null;
  const raw = typeof (doc as { toObject?: () => unknown }).toObject === "function"
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>);
  const obj = { ...raw } as Record<string, unknown>;
  if (obj._id) obj.id = String(obj._id);
  delete obj.passwordHash;
  delete obj.secretHash;
  delete obj.__v;
  return obj;
}
