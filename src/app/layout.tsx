import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kho hồ sơ giáo dục",
  description: "Hệ thống quản lý tài liệu giáo viên nội bộ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body
        className="flex min-h-full flex-col antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
