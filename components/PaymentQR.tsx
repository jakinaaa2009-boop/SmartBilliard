"use client";

export function PaymentQR({ src, amountLabel }: { src?: string; amountLabel?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl bg-white p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="QPay QR" className="h-56 w-56" />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center text-black/40">QR</div>
        )}
      </div>
      {amountLabel ? <p className="mt-3 text-lg font-semibold">{amountLabel}</p> : null}
    </div>
  );
}
