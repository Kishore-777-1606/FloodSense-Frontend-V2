import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Cloud, Clock, MapPin, ChevronRight, ArrowLeft,
  Download, Droplets, Users, Truck, Anchor, Bell, Zap, Layers,
  Package, Shield,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import "../styles/shared.css";
import "../styles/Decision.css";

const RECOMMENDED_ACTIONS = [
  {
    id: 1, icon: <Zap size={20} />, title: "Immediate Actions", color: "red",
    actions: [
      "Deploy emergency response teams to HIGH risk wards",
      "Set up mobile pumps at critical flood-prone spots",
      "Ensure rescue equipment availability at all depots",
    ],
  },
  {
    id: 2, icon: <Bell size={20} />, title: "Alert & Communication", color: "orange",
    actions: [
      "Issue flood alerts to all high-risk wards immediately",
      "Notify local authorities and ward-level residents",
      "Activate SMS and public announcement systems",
    ],
  },
  {
    id: 3, icon: <Layers size={20} />, title: "Preventive & Mitigation", color: "blue",
    actions: [
      "Clear stormwater drains and remove blockages",
      "Inspect and reinforce temporary flood barriers",
      "Monitor water levels and river gauges continuously",
    ],
  },
  {
    id: 4, icon: <Package size={20} />, title: "Resource Mobilization", color: "green",
    actions: [
      "Deploy additional pumps and field staff to affected areas",
      "Coordinate with NDRF / SDRF if situation escalates",
      "Pre-position medical kits and relief supplies",
    ],
  },
];

