export const ROLES = ["CLIENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "BLOCKED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DEVICE_STATUSES = ["ONLINE", "OFFLINE"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const BOX_STATUSES = ["LOCKED", "UNLOCKED", "OPENING", "ERROR"] as const;
export type BoxStatus = (typeof BOX_STATUSES)[number];

export const DEVICE_STATES = [
  "AVAILABLE",
  "PAYMENT_PENDING",
  "OPENING",
  "IN_USE",
  "RETURN_REQUIRED",
  "BALLS_MISSING",
  "ALARM",
  "MAINTENANCE",
  "OFFLINE",
] as const;
export type DeviceState = (typeof DEVICE_STATES)[number];

export const TABLE_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "ACTIVE",
  "RETURN_REQUIRED",
  "MAINTENANCE",
  "OFFLINE",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const SESSION_STATUSES = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "EXTENDED",
  "RETURN_REQUIRED",
  "BALLS_MISSING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PAYMENT_TYPES = ["SESSION", "EXTENSION", "MANUAL", "REFUND"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ALERT_TYPES = [
  "DEVICE_OFFLINE",
  "BALL_MISSING",
  "PAYMENT_FAILED",
  "BOX_ERROR",
  "SENSOR_ERROR",
  "SESSION_OVERDUE",
  "ALARM_ACTIVE",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const IOT_COMMANDS = [
  "OPEN_BOX",
  "CLOSE_BOX",
  "START_BALL_COUNT",
  "STOP_BALL_COUNT",
  "TIME_EXPIRED",
  "RESET_BALL_COUNT",
  "START_ALARM",
  "STOP_ALARM",
  "PING",
  "RESET",
  "STATUS",
] as const;
export type IotCommand = (typeof IOT_COMMANDS)[number];

export const COMMAND_STATUSES = [
  "PENDING",
  "SENT",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "EQUIPMENT_MAINTENANCE",
  "BALL_REPLACEMENT",
  "INTERNET",
  "ELECTRICITY",
  "ESP32_REPLACEMENT",
  "CLEANING",
  "RENT",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXTENSION_SOURCES = ["CLIENT", "ADMIN"] as const;
export type ExtensionSource = (typeof EXTENSION_SOURCES)[number];

export type Id = string;

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: Role;
  status: UserStatus;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  phone: string;
}

export interface SystemSettingsValues {
  businessName: string;
  currency: string;
  gracePeriodSeconds: number;
  heartbeatTimeoutSeconds: number;
  ballReturnAlarmDelaySeconds: number;
  defaultOpeningDurationMs: number;
  minimumSessionMinutes: number;
  maximumSessionMinutes: number;
  paymentExpiryMinutes: number;
}

export const DEFAULT_SETTINGS: SystemSettingsValues = {
  businessName: "Smart Billiard",
  currency: "MNT",
  gracePeriodSeconds: 120,
  heartbeatTimeoutSeconds: 60,
  ballReturnAlarmDelaySeconds: 120,
  defaultOpeningDurationMs: 7000,
  minimumSessionMinutes: 30,
  maximumSessionMinutes: 180,
  paymentExpiryMinutes: 10,
};
