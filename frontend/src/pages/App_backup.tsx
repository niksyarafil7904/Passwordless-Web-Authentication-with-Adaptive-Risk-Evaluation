import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";

// Same-origin mode
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

export default function App() {
  const [msg, setMsg] = useState<string>("");

  // dynamic user input
  const [username, setUsername] = useState<string>("alex");
  const [email, setEmail] = useState<string>("alex@example.com");

  // OTP state
  const [otpCode, setOtpCode] = useState<string>("");
  const [requiresOtp, setRequiresOtp] = useState<boolean>(false);

  // risk info state
  const [riskInfo, setRiskInfo] = useState<null | {
    score: number;
    level: string;
    reasons: string[];
  }>(null);

  async function handleRegister() {
    try {
      setMsg("1) Requesting registration options...");
      setRiskInfo(null);

      const optsRes = await fetch(api("/webauthn/register/options"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
        }),
      });

      const optsJson = await optsRes.json();
      if (!optsRes.ok) {
        setMsg(`Options error: ${JSON.stringify(optsJson, null, 2)}`);
        return;
      }

      const options = optsJson.options;

      setMsg("2) Starting Windows Hello / Passkey prompt...");
      const regResponse = await startRegistration(options);

      setMsg("3) Sending response to server for verification...");
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

      setMsg(`✅ Register Success:\n${JSON.stringify(verifyJson, null, 2)}`);
    } catch (e: any) {
      setMsg(`❌ Register Failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleLogin() {
    try {
      setRequiresOtp(false);
      setOtpCode("");
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

      setMsg("2) Starting Windows Hello / Passkey prompt...");
      const assertion = await startAuthentication(json.options);

      setMsg("3) Verifying assertion on server...");
      const verifyRes = await fetch(api("/webauthn/login/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assertion),
      });

      const verifyJson = await verifyRes.json();

      setRiskInfo({
        score: verifyJson.riskScore ?? 0,
        level: verifyJson.riskLevel ?? "unknown",
        reasons: verifyJson.reasons ?? [],
      });

      if (!verifyRes.ok) {
        setMsg(`Login verify error:\n${JSON.stringify(verifyJson, null, 2)}`);
        return;
      }

      // HIGH RISK → OTP required
      if (verifyJson.requiresOtp) {
        setRequiresOtp(true);
        setOtpCode("");

        setMsg(
          `⚠️ High-risk login detected.\nOTP sent to your email.\n\n` +
            `Risk Level: ${verifyJson.riskLevel ?? "unknown"}\n` +
            `Risk Score: ${verifyJson.riskScore ?? 0}\n` +
            `Reasons: ${(verifyJson.reasons ?? []).join(", ")}`,
        );
        return;
      }

      // LOW risk → login success
      const meRes = await fetch(api("/me"), { credentials: "include" });
      const meJson = await meRes.json();

      setMsg(
        `✅ Login success:\n${JSON.stringify(verifyJson, null, 2)}\n\n` +
          `/me:\n${JSON.stringify(meJson, null, 2)}`,
      );
    } catch (e: any) {
      setMsg(`❌ Login failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleVerifyOtp() {
    try {
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

      setRequiresOtp(false);
      setOtpCode("");
      setRiskInfo(null);

      const meRes = await fetch(api("/me"), { credentials: "include" });
      const meJson = await meRes.json();

      setMsg(
        `✅ OTP verified successfully:\n${JSON.stringify(json, null, 2)}\n\n` +
          `/me:\n${JSON.stringify(meJson, null, 2)}`,
      );
    } catch (e: any) {
      setMsg(`❌ OTP verification failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleResendOtp() {
    try {
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

      setOtpCode("");

      setMsg(
        `✅ OTP resent successfully:\n${JSON.stringify(json, null, 2)}\n\n` +
          `Please check your email for the new code.`,
      );
    } catch (e: any) {
      setMsg(`❌ Resend OTP failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleMe() {
    try {
      const meRes = await fetch(api("/me"), { credentials: "include" });
      const meJson = await meRes.json();
      setMsg(`🧾 /me:\n${JSON.stringify(meJson, null, 2)}`);
    } catch (e: any) {
      setMsg(`❌ /me failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleLogout() {
    try {
      setMsg("Logging out...");

      const res = await fetch(api("/logout"), {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg(`Logout error:\n${JSON.stringify(json, null, 2)}`);
        return;
      }

      setRequiresOtp(false);
      setOtpCode("");
      setRiskInfo(null);

      const meRes = await fetch(api("/me"), { credentials: "include" });
      const meJson = await meRes.json();

      setMsg(
        `✅ Logout response:\n${JSON.stringify(json, null, 2)}\n\n` +
          `After logout, /me:\n${JSON.stringify(meJson, null, 2)}`,
      );
    } catch (e: any) {
      setMsg(`❌ Logout failed: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Passkey + Step-up OTP Test</h2>

      <div style={{ marginBottom: 12 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={{ marginRight: 8 }}
        />

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={handleRegister}>Register</button>
        <button onClick={handleLogin}>Login</button>
        <button onClick={handleMe}>Check /me</button>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {riskInfo && (
        <div
          style={{
            marginTop: 16,
            maxWidth: 420,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Risk Assessment</h3>
          <p>
            <strong>Level:</strong> {riskInfo.level}
          </p>
          <p>
            <strong>Score:</strong> {riskInfo.score}
          </p>
          <p>
            <strong>Reasons:</strong>
          </p>
          {riskInfo.reasons.length > 0 ? (
            <ul style={{ marginTop: 0 }}>
              {riskInfo.reasons.map((reason) => (
                <li key={reason}>{formatRiskReason(reason)}</li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 0 }}>No unusual factors detected.</p>
          )}
        </div>
      )}

      {requiresOtp && (
        <div style={{ marginTop: 16, maxWidth: 320 }}>
          <h3>Step-up OTP Required</h3>
          <p>Enter the 6-digit code sent to your email.</p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter OTP"
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleVerifyOtp} disabled={otpCode.length !== 6}>
              Verify OTP
            </button>

            <button onClick={handleResendOtp}>Resend OTP</button>
          </div>
        </div>
      )}

      <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{msg}</pre>
    </div>
  );
}