"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function parsePlayQr(raw: string) {
  const text = raw.trim();
  const fromUrl = text.match(/\/play\/([A-Za-z0-9_-]+)/i);
  if (fromUrl) return fromUrl[1].toUpperCase();
  const device = text.match(/DEVICE[-_]?\d+/i);
  if (device) return device[0].replace("_", "-").toUpperCase();
  if (/^[A-Z0-9-]{4,24}$/i.test(text)) return text.toUpperCase();
  return null;
}

export function QrScanButton({
  label = "QR уншуулах",
  size = "lg",
  variant = "button",
}: {
  label?: string;
  size?: "default" | "lg";
  variant?: "button" | "nav";
}) {
  const router = useRouter();
  const readerId = `qr-reader-${useId().replace(/:/g, "")}`;
  const fileReaderId = `qr-file-${useId().replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handled = useRef(false);

  function go(deviceId: string) {
    if (handled.current) return;
    handled.current = true;
    toast.success(`${deviceId} олдлоо`);
    setOpen(false);
    router.push(`/play/${deviceId}`);
  }

  useEffect(() => {
    if (!open) return;
    handled.current = false;
    setError("");
    let cancelled = false;

    async function start() {
      const el = document.getElementById(readerId);
      if (!el) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const id = parsePlayQr(decoded);
            if (id) go(id);
            else toast.error("Биллиардын QR код биш байна");
          },
          () => undefined
        );
        if (cancelled) await scanner.stop();
      } catch {
        if (!cancelled) {
          setError("Камер нээх боломжгүй байна. Зөвшөөрөл өгнө үү.");
        }
      }
    }

    const timer = window.setTimeout(() => void start(), 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [open, readerId]);

  async function onFile(file: File) {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(fileReaderId);
      const result = await scanner.scanFile(file, true);
      const id = parsePlayQr(result);
      if (!id) {
        toast.error("QR кодноос ширээ олдсонгүй");
        return;
      }
      go(id);
    } catch {
      toast.error("QR код уншигдсангүй");
    }
  }

  return (
    <>
      {variant === "nav" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow"
          aria-label={label}
        >
          <Camera className="h-6 w-6" />
        </button>
      ) : (
        <Button className="w-full gap-2" size={size} onClick={() => setOpen(true)}>
          <Camera className="h-5 w-5" />
          {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>QR код уншуулах</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Ширээний QR кодыг камерт харуулна уу.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
            <div id={readerId} className="min-h-[260px] w-full overflow-hidden" />
          </div>
          <div id={fileReaderId} className="hidden" />
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm hover:bg-white/5">
            <ImagePlus className="h-4 w-4" />
            Зургаас уншуулах
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="DEVICE-001"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => {
                const id = parsePlayQr(manual);
                if (!id) {
                  toast.error("Device ID буруу байна");
                  return;
                }
                go(id);
              }}
            >
              Орох
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
