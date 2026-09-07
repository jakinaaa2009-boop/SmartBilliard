import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Smart Billiard",
  description: "Ухаалаг биллиардын систем",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className="dark">
      <body className={`${inter.variable} font-sans antialiased felt-bg`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
