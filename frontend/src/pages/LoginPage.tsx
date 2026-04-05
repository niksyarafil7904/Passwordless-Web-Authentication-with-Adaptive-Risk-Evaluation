import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
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

export default function LoginPage() {
  const navigate = useNavigate();

  const [msg, setMsg] = useState<string>("");
  const [username, setUsername] = useState<string>("alex");
  const [email, setEmail] = useState<string>("alex@example.com");
  const [riskInfo, setRiskInfo] = useState<RiskInfo | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function handleRegister() {
    try {
      setIsLoading(true);
      setMsg("1) Requesting registration options...");
      setRiskInfo(null);

      const optsRes = await fetch(api("/webauthn/register/options"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email }),
      });

      const optsJson = await optsRes.json();
      if (!optsRes.ok) {
        setMsg(`Options error: ${JSON.stringify(optsJson, null, 2)}`);
        return;
      }

      setMsg("2) Please complete Windows Hello registration...");
      const regResponse = await startRegistration(optsJson.options);

      setMsg("3) Verifying registration...");
      const verifyRes = await fetch(api("/webauthn/register/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(regResponse),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        setMsg(`Verify error: ${JSON.stringify(verifyJson, null, 2)}`);
        return;
      }

      setMsg(`✅ Registration successful! Redirecting to dashboard...`);
      
      // Redirect to dashboard after successful registration
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
      
    } catch (e: any) {
      setMsg(`Register Failed: ${e?.message ?? String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin() {
    try {
      setIsLoading(true);
      setRiskInfo(null);
      setMsg("1) Requesting login options...");

      const res = await fetch(api("/webauthn/login/options"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg(`Login options error:\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      setMsg("2) Please complete Windows Hello verification...");
      const assertion = await startAuthentication(json.options);

      setMsg("3) Verifying login...");
      const verifyRes = await fetch(api("/webauthn/login/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assertion),
      });

      const verifyJson = await verifyRes.json();

      const nextRiskInfo: RiskInfo = {
        score: verifyJson.riskScore ?? 0,
        level: verifyJson.riskLevel ?? "unknown",
        reasons: verifyJson.reasons ?? [],
      };

      setRiskInfo(nextRiskInfo);

      if (!verifyRes.ok) {
        setMsg(`Login verify error:\n${JSON.stringify(verifyJson, null, 2)}`);
        return;
      }

      if (verifyJson.requiresOtp) {
        sessionStorage.setItem("otp_username", username);
        sessionStorage.setItem("otp_risk_info", JSON.stringify(nextRiskInfo));
        navigate("/otp");
        return;
      }

      setMsg("✅ Login successful. Redirecting...");
      navigate("/dashboard");
    } catch (e: any) {
      setMsg(`❌ Login failed: ${e?.message ?? String(e)}`);
    } finally {
      setIsLoading(false);
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
          justifyContent: "space-between",
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
            maxWidth: 420,
            background: "rgba(15, 23, 42, 0.72)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 25px 80px rgba(2, 6, 23, 0.45)",
            backdropFilter: "blur(18px)",
            borderRadius: 20,
            padding: 28,
          }}
        >
          {msg && (
            <div
              style={{
                marginTop: 18,
                padding: "12px 16px",
                backgroundColor: msg.startsWith("✅") ? "#34d399" : msg.startsWith("❌") ? "#f87171" : "#2563eb",
                borderRadius: 8,
                color: "white",
                fontSize: 14,
              }}
            >
              <strong>{msg.startsWith("✅") ? "Success:" : msg.startsWith("❌") ? "Error:" : "Please wait..."}</strong> {msg}
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: 24 }}>
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
              🔐
            </div>

            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>
              {isRegisterMode ? "Create Your Account" : "Welcome Back"}
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
              {isRegisterMode
                ? "Register your device securely using Windows Hello passkey."
                : "Enter your username to verify securely with your Windows Hello passkey."}
            </p>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#cbd5e1",
                }}
              >
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(59,130,246,0.35)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#f8fafc",
                  fontSize: 15,
                  outline: "none",
                }}
              />
            </div>

            {isRegisterMode && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#cbd5e1",
                  }}
                >
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "13px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(59,130,246,0.35)",
                    background: "rgba(15, 23, 42, 0.9)",
                    color: "#f8fafc",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
              </div>
            )}

            <button
              onClick={isRegisterMode ? handleRegister : handleLogin}
              disabled={isLoading || !username.trim() || (isRegisterMode && !email.trim())}
              style={{
                marginTop: 2,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "white",
                fontSize: 15,
                fontWeight: 700,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
              }}
            >
              {isLoading
                ? "Please wait..."
                : isRegisterMode
                ? "Register with Windows Hello"
                : "Continue with Windows Hello"}
            </button>

            <button
              onClick={() => {
                setIsRegisterMode((prev) => !prev);
                setMsg("");
                setRiskInfo(null);
              }}
              type="button"
              style={{
                marginTop: 2,
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {isRegisterMode
                ? "Already registered? Back to login"
                : "New user? Register your device"}
            </button>
          </div>

          {riskInfo && (
            <div
              style={{
                marginTop: 20,
                borderRadius: 14,
                padding: 14,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#f8fafc" }}>
                Risk Assessment
              </div>
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7 }}>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Level:</strong> {riskInfo.level}
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Score:</strong> {riskInfo.score}
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
              marginTop: 22,
              textAlign: "center",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Secured by Windows Hello
          </div>
        </div>
      </main>
    </div>
  );
}