import React from "react";
import { Plus, Menu } from "lucide-react";
import { T } from "../lib/theme";

interface Props {
  brandName: string;
  brandLogo?: string;
  basePath: string;
  projectName: string;
  userLogin: string;
  userAvatar: string;
  onNewIssue: () => void;
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

const headerBase: React.CSSProperties = {
  background: T.bgPanel,
  backdropFilter: T.glassBlur,
  WebkitBackdropFilter: T.glassBlur,
  borderBottom: T.glassBorder,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexShrink: 0,
  position: "relative",
  zIndex: 10,
};

function BrandMark({
  brandName,
  brandLogo,
}: {
  brandName: string;
  brandLogo?: string;
}) {
  if (brandLogo && brandName) {
    return (
      <>
        <img
          src={brandLogo}
          alt={brandName}
          style={{
            height: 28,
            objectFit: "contain",
            display: "block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: T.accent,
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: ".04em",
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {brandName}
        </span>
      </>
    );
  }
}

export default function TopNav({
  brandName,
  brandLogo,
  basePath,
  projectName,
  userLogin,
  userAvatar,
  onNewIssue,
  isMobile,
  onMenuToggle,
}: Props) {
  async function logout() {
    await fetch("/api/jellybean/auth/logout", { method: "POST" });
    window.location.href = basePath;
  }

  // Mobile: minimal bar — all controls live in the sidebar drawer
  if (isMobile) {
    return (
      <header style={{ ...headerBase, padding: "10px 14px" }}>
        <button
          onClick={onMenuToggle}
          style={{
            background: "none",
            border: "none",
            color: T.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px",
            flexShrink: 0,
          }}
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
        <BrandMark brandName={brandName} brandLogo={brandLogo} />
      </header>
    );
  }

  // Desktop: full nav bar
  return (
    <header style={{ ...headerBase, padding: "10px 16px" }}>
      <BrandMark brandName={brandName} brandLogo={brandLogo} />
      <span style={{ color: T.borderMuted }}>|</span>
      <span style={{ color: T.textSecond, fontSize: "13px" }}>
        {projectName}
      </span>
      <div style={{ flex: 1 }} />

      {/* System Online indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: T.statusOnline,
            flexShrink: 0,
            display: "block",
          }}
        />
        <span
          style={{
            color: T.textFaint,
            fontSize: "11px",
            fontFamily: T.fontMono,
          }}
        >
          System Online
        </span>
      </div>

      <button
        onClick={onNewIssue}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})`,
          color: "#fff",
          border: "none",
          padding: "6px 14px",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
          boxShadow: T.glowShadow,
          transition: "box-shadow 0.2s, transform 0.15s",
        }}
      >
        <Plus size={14} />
        New Issue
      </button>
      <img
        src={userAvatar}
        alt={userLogin}
        title={userLogin}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1px solid ${T.borderSubtle}`,
        }}
      />
      <button
        onClick={() => void logout()}
        title="Sign out"
        style={{
          background: "none",
          border: `1px solid ${T.borderMuted}`,
          color: T.textFaint,
          padding: "5px 10px",
          borderRadius: "5px",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        Sign out
      </button>
    </header>
  );
}
