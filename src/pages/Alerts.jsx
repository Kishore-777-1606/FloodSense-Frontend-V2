import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, AlertTriangle, CheckCircle, Clock, MapPin, Shield,
  CloudRain, Volume2, PhoneCall, Radio, Siren,
  ChevronRight, Users, Activity,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { getRiskData } from "../services/api";
import "../styles/shared.css";
import "../styles/Alerts.css";

function getAlertLevel(score) {
  if (score >= 120) return { label: "HIGH", color: "#ef4444", bg: "#fef2f2", icon: <AlertTriangle size={14} /> };
  if (score >= 80) return { label: "MEDIUM", color: "#f97316", bg: "#fff7ed", icon: <AlertTriangle size={14} /> };
  return { label: "LOW", color: "#22c55e", bg: "#f0fdf4", icon: <CheckCircle size={14} /> };
}

function getTimeSince(minutes) {
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

export default function Alerts() {
  const navigate = useNavigate();
  const [allWards, setAllWards] = useState(() => {
    try {
      const stored = localStorage.getItem("riskData");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState("ALL");
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
  const [now] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    getRiskData()
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setAllWards(data);
        localStorage.setItem("riskData", JSON.stringify(data));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const rainfall = allWards.length
    ? Math.round(allWards.reduce((s, w) => s + (w.rainfall || 0), 0) / allWards.length)
    : 0;
  const highRisk = allWards.filter((w) => w.level === "HIGH");
  const medRisk = allWards.filter((w) => w.level === "MEDIUM");

  // Build alerts from ward data with deterministic timestamp offsets
  const allAlerts = [
    ...highRisk.map((w) => ({
      id: `H-${w.ward_no}`,
      wardNo: w.ward_no,
      wardName: w.ward_name,
      level: "HIGH",
      score: w.score,
      message: w.reason || `High flood risk detected. Rainfall: ${w.rainfall} mm, Elevation: ${w.elevation} m`,
      minutesAgo: ((Number(w.ward_no) * 7) % 15) + 2,
      type: "FLOOD_RISK",
    })),
    ...medRisk.slice(0, 5).map((w) => ({
      id: `M-${w.ward_no}`,
      wardNo: w.ward_no,
      wardName: w.ward_name,
      level: "MEDIUM",
      score: w.score,
      message: `Moderate risk. Monitor water levels. Rainfall: ${w.rainfall} mm`,
      minutesAgo: ((Number(w.ward_no) * 11) % 25) + 10,
      type: "WATCH",
    })),
    {
      id: "SYS-1",
      wardNo: null,
      wardName: "System",
      level: "INFO",
      score: 0,
      message: `Flood risk prediction complete. Analysed ${allWards.length} wards with ${rainfall} mm rainfall input.`,
      minutesAgo: 1,
      type: "SYSTEM",
    },
  ].sort((a, b) => b.score - a.score);

  const CHANNEL_CONFIGS = [
    { icon: <PhoneCall size={18} />, label: "Emergency Hotline", value: "1800-FLOODS (Active)", color: "#ef4444", status: "LIVE" },
    { icon: <Radio size={18} />, label: "FM Radio Broadcast", value: "FM 90.4 / FM 91.1", color: "#f97316", status: "ACTIVE" },
    { icon: <Volume2 size={18} />, label: "Public Address System", value: "Ward-level speakers", color: "#1e88e5", status: "STANDBY" },
    { icon: <Bell size={18} />, label: "SMS Alerts", value: `${highRisk.length * 500}+ recipients`, color: "#22c55e", status: "SENT" },
  ];

  const filtered = filter === "ALL"
    ? allAlerts
    : filter === "ACTIVE"
      ? allAlerts.filter((a) => !acknowledgedIds.has(a.id))
      : allAlerts.filter((a) => acknowledgedIds.has(a.id));

  const formatTime = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDate = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="fs-page-layout">
      <Navbar />
      <div className="fs-page-main">

        {/* HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <h1>Emergency Alerts Center</h1>
            <p>Real-time flood alerts · {formatDate(now)} · {formatTime(now)}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <CloudRain size={14} /><span>Rainfall:</span><strong>{rainfall} mm</strong>
            </div>
            <div className="fs-header-badge" style={{ background: highRisk.length > 5 ? "#fef2f2" : "#fff7ed", borderColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
              <Bell size={14} /><strong>{highRisk.length} Active Alerts</strong>
            </div>
          </div>
        </header>

        {/* ALERT BANNER */}
        {highRisk.length > 0 && (
          <div className="alert-banner">
            <div className="alert-banner-inner">
              <Siren size={20} className="alert-banner-icon" />
              <div>
                <strong>FLOOD WARNING ACTIVE</strong>
                <span> — {highRisk.length} wards in Chennai are at high flood risk. Emergency teams have been notified.</span>
              </div>
            </div>
            <div className="alert-banner-time">Last updated: {formatTime(now)}</div>
          </div>
        )}

        {/* KPI ROW */}
        <div className="fs-kpi-row">
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon red"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Active Alerts</div>
              <div className="fs-kpi-value red">{highRisk.length + Math.min(5, medRisk.length)}</div>
              <div className="fs-kpi-sub">Unacknowledged</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon orange"><Activity size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">High Risk Zones</div>
              <div className="fs-kpi-value orange">{allWards.filter((w) => w.level === "HIGH").length}</div>
              <div className="fs-kpi-sub">Score 120 or above</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon green"><CheckCircle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Acknowledged</div>
              <div className="fs-kpi-value green">{acknowledgedIds.size}</div>
              <div className="fs-kpi-sub">Alerts confirmed</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon blue"><Users size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Population at Risk</div>
              <div className="fs-kpi-value blue">{(highRisk.length * 12500).toLocaleString("en-IN")}+</div>
              <div className="fs-kpi-sub">Estimated residents</div>
            </div>
          </div>
        </div>

        <div className="fs-content">
          <div className="alerts-grid">
            {/* MAIN ALERTS FEED */}
            <div>
              {/* FILTER TABS */}
              <div className="alerts-filter-row">
                {["ALL", "ACTIVE", "ACKNOWLEDGED"].map((f) => (
                  <button key={f} className={`alerts-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                    {f} {f === "ALL" ? `(${allAlerts.length})` : f === "ACTIVE" ? `(${allAlerts.filter((a) => !acknowledgedIds.has(a.id)).length})` : `(${acknowledgedIds.size})`}
                  </button>
                ))}
              </div>

              {/* ALERT CARDS */}
              <div className="alerts-list">
                {filtered.length === 0 && (
                  <div className="fs-empty">
                    <div className="fs-empty-icon"><Bell size={48} /></div>
                    <h3>No alerts to show</h3>
                    <p>All alerts in this category have been cleared.</p>
                  </div>
                )}
                {filtered.map((alert) => {
                  const alertInfo = getAlertLevel(alert.score);
                  const isAcknowledged = acknowledgedIds.has(alert.id);
                  return (
                    <div key={alert.id} className={`alert-card${isAcknowledged ? " acknowledged" : ""}`}
                      style={{ borderLeftColor: alertInfo.color }}>
                      <div className="alert-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className="fs-badge" style={{
                            background: alertInfo.bg, color: alertInfo.color,
                            border: `1px solid ${alertInfo.color}30`,
                          }}>
                            {alertInfo.icon} {alert.level}
                          </span>
                          {alert.wardName !== "System" && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "#64748b" }}>
                              <MapPin size={12} />{alert.wardName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} /> {getTimeSince(alert.minutesAgo)}
                          </span>
                          {!isAcknowledged && alert.level !== "INFO" && (
                            <button className="alert-ack-btn" onClick={() => {
                              setAcknowledgedIds((prev) => new Set([...prev, alert.id]));
                            }}>
                              Acknowledge
                            </button>
                          )}
                          {isAcknowledged && (
                            <span style={{ fontSize: "0.74rem", color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                              <CheckCircle size={13} /> Done
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="alert-card-msg">{alert.message}</p>
                      {alert.wardNo && (
                        <button className="alert-view-btn" onClick={() => {
                          const w = allWards.find((x) => x.ward_no === alert.wardNo);
                          if (w) { localStorage.setItem("selectedWard", JSON.stringify(w)); navigate("/analysis"); }
                        }}>
                          View Analysis <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: CHANNELS + STATUS */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* ALERT CHANNELS */}
              <div className="fs-card">
                <div className="fs-card-label">Alert Channels</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {CHANNEL_CONFIGS.map((c, i) => (
                    <div key={i} className="channel-row">
                      <div className="channel-icon" style={{ background: c.color + "15", color: c.color }}>{c.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{c.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.value}</div>
                      </div>
                      <span className="channel-status-badge" style={{ background: c.color + "15", color: c.color }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SYSTEM STATUS */}
              <div className="fs-card">
                <div className="fs-card-label">System Status</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { label: "Backend API", status: "ONLINE", color: "#22c55e" },
                    { label: "GIS Map Engine", status: "ONLINE", color: "#22c55e" },
                    { label: "Risk Prediction", status: "RUNNING", color: "#1e88e5" },
                    { label: "Alert Dispatch", status: "ACTIVE", color: "#f97316" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", fontSize: "0.82rem" }}>
                      <span style={{ fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontWeight: 700, color: s.color, fontSize: "0.74rem" }}>● {s.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="fs-card">
                <div className="fs-card-label">Quick Actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button className="fs-btn danger" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setAcknowledgedIds(new Set(allAlerts.map((a) => a.id)));
                    }}>
                    <CheckCircle size={15} /> Acknowledge All Alerts
                  </button>
                  <button className="fs-btn primary" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/decision")}>
                    <Shield size={15} /> Open Decision Support
                  </button>
                  <button className="fs-btn secondary" style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => navigate("/reports")}>
                    View Full Report <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
