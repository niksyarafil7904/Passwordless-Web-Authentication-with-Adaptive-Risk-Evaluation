import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// API calls
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

function api(path: string) {
  if (!API_BASE_URL || API_BASE_URL === "/") return path;
  return `${API_BASE_URL}${path}`;
}

function formatRiskReason(reason: string) {
  switch (reason) {
    case "new_device":
      return "New device detected (+40)";
    case "new_ip":
      return "New IP address detected (+20)";
    case "new_country":
      return "New country detected (+45)";
    case "new_region":
      return "New region detected (+10)";
    case "unusual_time":
      return "Unusual login time detected (+10)";
    case "insufficient_history_for_location_check":
      return "Insufficient history for location check";
    case "insufficient_history_for_time_check":
      return "Insufficient history for time check";
    default:
      return reason;
  }
}

type Device = {
  id: string;
  name: string;
  os: string;
  lastActive: string;
  isCurrentDevice: boolean;
};

type Activity = {
  event: string;
  device: string;
  location: string;
  timestamp: string;
  riskScore?: number;
  riskLevel?: string;
  riskReasons?: string[];
};

export default function UserDashboardPage() {
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState<{ username: string; email: string }>({
    username: "",
    email: "",
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Check authentication on mount
  useEffect(() => {
    fetch(api("/me"), { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          console.log("User data:", data);
          setUserInfo({
            username: data.username,
            email: data.email,
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
        navigate("/login");
      });
  }, [navigate]);

  useEffect(() => {
    // Fetch trusted devices
    fetch(api("/devices"), { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          console.log("Devices data:", data);
          setDevices(data.devices);
        }
      })
      .catch((error) => {
        console.error("Error fetching devices:", error);
      });

    // Fetch recent security activity
    fetch(api("/activity"), { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          console.log("Activity data:", data);
          setActivity(data.activities);
        }
      })
      .catch((error) => {
        console.error("Error fetching activity:", error);
      });
  }, [navigate]);

  const toggleRow = (index: number) => {
    console.log("Toggling row:", index); // Debug log
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  async function handleRemoveDevice(deviceId: string) {
    try {
      const res = await fetch(api(`/devices/remove/${deviceId}`), {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      
      if (res.ok) {
        setDevices((prevDevices) =>
          prevDevices.filter((device) => device.id !== deviceId)
        );
      }
    } catch (error) {
      console.error("Error removing device:", error);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      console.log("Logging out...");
      const response = await fetch(api("/logout"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Logout response status:", response.status);
      const data = await response.json();
      console.log("Logout response data:", data);
      
      if (response.ok) {
        sessionStorage.clear();
        navigate("/login");
      } else {
        console.error("Logout failed:", data);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  }

  // Helper to get risk color (only low and high)
  const getRiskColor = (level?: string, score?: number) => {
    if (level === 'high' || (score && score >= 60)) return '#ef4444'; // red for high risk
    return '#10b981'; // green for low risk
  };

  // Helper to check if row has expandable content
  const hasExpandableContent = (item: Activity) => {
    return item.riskReasons && item.riskReasons.length > 0;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "Inter, system-ui", color: "#f8fafc" }}>
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            S
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>AuthSystem</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></span>
            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 500 }}>System Operational</span>
          </div>
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              background: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              padding: "6px 14px",
              borderRadius: 8,
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.2s",
              opacity: isLoggingOut ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoggingOut) {
                e.currentTarget.style.background = "#ef4444";
                e.currentTarget.style.color = "white";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#ef4444";
            }}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
        
        <section style={{ 
          background: "#1e293b", 
          borderRadius: 16, 
          padding: "24px 32px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 40,
          border: "1px solid #334155"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative" }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                borderRadius: "50%", 
                background: "#334155", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 600,
                color: "#94a3b8",
                overflow: "hidden",
                border: "2px solid #475569"
              }}>
                {userInfo?.username ? userInfo.username.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ 
                position: "absolute", bottom: 2, right: 2, 
                width: 16, height: 16, borderRadius: "50%", 
                background: "#3b82f6", border: "2px solid #1e293b" 
              }}></div>
            </div>

            <div>
              <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
                Welcome back, {userInfo.username}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>{userInfo.email}</p>
                <span style={{ color: "#3b82f6", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>●</span> Passwordless Enabled
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate("/profile")}
            style={{
              background: "transparent",
              border: "none",
              color: "#3b82f6",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Edit Profile
          </button>
        </section>

        {/* Trusted Devices */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Trusted Devices</h3>
            <button
              onClick={() => navigate("/add-device")}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add New Device
            </button>
          </div>

          {devices.length > 0 ? devices.map((device) => (
            <div
              key={device.id}
              style={{
                background: "#1e293b",
                padding: "16px 20px",
                borderRadius: 12,
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #334155"
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ color: "#94a3b8" }}>💻</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16 }}>
                    {device.name} 
                    {device.isCurrentDevice && (
                      <span style={{ marginLeft: 8, background: "#1e3a8a", color: "#60a5fa", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>
                        THIS DEVICE
                      </span>
                    )}
                  </h4>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0 0" }}>
                    {device.os} • Last active: {device.lastActive}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveDevice(device.id)}
                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
              >
                🗑️
              </button>
            </div>
          )) : (
            <p style={{ color: "#64748b", fontSize: 14 }}>No trusted devices found.</p>
          )}
        </div>

        {/* Recent Security Activity Table */}
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Recent Security Activity</h3>
          <div style={{ background: "#1e293b", borderRadius: 12, overflow: "auto", border: "1px solid #334155" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", textAlign: "left" }}>
                  <th style={{ padding: "16px", color: "#94a3b8", fontWeight: 500 }}>Event</th>
                  <th style={{ padding: "16px", color: "#94a3b8", fontWeight: 500 }}>Device</th>
                  <th style={{ padding: "16px", color: "#94a3b8", fontWeight: 500 }}>Location</th>
                  <th style={{ padding: "16px", color: "#94a3b8", fontWeight: 500 }}>Risk Score</th>
                  <th style={{ padding: "16px", color: "#94a3b8", fontWeight: 500 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((item, index) => {
                  const expandable = hasExpandableContent(item);
                  return (
                    <React.Fragment key={index}>
                      <tr 
                        onClick={() => expandable && toggleRow(index)}
                        style={{ 
                          borderBottom: index !== activity.length - 1 ? "1px solid #334155" : "none",
                          cursor: expandable ? "pointer" : "default",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          if (expandable) {
                            e.currentTarget.style.background = "#334155";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "16px" }}>
                          <span style={{ marginRight: 8 }}>●</span> {item.event}
                        </td>
                        <td style={{ padding: "16px", color: "#94a3b8" }}>{item.device}</td>
                        <td style={{ padding: "16px", color: "#94a3b8" }}>{item.location}</td>
                        <td style={{ padding: "16px" }}>
                          {item.riskScore !== undefined ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span 
                                style={{ 
                                  width: 10, 
                                  height: 10, 
                                  borderRadius: "50%", 
                                  background: getRiskColor(item.riskLevel, item.riskScore),
                                  display: "inline-block"
                                }} 
                              />
                              <span style={{ 
                                color: item.riskLevel === 'high' || (item.riskScore >= 60) ? "#ef4444" : "#10b981",
                                fontWeight: 600
                              }}>
                                {item.riskScore}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "16px", color: "#94a3b8" }}>{item.timestamp}</td>
                      </tr>
                      {expandedRows.has(index) && item.riskReasons && item.riskReasons.length > 0 && (
                        <tr style={{ background: "#0f172a" }}>
                          <td colSpan={5} style={{ padding: "16px 16px 16px 32px", borderTop: "1px solid #334155" }}>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>
                              <strong style={{ color: "#f8fafc" }}>🔍 Risk Factors:</strong>
                              <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                                {item.riskReasons.map((reason, i) => (
                                  <li key={i} style={{ marginBottom: 4 }}>{formatRiskReason(reason)}</li>
                                ))}
                              </ul>
                              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                                💡 {item.riskScore && item.riskScore >= 60 ? 
                                  "High risk (60+ points) requires OTP verification." : 
                                  "Low risk (0-59 points) allows direct access."}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}