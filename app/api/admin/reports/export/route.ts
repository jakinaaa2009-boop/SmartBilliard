import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Session } from "@/models/Session";
import { Table } from "@/models/Table";
import { User } from "@/models/User";
import { Expense } from "@/models/Expense";
import { requireUser, httpError } from "@/lib/auth/guards";

function csv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const type = request.nextUrl.searchParams.get("type") || "sessions";
    const format = request.nextUrl.searchParams.get("format") || "csv";

    let header: string[] = [];
    let rows: (string | number)[][] = [];

    if (type === "payments") {
      const payments = await Payment.find().sort({ createdAt: -1 }).lean();
      header = ["id", "type", "amount", "status", "qpayInvoiceId", "createdAt", "paidAt"];
      rows = payments.map((p) => [
        String(p._id),
        p.type,
        p.amount,
        p.status,
        p.qpayInvoiceId || "",
        p.createdAt.toISOString(),
        p.paidAt ? p.paidAt.toISOString() : "",
      ]);
    } else if (type === "expenses") {
      const expenses = await Expense.find().sort({ date: -1 }).lean();
      header = ["id", "title", "category", "amount", "date"];
      rows = expenses.map((e) => [String(e._id), e.title, e.category, e.amount, e.date.toISOString()]);
    } else {
      const sessions = await Session.find().sort({ createdAt: -1 }).lean();
      const tables = await Table.find().lean();
      const users = await User.find().lean();
      const tm = new Map(tables.map((t) => [String(t._id), t.name]));
      const um = new Map(users.map((u) => [String(u._id), u.fullName]));
      header = ["code", "user", "table", "minutes", "amount", "status", "startedAt"];
      rows = sessions.map((s) => [
        s.sessionCode,
        um.get(String(s.userId)) || "",
        tm.get(String(s.tableId)) || "",
        s.purchasedMinutes,
        s.totalAmount,
        s.status,
        s.startedAt ? s.startedAt.toISOString() : "",
      ]);
    }

    if (format === "xlsx") {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new Response(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${type}.xlsx"`,
        },
      });
    }

    const body = csv([header, ...rows]);
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}.csv"`,
      },
    });
  } catch (error) {
    return httpError(error);
  }
}
