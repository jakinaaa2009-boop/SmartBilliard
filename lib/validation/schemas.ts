import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Нэр оруулна уу"),
    phone: z.string().min(8, "Утасны дугаар буруу байна"),
    email: z.string().email().optional().or(z.literal("")),
    password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт"),
    confirmPassword: z.string(),
    acceptedTerms: z.boolean().refine((v) => v === true, "Үйлчилгээний нөхцөлийг зөвшөөрнө үү"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z.string().min(3, "Утас эсвэл имэйл оруулна уу"),
  password: z.string().min(1, "Нууц үг оруулна уу"),
});

export const profileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
});

export const createPaymentSchema = z.object({
  deviceId: z.string().min(1),
  pricingPlanId: z.string().min(1),
  type: z.enum(["SESSION", "EXTENSION"]),
  sessionId: z.string().optional(),
});

export const commandSchema = z.object({
  command: z.enum([
    "OPEN_BOX",
    "CLOSE_BOX",
    "START_ALARM",
    "STOP_ALARM",
    "PING",
    "RESET",
    "STATUS",
  ]),
  duration: z.number().optional(),
});

export const heartbeatSchema = z.object({
  deviceId: z.string(),
  boxStatus: z.enum(["LOCKED", "UNLOCKED", "OPENING", "ERROR"]).optional(),
  detectedBallCount: z.number().int().min(0).optional(),
  alarmStatus: z.boolean().optional(),
  firmwareVersion: z.string().optional(),
  wifiRssi: z.number().optional(),
  uptime: z.number().optional(),
  ipAddress: z.string().optional(),
});
