"use client";

import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#101619",
            border: "1px solid #1F2A2E",
            color: "#F8FAFC",
          },
        }}
      />
    </>
  );
}
