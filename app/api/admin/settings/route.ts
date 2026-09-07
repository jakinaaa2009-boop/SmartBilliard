import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSettings, SystemSettings } from "@/models/SystemSettings";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";
import type { SystemSettingsValues } from "@/types";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const settings = await getSettings();
    return jsonOk({ settings: toObject(settings) });
  } catch (error) {
    return httpError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    const body = await readJson<Partial<SystemSettingsValues>>(request);
    await connectDB();
    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global" },
      { $set: body },
      { new: true, upsert: true }
    );
    return jsonOk({ settings: toObject(settings) });
  } catch (error) {
    return httpError(error);
  }
}
