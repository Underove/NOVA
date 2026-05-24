import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "linear-gradient(145deg, #007AFF 0%, #0050CC 100%)",
          borderRadius: 115,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* 나침반 바늘 — 위(북) 빨강 */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "28px solid transparent",
          borderRight: "28px solid transparent",
          borderBottom: "88px solid #FF3B30",
          marginBottom: -4,
        }} />
        {/* 중앙 원 */}
        <div style={{
          width: 24, height: 24,
          borderRadius: "50%",
          background: "white",
          zIndex: 2,
        }} />
        {/* 나침반 바늘 — 아래(남) 흰색 */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "28px solid transparent",
          borderRight: "28px solid transparent",
          borderTop: "88px solid rgba(255,255,255,0.55)",
          marginTop: -4,
        }} />
      </div>
    ),
    { ...size },
  );
}
