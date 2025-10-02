import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Widerøe Analytics | Sickness Absence Platform",
  description: "Analytics platform for understanding and predicting sickness absence patterns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
