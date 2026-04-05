import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

function api(path: string) {
  if (!API_BASE_URL || API_BASE_URL === "/") return path;
  return `${API_BASE_URL}${path}`;
}

function formatRiskReason(reason: string) {
  switch (reason) {
    case "new_device":
      return "New device";
    case "new_ip":
      return "New IP address";
    case "new_country":
      return "New country";
    case "new_region":
      return "New region";
    case "unusual_time":
      return "Unusual login time";
    default:
      return reason;
  }
}

type RiskInfo = {
  score: number;
  level: string;
  reasons: string[];
};

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;

export default function OtpPage() {
  const navigate = useNavigate();

  const [msg, setMsg] = useState<string>("");
  const [riskInfo, setRiskInfo] = useState<RiskInfo | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState<number>(OTP_TTL_SECONDS);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const storedRiskInfo = sessionStorage.getItem("otp_risk_info");
    if (storedRiskInfo) {
      try {
        setRiskInfo(JSON.parse(storedRiskInfo));
      } catch {
        setRiskInfo(null);
      }
    }
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  function handleDigitChange(index: number, value: string) {
    const cleanValue = value.replace(/\D/g, "");

    if (!cleanValue) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    const chars = cleanValue.slice(0, OTP_LENGTH).split("");
    const next = [...otpDigits];

    let currentIndex = index;
    for (const char of chars) {
      if (currentIndex < OTP_LENGTH) {
        next[currentIndex] = char;
        currentIndex += 1;
      }
    }

    setOtpDigits(next);

    const nextFocusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
        return;
      }

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((char, idx) => {
      next[idx] = char;
    });

    setOtpDigits(next);

    const focusIndex = Math.min(pasted.length - 1, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleVerifyOtp() {
    try {
      setIsVerifying(true);
      setMsg("Verifying OTP...");

      const res = await fetch(api("/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: otpCode }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMsg(`OTP verify error:\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      sessionStorage.removeItem("otp_username");
      sessionStorage.removeItem("otp_risk_info");

      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setRiskInfo(null);

      setMsg(`✅ OTP verified successfully:\n${JSON.stringify(json, null, 2)}`);
      navigate("/dashboard");
    } catch (e: any) {
      setMsg(`❌ OTP verification failed: ${e?.message ?? String(e)}`);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendOtp() {
    try {
      setIsResending(true);
      setMsg("Resending OTP...");

      const res = await fetch(api("/otp/resend"), {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok) {
        setMsg(`Resend OTP error:\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(OTP_TTL_SECONDS);
      setMsg(`✅ OTP resent successfully:\n${JSON.stringify(json, null, 2)}\n\nPlease check your email for the new code.`);
      inputRefs.current[0]?.focus();
    } catch (e: any) {
      setMsg(`❌ Resend OTP failed: ${e?.message ?? String(e)}`);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(30,64,175,0.18), transparent 30%), linear-gradient(135deg, #07111f 0%, #0b1627 45%, #0a1220 100%)",
        color: "#e5eefc",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <header
        style={{
          height: 72,
          borderBottom: "1px solid rgba(148,163,184,0.14)",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "white",
              boxShadow: "0 8px 22px rgba(37,99,235,0.35)",
            }}
          >
            S
          </div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>SecureAccess</div>
        </div>
      </header>

      <main
        style={{
          minHeight: "calc(100vh - 72px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "rgba(15, 23, 42, 0.72)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 25px 80px rgba(2, 6, 23, 0.45)",
            backdropFilter: "blur(18px)",
            borderRadius: 20,
            padding: 28,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div
              style={{
                width: 62,
                height: 62,
                margin: "0 auto 18px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.12)",
                border: "1px solid rgba(59,130,246,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              🛡️
            </div>

            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>
              Security Verification
            </h1>

            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                color: "#94a3b8",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              We detected an unusual login attempt. Enter the 6-digit code sent to your email to continue.
            </p>
          </div>

          {riskInfo && (
            <div
              style={{
                marginBottom: 18,
                borderRadius: 14,
                padding: 14,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#f8fafc" }}>
                Why verification is needed
              </div>
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7 }}>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Risk Level:</strong> {riskInfo.level}
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Risk Score:</strong> {riskInfo.score}
                </div>
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: "#f8fafc" }}>Reasons:</strong>
                  {riskInfo.reasons.length > 0 ? (
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {riskInfo.reasons.map((reason) => (
                        <li key={reason}>{formatRiskReason(reason)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ marginTop: 8, marginBottom: 0 }}>No unusual factors detected.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 10,
              marginBottom: 14,
            }}
          >
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={OTP_LENGTH}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                style={{
                  width: 48,
                  height: 54,
                  textAlign: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(59,130,246,0.35)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#f8fafc",
                  fontSize: 22,
                  fontWeight: 700,
                  outline: "none",
                }}
              />
            ))}
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              color: secondsLeft > 0 ? "#94a3b8" : "#fca5a5",
              marginBottom: 18,
            }}
          >
            Code expires in <strong>{timerLabel}</strong>
          </div>

          <button
            onClick={handleVerifyOtp}
            disabled={otpCode.length !== OTP_LENGTH || secondsLeft <= 0 || isVerifying}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: otpCode.length !== OTP_LENGTH || secondsLeft <= 0 || isVerifying ? "not-allowed" : "pointer",
              opacity: otpCode.length !== OTP_LENGTH || secondsLeft <= 0 || isVerifying ? 0.7 : 1,
              boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
            }}
          >
            {isVerifying ? "Verifying..." : "Verify & Login"}
          </button>

          <div
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 14,
              color: "#94a3b8",
            }}
          >
            Didn’t receive the code?{" "}
            <button
              onClick={handleResendOtp}
              disabled={isResending}
              style={{
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                cursor: isResending ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
                padding: 0,
              }}
            >
              {isResending ? "Resending..." : "Resend"}
            </button>
          </div>

          {msg && (
            <pre
              style={{
                marginTop: 18,
                whiteSpace: "pre-wrap",
                background: "rgba(2, 6, 23, 0.45)",
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: 14,
                padding: 12,
                fontSize: 12.5,
                color: "#cbd5e1",
                overflowX: "auto",
              }}
            >
              {msg}
            </pre>
          )}

          <div
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            End-to-end encrypted
          </div>
        </div>
      </main>
    </div>
  );
}