import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syncora — Keep work in sync",
  description: "Premium full-stack project management and operational-intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
