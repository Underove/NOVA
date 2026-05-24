import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "linear-gradient(145deg, #007AFF 0%, #0050CC 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <div style={{
          width: 0, height: 0,
          borderLeft: "20px solid transparent",
          borderRight: "20px solid transparent",
          borderBottom: "62px solid #FF3B30",
          marginBottom: -3,
        }} />
        <div style={{
          width: 18, height: 18,
          borderRadius: "50%",
          background: "white",
        }} />
        <div style={{
          width: 0, height: 0,
          borderLeft: "20px solid transparent",
          borderRight: "20px solid transparent",
          borderTop: "62px solid rgba(255,255,255,0.55)",
          marginTop: -3,
        }} />
      </div>
    ),
    { ...size },
  );
}
