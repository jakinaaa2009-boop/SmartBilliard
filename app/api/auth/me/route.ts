import { getAuthUser } from "@/lib/auth/guards";
import { jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return jsonError("Нэвтрэх шаардлагатай", 401);
  return jsonOk({ user });
}
