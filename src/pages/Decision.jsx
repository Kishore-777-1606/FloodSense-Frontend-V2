import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Cloud,
  Clock,
  MapPin,
  ArrowLeft,
  Download,
  Shield,
  Info,
  Compass
} from "lucide-react";

import Navbar from "../components/Navbar";
import { useWard1Live } from "../context/Ward1LiveContext";
import { getRiskData, getWardHistory } from "../services/api";
import "../styles/shared.css";
import "../styles/Decision.css";

function getPriorityStyle(priority) {
  const p = (priority || "").toUpperCase();
  if (p === "CRITICAL" || p === "HIGH") {
    return { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" };
  }
  if (p === "MEDIUM") {
    return { color: "#f97316", bg: "#fff7ed", border: "#fdba74" };
  }
  if (p === "LOW") {
    return { color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" };
  }
  return { color: "#10b981", bg: "#f0fdf4", border: "#86efac" };
}

function formatEvidenceItem(key, val, evidence = {}) {
  // Never display ambiguous or redundant threshold_mm
  if (key === "threshold_mm") {
    return null;
  }

  // Handle missing or undefined values honestly
  if (val === undefined || val === null || val === "") {
    return { label: key.replace(/_/g, " "), text: "Unavailable" };
  }

  switch (key) {
    case "burst_threshold_mm": {
      const win = evidence.trigger_window || "1-hour";
      return {
        label: `${win} burst threshold`,
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    }
    case "active_rain_gate_threshold_mm":
      return {
        label: "8-hour active-rain threshold",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "threshold_8h_mm":
      return {
        label: "8-hour active-rain threshold",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "rainfall_1h_mm":
      return {
        label: "1-hour rainfall",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "rainfall_3h_mm":
      return {
        label: "3-hour rainfall",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "rainfall_8h_mm":
      return {
        label: "8-hour rainfall",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "rainfall_24h_mm":
      return {
        label: "24-hour rainfall",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "burst_category":
      return {
        label: "Burst category",
        text: String(val)
      };
    case "trigger_window":
      return {
        label: "Observation window",
        text: String(val)
      };
    case "trigger_type":
      return {
        label: "Trigger rule",
        text: String(val)
      };
    case "trigger_criterion":
      return {
        label: "Trigger criterion",
        text: String(val)
      };
    case "active_rainfall_factor":
      return {
        label: "Active rain factor (α)",
        text: `${typeof val === "number" ? val.toFixed(2) : val}x`
      };
    case "saturation_ratio":
      return {
        label: "Saturation proxy",
        text: `${typeof val === "number" ? (val * 100).toFixed(1) : val}%`
      };
    case "decayed_antecedent_mm":
      return {
        label: "Antecedent rainfall",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "water_distance_km":
      return {
        label: "Water distance",
        text: `${typeof val === "number" ? val.toFixed(2) : val} km`
      };
    case "distance_threshold_km":
      return {
        label: "Distance threshold",
        text: `${typeof val === "number" ? val.toFixed(1) : val} km`
      };
    case "final_risk_score":
      return {
        label: "Final risk score",
        text: `${typeof val === "number" ? val.toFixed(1) : val} / 200`
      };
    case "base_score":
      return {
        label: "Base ML score",
        text: `${typeof val === "number" ? val.toFixed(1) : val} / 200`
      };
    case "high_risk_threshold":
      return {
        label: "High-risk threshold",
        text: `${typeof val === "number" ? val.toFixed(1) : val}`
      };
    case "low_risk_threshold":
      return {
        label: "Low-risk threshold",
        text: `${typeof val === "number" ? val.toFixed(1) : val}`
      };
    case "recent_0_8h_tranche_mm":
      return {
        label: "0–8h recent tranche",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "past_24_72h_mm":
      return {
        label: "24–72h past tranche",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    case "total_72h_mm":
      return {
        label: "72-hour total",
        text: `${typeof val === "number" ? val.toFixed(1) : val} mm`
      };
    default:
      return {
        label: key.replace(/_/g, " "),
        text: typeof val === "number" ? val.toFixed(1) : String(val)
      };
  }
}

export default function Decision() {
  const navigate = useNavigate();
  const { telemetry: ward1Telemetry } = useWard1Live();
  const [allWards, setAllWards] = useState(() => {
    try {
      const storedData = localStorage.getItem("riskData");
      return storedData ? JSON.parse(storedData) : [];
    } catch {
      return [];
    }
  });

  const [selectedWard, setSelectedWard] = useState(() => {
    try {
      const storedSelected = localStorage.getItem("selectedWard");
      if (storedSelected) return JSON.parse(storedSelected);
      const storedData = localStorage.getItem("riskData");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed.length > 0) {
          return [...parsed].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Always fetch fresh risk data and ward actions from API on mount
  useEffect(() => {
    let isMounted = true;
    getRiskData()
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        setAllWards(data);
        localStorage.setItem("riskData", JSON.stringify(data));
        setSelectedWard((prev) => {
          if (prev && prev.ward_no) {
            const updated = data.find((w) => w.ward_no === prev.ward_no);
            return updated ? { ...prev, ...updated } : prev;
          }
          if (data.length > 0) {
            const sorted = [...data].sort((a, b) => (b.score || 0) - (a.score || 0));
            return sorted[0];
          }
          return null;
        });
      })
      .catch((err) => console.warn("Could not refresh get-risk:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Whenever selectedWard changes, fetch detailed actions from ward-history
  useEffect(() => {
    const wardNo = selectedWard?.ward_no;
    if (!wardNo) return;
    let isMounted = true;
    getWardHistory(wardNo)
      .then((data) => {
        if (!isMounted || !data) return;
        setSelectedWard((prev) => ({ ...prev, ...data }));
      })
      .catch((err) => console.warn(`Could not refresh ward-history/${wardNo}:`, err));
    return () => {
      isMounted = false;
    };
  }, [selectedWard?.ward_no]);

  // Synchronize Ward 1 actions when new telemetry arrives if Ward 1 is active
  useEffect(() => {
    if (!ward1Telemetry || Number(selectedWard?.ward_no) !== 1) return;
    let isMounted = true;
    getWardHistory(1)
      .then((data) => {
        if (!isMounted || !data) return;
        setSelectedWard((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [ward1Telemetry?.received_at_iso, selectedWard?.ward_no]);

  const totalWards = allWards.length;
  const highRisk = allWards.filter((w) => w.level === "HIGH");
  const mediumRisk = allWards.filter((w) => w.level === "MEDIUM");
  const lowRisk = allWards.filter((w) => w.level === "LOW");

  const topHighRisk = highRisk.length > 0
    ? [...highRisk].sort((a, b) => b.score - a.score).slice(0, 7)
    : [...mediumRisk].sort((a, b) => b.score - a.score).slice(0, 7);

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const formattedTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

  const activeWard = selectedWard || (topHighRisk.length > 0 ? topHighRisk[0] : null);
  const currentActions = activeWard?.action_support?.actions || [];

  // Categorize action priorities for summary
  const highPriorityActionsCount = currentActions.filter((a) => a.priority === "HIGH" || a.priority === "CRITICAL").length;
  const medPriorityActionsCount = currentActions.filter((a) => a.priority === "MEDIUM").length;
  const lowPriorityActionsCount = currentActions.filter((a) => a.priority === "LOW").length;
  const routineActionsCount = currentActions.filter((a) => a.priority === "ROUTINE").length;

  const handleSelectWard = (w) => {
    setSelectedWard(w);
    localStorage.setItem("selectedWard", JSON.stringify(w));
    getWardHistory(w.ward_no)
      .then((data) => {
        setSelectedWard((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  };

  const handleDownload = () => {
    if (!activeWard) return;

    const lines = [
      "============================================================",
      "   FLOODSENSE — OPERATIONAL DECISION SUPPORT ADVISORY PLAN",
      "============================================================",
      `Generated: ${formattedDate} ${formattedTime}`,
      `Selected Ward: ${activeWard.ward_name} (Ward ${activeWard.ward_no})`,
      `Modeled Risk Level: ${activeWard.level || "LOW"}`,
      `Final Risk Score: ${activeWard.score ? Number(activeWard.score).toFixed(1) : 0} / 200 (Base: ${activeWard.base_score ? Number(activeWard.base_score).toFixed(1) : 0})`,
      `Hydrological Momentum Multiplier: ${activeWard.flood_momentum?.momentum_multiplier || 1.0}x`,
      "",
      "=== EVIDENCE-BASED ADVISORY ACTIONS ===",
      ...currentActions.flatMap((a, idx) => [
        `[Action ${idx + 1}] ${a.action_description}`,
        `  - Identifier: ${a.action_id}`,
        `  - Category: ${a.category}`,
        `  - Priority: ${a.priority}`,
        `  - Triggering Evidence: ${JSON.stringify(a.triggering_evidence)}`,
        `  - Rationale: ${a.rationale}`,
        `  - Verification Note: ${a.verification_note || "None"}`,
        ""
      ]),
      "=== CITY-WIDE HIGH-RISK PRIORITIES ===",
      ...topHighRisk.map((w, i) =>
        `${i + 1}. ${w.ward_name} (Ward ${w.ward_no}) | Score: ${Math.round(w.score)}/200 | Reason: ${w.reason || ""}`
      ),
      "",
      "=== OPERATIONAL DISCLAIMER ===",
      "Advisories are generated deterministically from predictive model scores, rainfall momentum, and spatial coordinates.",
      "They represent operational decision-support recommendations and do not command emergency evacuations or assert observed inundation.",
      "Physical verification by municipal field personnel is required prior to equipment dispatch.",
      "============================================================"
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FloodSense_AdvisoryPlan_Ward_${activeWard.ward_no}_${formattedDate.replace(/ /g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fs-page-layout">
      <Navbar />
      <div className="fs-page-main">

        {/* HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <h1>Decision Support Engine</h1>
            <p>Deterministic evidence-based municipal advisory actions · {formattedDate}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <Cloud size={14} />
              <span>Ward:</span>
              <strong>{activeWard?.ward_name || "None"}</strong>
            </div>
            <div className="fs-header-badge">
              <Clock size={14} />
              <strong>{formattedTime}</strong>
            </div>
            <button className="fs-btn primary" onClick={handleDownload}>
              <Download size={14} /> Download Advisory Plan
            </button>
          </div>
        </header>

        {/* KPI ROW */}
        <div className="fs-kpi-row">
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon red"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">High Risk Wards</div>
              <div className="fs-kpi-value red">{highRisk.length}</div>
              <div className="fs-kpi-sub">Score &ge; 120.0 · Field Verification</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon orange"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Medium Risk Wards</div>
              <div className="fs-kpi-value orange">{mediumRisk.length}</div>
              <div className="fs-kpi-sub">Score 80–120 · Monitor & Prep</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon green"><Shield size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Low Risk Wards</div>
              <div className="fs-kpi-value green">{lowRisk.length}</div>
              <div className="fs-kpi-sub">Score &lt; 80.0 · Preventive Maintenance</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon blue"><Compass size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Total Wards</div>
              <div className="fs-kpi-value blue">{totalWards}</div>
              <div className="fs-kpi-sub">Evaluated by Risk Engine</div>
            </div>
          </div>
        </div>

        <div className="fs-content">
          <div className="decision-lower-grid">
            {/* LEFT COLUMN: HIGH RISK PRIORITY TABLE */}
            <div className="decision-left-col">

              {/* RISK TABLE */}
              <div className="fs-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>
                      High & Medium Risk Priority List
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Click a ward to view its specific advisory actions
                  </span>
                </div>
                <div className="fs-table-wrap" style={{ borderRadius: 0, border: "none" }}>
                  <table className="fs-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ward</th>
                        <th>Risk Score</th>
                        <th>Primary Reason</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topHighRisk.map((w, index) => {
                        const isSelected = activeWard?.ward_no === w.ward_no;
                        return (
                          <tr
                            key={w.ward_no}
                            onClick={() => handleSelectWard(w)}
                            style={{
                              cursor: "pointer",
                              backgroundColor: isSelected ? "#eff6ff" : undefined
                            }}
                          >
                            <td style={{ fontWeight: 700, color: "#64748b", width: "32px" }}>{index + 1}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <MapPin size={13} style={{ color: isSelected ? "#1e88e5" : "#ef4444", flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: "0.84rem", color: isSelected ? "#1e40af" : undefined }}>
                                    {w.ward_name}
                                  </div>
                                  <div style={{ fontSize: "0.71rem", color: "#94a3b8" }}>Ward {w.ward_no}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, color: w.level === "HIGH" ? "#ef4444" : "#f97316" }}>
                                {Math.round(w.score)}
                              </span>
                              <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}> / 200</span>
                            </td>
                            <td style={{ fontSize: "0.78rem", color: "#64748b", maxWidth: "160px" }}>
                              {w.reason || "Evaluated by risk engine"}
                            </td>
                            <td>
                              <span className={`fs-badge ${w.level === "HIGH" ? "high" : "medium"}`}>
                                {w.level || "LOW"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.76rem", color: "#475569" }}>
                  <Info size={14} style={{ color: "#3b82f6" }} />
                  Selected ward: <strong>{activeWard?.ward_name || "None"}</strong>. Generating deterministic actions based on local rainfall momentum and geographic parameters.
                </div>
              </div>

              {/* ACTION FOOTER ROW */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button className="fs-btn secondary" onClick={() => navigate("/analysis")}>
                  <ArrowLeft size={15} /> Back to Analysis
                </button>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "7px", fontSize: "0.76rem", color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "8px 12px" }}>
                  <Shield size={14} style={{ color: "#3b82f6" }} />
                  Advisory recommendations are evidence-based and require physical zonal field confirmation.
                </div>
                <button className="fs-btn primary" onClick={handleDownload}>
                  <Download size={15} /> Download Plan
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: WARD-SPECIFIC ADVISORY ACTIONS & PROTOCOL SUMMARY */}
            <div className="decision-right-col">

              {/* ACTIVE WARD ADVISORY ACTIONS */}
              <div className="fs-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Shield size={16} style={{ color: "#1e88e5" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>
                      Ward Advisory Actions: {activeWard?.ward_name || `Ward ${activeWard?.ward_no}`}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    {currentActions.length} Evidence-Based Actions
                  </span>
                </div>

                <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {currentActions.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                      No acute advisories triggered. Maintain routine ward drainage monitoring.
                    </div>
                  ) : (
                    currentActions.map((action, idx) => {
                      const pStyle = getPriorityStyle(action.priority);
                      return (
                        <div
                          key={action.action_id || idx}
                          className="decision-action-card"
                          style={{ borderLeftColor: pStyle.color }}
                        >
                          <div className="decision-action-top">
                            <span
                              className="action-priority-chip"
                              style={{ color: pStyle.color, background: pStyle.bg, borderColor: pStyle.border }}
                            >
                              {action.priority} PRIORITY
                            </span>
                            <span className="action-category-code">{action.category}</span>
                          </div>

                          <h3 className="decision-action-headline">{action.action_description}</h3>

                          {/* Triggering Evidence Box */}
                          {action.triggering_evidence && (
                            <div className="action-evidence-box">
                              <span className="action-evidence-title">Triggering Evidence:</span>
                              <div className="evidence-tags">
                                {Object.entries(action.triggering_evidence)
                                  .map(([key, val]) => formatEvidenceItem(key, val, action.triggering_evidence))
                                  .filter(Boolean)
                                  .map((item, idx) => (
                                    <span key={idx} className="evidence-pill">
                                      <strong>{item.label}:</strong> {item.text}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                          <p className="decision-action-rationale">
                            <strong>Rationale:</strong> {action.rationale}
                          </p>

                          {action.verification_note && (
                            <p className="decision-action-note">
                              <strong>Verification Note:</strong> {action.verification_note}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* OPERATIONAL PROTOCOL & READINESS SUMMARY (REPLACES MOCK RESOURCES) */}
              <div className="fs-card">
                <div className="fs-card-label">Advisory Protocol Checklist (Selected Ward)</div>
                <p style={{ fontSize: "0.76rem", color: "#64748b", margin: "4px 0 12px" }}>
                  Operational readiness tally based on active ward triggers (no fabricated resource counts):
                </p>
                <div className="decision-resource-grid">
                  <div className="protocol-summary-item" style={{ borderLeft: "3px solid #ef4444" }}>
                    <span className="protocol-count" style={{ color: "#ef4444" }}>{highPriorityActionsCount}</span>
                    <span className="protocol-label">High Priority Actions</span>
                    <span className="protocol-sub">Immediate inspection / readiness</span>
                  </div>

                  <div className="protocol-summary-item" style={{ borderLeft: "3px solid #f97316" }}>
                    <span className="protocol-count" style={{ color: "#f97316" }}>{medPriorityActionsCount}</span>
                    <span className="protocol-label">Medium Priority Actions</span>
                    <span className="protocol-sub">Drainage outfall & collector check</span>
                  </div>

                  <div className="protocol-summary-item" style={{ borderLeft: "3px solid #3b82f6" }}>
                    <span className="protocol-count" style={{ color: "#3b82f6" }}>{lowPriorityActionsCount}</span>
                    <span className="protocol-label">Monitoring Actions</span>
                    <span className="protocol-sub">Passive antecedent ground watch</span>
                  </div>

                  <div className="protocol-summary-item" style={{ borderLeft: "3px solid #10b981" }}>
                    <span className="protocol-count" style={{ color: "#10b981" }}>{routineActionsCount}</span>
                    <span className="protocol-label">Routine Maintenance</span>
                    <span className="protocol-sub">Scheduled catch-pit cleaning</span>
                  </div>
                </div>

                <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.45 }}>
                  <strong>Operational Policy Notice:</strong> FloodSense recommendations support municipal prioritization.
                  They do not assert confirmed inundation or mandate emergency evacuation without physical on-site verification.
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
