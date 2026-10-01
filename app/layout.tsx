import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 求职工作台",
  description: "私人岗位、简历与申请进度工作台。",

  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