export default function Decision() {
  const navigate = useNavigate();
  const [ward, setWard] = useState(null);

  const allWards = JSON.parse(localStorage.getItem("riskData")) || [];
  const totalWards = allWards.length;
  const highRisk = allWards.filter((w) => w.level === "HIGH");
  const mediumRisk = allWards.filter((w) => w.level === "MEDIUM");
  const lowRisk = allWards.filter((w) => w.level === "LOW");
  const topHighRisk = [...highRisk].sort((a, b) => b.score - a.score).slice(0, 7);

  useEffect(() => {
    const stored = localStorage.getItem("selectedWard");
    if (stored) setWard(JSON.parse(stored));
  }, []);

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const formattedTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  const rainfall = ward?.rainfall ?? (allWards[0]?.rainfall ?? 0);

  const handleDownload = () => {
    const lines = [
      "FLOODSENSE — FLOOD ACTION PLAN",
      `Generated: ${formattedDate} ${formattedTime}`,
      `Rainfall Input: ${rainfall} mm`,
      "",
      "=== HIGH RISK WARDS — PRIORITY LIST ===",
      ...topHighRisk.map((w, i) =>
        `${i + 1}. ${w.ward_name} (Ward ${w.ward_no}) | Score: ${Math.round(w.score)}/200 | ${w.reason || ""}`)
      ,
      "",
      "=== RECOMMENDED ACTIONS ===",
      ...RECOMMENDED_ACTIONS.flatMap((a) => [a.title + ":", ...a.actions.map((x) => "  - " + x), ""])
      ,
      "=== RESOURCE SUMMARY ===",
      `Pumps Needed: ${Math.max(1, highRisk.length)} units`,
      `Response Teams: ${Math.max(1, Math.ceil(highRisk.length / 2))} teams`,
      `Rescue Boats: ${Math.max(1, mediumRisk.length)} units`,
      `Volunteers: ${totalWards * 5}+ people`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FloodSense_ActionPlan_${formattedDate.replace(/ /g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fs-page-layout">
      <Sidebar />
      <div className="fs-page-main">

        {/* HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <h1>Decision Support</h1>
            <p>Prioritized actions for high-risk flood situations · {formattedDate}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge"><Cloud size={14} /><span>Rainfall:</span><strong>{rainfall} mm</strong></div>
            <div className="fs-header-badge"><Clock size={14} /><strong>{formattedTime}</strong></div>
            <button className="fs-btn primary" onClick={handleDownload}><Download size={14} /> Download Plan</button>
          </div>
        </header>

        {/* KPI ROW */}
        <div className="fs-kpi-row">
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon red"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">High Risk</div>
              <div className="fs-kpi-value red">{highRisk.length}</div>
              <div className="fs-kpi-sub">of {totalWards} wards — Immediate</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon orange"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Medium Risk</div>
              <div className="fs-kpi-value orange">{mediumRisk.length}</div>
              <div className="fs-kpi-sub">Monitor & Prepare</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon green"><Shield size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Low Risk</div>
              <div className="fs-kpi-value green">{lowRisk.length}</div>
              <div className="fs-kpi-sub">No Immediate Action</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon blue"><Users size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Total Wards</div>
              <div className="fs-kpi-value blue">{totalWards}</div>
              <div className="fs-kpi-sub">Prediction Results</div>
            </div>
          </div>
        </div>

        <div className="fs-content">
          <div className="decision-lower-grid">
            {/* LEFT COLUMN */}
            <div className="decision-left-col">

              {/* RISK TABLE */}
              <div className="fs-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>
                      High Risk Wards — Priority List
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Top {topHighRisk.length} ranked by score
                  </span>
                </div>
                <div className="fs-table-wrap" style={{ borderRadius: 0, border: "none" }}>
                  <table className="fs-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ward</th>
                        <th>Score</th>
                        <th>Key Reason</th>
                        <th>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topHighRisk.map((w, index) => (
                        <tr key={w.ward_no} onClick={() => {
                          localStorage.setItem("selectedWard", JSON.stringify(w));
                          navigate("/analysis");
                        }} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 700, color: "#64748b", width: "32px" }}>{index + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                              <MapPin size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{w.ward_name}</div>
                                <div style={{ fontSize: "0.71rem", color: "#94a3b8" }}>Ward {w.ward_no}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: "#ef4444" }}>{Math.round(w.score)}</span>
                            <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}> / 200</span>
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "#64748b", maxWidth: "160px" }}>{w.reason}</td>
                          <td>
                            <span className={`fs-badge ${w.score > 150 ? "critical" : "high"}`}>
                              {w.score > 150 ? "CRITICAL" : "HIGH"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "12px 16px", background: "#fef2f2", borderTop: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#b91c1c" }}>
                  <AlertTriangle size={14} />
                  These wards are at high risk based on current rainfall and geographic factors. Click a row to analyse.
                </div>
              </div>

              {/* ACTION ROW */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button className="fs-btn secondary" onClick={() => navigate("/analysis")}>
                  <ArrowLeft size={15} /> Back to Analysis
                </button>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "7px", fontSize: "0.78rem", color: "#92400e", background: "#fff7ed", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "8px", padding: "8px 12px" }}>
                  <AlertTriangle size={14} style={{ color: "#f97316" }} />
                  Timely coordination significantly reduces flood impact and ensures public safety.
                </div>
                <button className="fs-btn primary" onClick={handleDownload}>
                  <Download size={15} /> Download Plan
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="decision-right-col">
              {/* RECOMMENDED ACTIONS */}
              <div className="fs-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Shield size={15} style={{ color: "#1e88e5" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>Recommended Actions</span>
                  </div>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {RECOMMENDED_ACTIONS.map((action) => (
                    <div key={action.id} className={`decision-action-item decision-action-item--${action.color}`}>
                      <div className={`decision-action-icon decision-action-icon--${action.color}`}>{action.icon}</div>
                      <div className="decision-action-body">
                        <div className="decision-action-name">{action.title}</div>
                        <ul className="decision-action-bullets">
                          {action.actions.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                      <ChevronRight size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* RESOURCE SUMMARY */}
              <div className="fs-card">
                <div className="fs-card-label">Resource Summary</div>
                <div className="decision-resource-grid">
                  <ResourceItem icon={<Truck size={17} />} color="blue" count={Math.max(1, highRisk.length)} label="Pumps Needed" unit="Units" />
                  <ResourceItem icon={<Users size={17} />} color="orange" count={Math.max(1, Math.ceil(highRisk.length / 2))} label="Teams Needed" unit="Teams" />
                  <ResourceItem icon={<Anchor size={17} />} color="teal" count={Math.max(1, mediumRisk.length)} label="Rescue Boats" unit="Units" />
                  <ResourceItem icon={<Users size={17} />} color="green" count={`${totalWards * 5}+`} label="Volunteers" unit="People" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ icon, color, count, label, unit }) {
  return (
    <div className="decision-resource-item">
      <div className={`decision-resource-icon decision-resource-icon--${color}`}>{icon}</div>
      <div className="decision-resource-body">
        <span className="decision-resource-count">{count}</span>
        <span className="decision-resource-label">{label}</span>
        <span className="decision-resource-unit">{unit}</span>
      </div>
    </div>
  );
}
