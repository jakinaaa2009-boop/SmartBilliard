import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { PricingPlan } from "@/models/PricingPlan";
import { requireUser, httpError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const plans = await PricingPlan.find().sort({ sortOrder: 1 }).lean();
    return jsonOk({ plans: plans.map((p) => ({ ...p, id: String(p._id) })) });
  } catch (error) {
    return httpError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const body = await readJson<{
      name: string;
      durationMinutes: number;
      price: number;
      active?: boolean;
      popular?: boolean;
      sortOrder?: number;
    }>(request);
    await connectDB();
    const plan = await PricingPlan.create({
      name: body.name,
      durationMinutes: body.durationMinutes,
      price: body.price,
      active: body.active !== false,
      popular: Boolean(body.popular),
      sortOrder: body.sortOrder || 0,
    });
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_PRICE",
      targetType: "PricingPlan",
      targetId: String(plan._id),
      newValue: plan.toObject(),
    });
    return jsonOk({ plan: toObject(plan) }, 201);
  } catch (error) {
    return httpError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const body = await readJson<{
      id: string;
      name?: string;
      durationMinutes?: number;
      price?: number;
      active?: boolean;
      popular?: boolean;
      sortOrder?: number;
    }>(request);
    if (!body.id) return jsonError("id шаардлагатай");
    await connectDB();
    const plan = await PricingPlan.findById(body.id);
    if (!plan) return jsonError("Багц олдсонгүй", 404);
    const old = plan.toObject();
    if (body.name) plan.name = body.name;
    if (body.durationMinutes) plan.durationMinutes = body.durationMinutes;
    if (typeof body.price === "number") plan.price = body.price;
    if (typeof body.active === "boolean") plan.active = body.active;
    if (typeof body.popular === "boolean") plan.popular = body.popular;
    if (typeof body.sortOrder === "number") plan.sortOrder = body.sortOrder;
    await plan.save();
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_PRICE",
      targetType: "PricingPlan",
      targetId: String(plan._id),
      oldValue: old,
      newValue: plan.toObject(),
    });
    return jsonOk({ plan: toObject(plan) });
  } catch (error) {
    return httpError(error);
  }
}
