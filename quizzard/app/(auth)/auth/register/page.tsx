"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      router.push("/auth/login?registered=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "16px 16px 16px 48px",
    background: "#23233c",
    border: "none",
    borderRadius: "16px",
    color: "#e5e3ff",
    fontSize: "15px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)",
  };

  const iconWrapStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    paddingLeft: "14px",
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
    color: "#aaa8c8",
  };

  return (
    <>
      {/* Logo + heading */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            marginBottom: "24px",
            background: "#23233c",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px rgba(174,137,255,0.15)",
          }}
        >
          <Image
            src="/logo_trimmed.png"
            alt="Quizzard"
            width={56}
            height={56}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
        <h1
          style={{
            fontFamily: '"Shrikhand", serif',
            fontStyle: "italic",
            fontSize: "44px",
            fontWeight: 400,
            color: "#ae89ff",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Quizzard AI
        </h1>
        <p style={{ color: "#aaa8c8", fontSize: "17px", margin: 0, textAlign: "center" }}>
          Join the Neon Scholar society.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: "rgba(24,24,42,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "32px",
          padding: "40px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
        }}
      >
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#e5e3ff",
            margin: "0 0 32px",
          }}
        >
          Create Account
        </h2>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(253,111,133,0.12)",
              color: "#fd6f85",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Full Name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "#b9c3ff",
                marginBottom: "8px",
                paddingLeft: "4px",
              }}
            >
              Full Name
            </label>
            <div style={{ position: "relative" }}>
              <div style={iconWrapStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>person</span>
              </div>
              <input
                type="text"
                placeholder="Alex Scholar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(174,137,255,0.4)"; }}
                onBlur={(e) => { e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "#b9c3ff",
                marginBottom: "8px",
                paddingLeft: "4px",
              }}
            >
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <div style={iconWrapStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>mail</span>
              </div>
              <input
                type="email"
                placeholder="alex@neonscholar.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(174,137,255,0.4)"; }}
                onBlur={(e) => { e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "#b9c3ff",
                marginBottom: "8px",
                paddingLeft: "4px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <div style={iconWrapStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>lock</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px rgba(174,137,255,0.4)"; }}
                onBlur={(e) => { e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Terms */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "0 4px" }}>
            <input
              type="checkbox"
              id="terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                marginTop: "2px",
                width: "18px",
                height: "18px",
                borderRadius: "4px",
                background: "#23233c",
                border: "none",
                accentColor: "#ae89ff",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="terms"
              style={{ fontSize: "13px", color: "#aaa8c8", lineHeight: "1.6", cursor: "pointer" }}
            >
              I agree to the{" "}
              <a href="#" style={{ color: "#b9c3ff", textDecoration: "none" }}>Terms of Service</a>
              {" "}and{" "}
              <a href="#" style={{ color: "#b9c3ff", textDecoration: "none" }}>Privacy Policy</a>.
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              background: loading
                ? "#464560"
                : "linear-gradient(135deg, #ae89ff 0%, #884efb 100%)",
              border: "none",
              borderRadius: "16px",
              color: loading ? "#aaa8c8" : "#2a0066",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 8px 24px rgba(174,137,255,0.3)",
              transition: "transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(174,137,255,0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(174,137,255,0.3)";
              }
            }}
            onMouseDown={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
            }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        {/* Sign in link */}
        <div
          style={{
            marginTop: "32px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(70,69,96,0.2)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#aaa8c8", fontSize: "15px", margin: 0 }}>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              style={{ color: "#ffde59", fontWeight: 700, textDecoration: "none" }}
            >
              Log In
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "32px",
          display: "flex",
          justifyContent: "center",
          gap: "32px",
        }}
      >
        {["Help Center", "System Status", "Contact Support"].map((item) => (
          <a
            key={item}
            href="#"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#737390",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#e5e3ff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#737390";
            }}
          >
            {item}
          </a>
        ))}
      </div>
    </>
  );
}
