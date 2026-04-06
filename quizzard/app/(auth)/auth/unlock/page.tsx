"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function UnlockPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No unlock token provided.");
      return;
    }

    fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Something went wrong.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <>
      {/* Logo + heading */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ position: "relative", marginBottom: "24px" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(174,137,255,0.2)",
              filter: "blur(24px)",
              borderRadius: "50%",
            }}
          />
          <Image
            src="/logo_trimmed.png"
            alt="Quizzard"
            width={96}
            height={96}
            style={{ objectFit: "contain", position: "relative" }}
            priority
          />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-brand)",
            fontSize: "48px",
            fontWeight: 400,
            color: "#ae89ff",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          {status === "loading" && "Unlocking..."}
          {status === "success" && "Account Unlocked"}
          {status === "error" && "Unlock Failed"}
        </h1>
      </div>

      {/* Card */}
      <div
        style={{
          background: "#121222",
          borderRadius: "32px",
          padding: "40px",
          boxShadow: "0 32px 64px -12px rgba(0,0,0,0.5)",
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        {/* Top gradient line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "1px",
            background: "linear-gradient(90deg, transparent 0%, rgba(174,137,255,0.4) 50%, transparent 100%)",
          }}
        />

        {status === "loading" && (
          <p style={{ color: "#aaa8c8", fontSize: "16px", margin: 0 }}>
            Unlocking your account...
          </p>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(74,222,128,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#4ade80" }}>
                lock_open
              </span>
            </div>
            <p style={{ color: "#e5e3ff", fontSize: "16px", margin: "0 0 8px" }}>
              Your account has been unlocked successfully.
            </p>
            <p style={{ color: "#aaa8c8", fontSize: "14px", margin: "0 0 32px" }}>
              You can now log in with your credentials.
            </p>
            <Link
              href="/auth/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "14px 32px",
                background: "linear-gradient(135deg, #ae89ff 0%, #884efb 100%)",
                border: "none",
                borderRadius: "16px",
                color: "#2a0066",
                fontSize: "16px",
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(174,137,255,0.25)",
              }}
            >
              Go to Login
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                arrow_forward
              </span>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(253,111,133,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#fd6f85" }}>
                lock
              </span>
            </div>
            <p style={{ color: "#e5e3ff", fontSize: "16px", margin: "0 0 8px" }}>
              {errorMessage}
            </p>
            <p style={{ color: "#aaa8c8", fontSize: "14px", margin: "0 0 32px" }}>
              Please try logging in again to receive a new unlock link.
            </p>
            <Link
              href="/auth/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "14px 32px",
                background: "#1d1d33",
                border: "none",
                borderRadius: "16px",
                color: "#e5e3ff",
                fontSize: "16px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </>
  );
}
