import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "gomtmui",
  description: "Public CI/CD demo repository for the future gomtmui migration.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#0b1020",
          color: "#f8fafc",
        }}
      >
        {children}
      </body>
    </html>
  );
}
