import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "سامانه مدیریت پروژه‌ها و پروپوزال‌های تحقیق و توسعه",
  description:
    "سامانه یکپارچه ثبت، تغییر و پایش پروژه‌ها و پروپوزال‌های R&D همراه با ارزیابی ناظران و مدیریت مالی",
  keywords: ["تحقیق و توسعه", "مدیریت پروژه", "پروپوزال", "ارزیابی", "R&D"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
