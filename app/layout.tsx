import type { Metadata } from "next";
import "./globals.css";
import { OrganizationProvider } from "@/lib/context/OrganizationContext";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Analytics Platform | Multi-Tenant Regression Analysis",
  description: "Universal analytics platform combining open data sources for regression analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <OrganizationProvider>
          <Navigation />
          {children}
        </OrganizationProvider>
      </body>
    </html>
  );
}
