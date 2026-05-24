import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주식나침반",
  description: "AI가 주식 정보를 교차검증해 신뢰도를 알려주는 안전한 투자 길잡이",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "주식나침반",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#007AFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ height: "100%" }}>
      <body style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
