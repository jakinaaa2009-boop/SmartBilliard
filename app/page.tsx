import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth/guards";
import { QrCode, Timer, ShieldCheck, Smartphone } from "lucide-react";

export default async function HomePage() {
  const user = await getAuthUser();

  return (
    <div className="relative min-h-screen overflow-hidden felt-bg">
      <div className="pointer-events-none absolute inset-0 ball-grid" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.16),transparent_45%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <AppLogo href="/" />
        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" ? (
            <Button asChild>
              <Link href="/admin">Админ самбар</Link>
            </Button>
          ) : user ? (
            <Button asChild>
              <Link href="/dashboard">Миний самбар</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Нэвтрэх</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Бүртгүүлэх</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-8 md:px-8 md:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-3 text-sm font-medium text-primary">Smart Billiard</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              QR уншуулаад тоглоорой.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground md:text-lg">
              Ширээний QR кодыг уншуулж, цагаа сонгоод QPay-ээр төлнө үү. Төлбөр амжилттай болсны дараа хайрцаг автоматаар нээгдэнэ.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/login">Тоглож эхлэх</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/register">Шинээр бүртгүүлэх</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-card backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="font-medium">Ширээ №1</p>
              <span className="flex items-center gap-2 text-sm text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulseDot" />
                Онлайн
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {["30 мин", "1 цаг", "2 цаг"].map((label, i) => (
                <div
                  key={label}
                  className={`rounded-2xl border p-4 text-center ${i === 1 ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <p className="text-sm">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {["2,500₮", "5,000₮", "9,500₮"][i]}
                  </p>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" size="lg" asChild>
              <Link href="/login">QPay-аар төлөх</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: QrCode, title: "QR уншуулах", text: "Ширээний кодыг уншуулаад шууд нэвтэрнэ." },
            { icon: Smartphone, title: "QPay төлбөр", text: "Банкны апп-аар QR уншуулж төлнө." },
            { icon: Timer, title: "Цаг сунгах", text: "Тоглолтын дунд утсаараа хугацаа нэмнэ." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <item.icon className="mb-3 h-6 w-6 text-primary" />
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>Smart Billiard</span>
          <Link href="/admin/login" className="inline-flex items-center gap-1 hover:text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Оператор
          </Link>
        </div>
      </footer>
    </div>
  );
}
