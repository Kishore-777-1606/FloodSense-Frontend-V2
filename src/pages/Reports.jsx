import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Download, BarChart2, AlertTriangle, CloudRain,
  MapPin, TrendingUp, Clock, Filter, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import Navbar from "../components/Navbar";
import { getRiskData } from "../services/api";
import "../styles/shared.css";
import "../styles/Reports.css";

const PIE_COLORS = ["#ef4444", "#f97316", "#22c55e"];

export default function Reports() {
  const navigate = useNavigate();
  const [allWards, setAllWards] = useState(() => {
    try {
      const stored = localStorage.getItem("riskData");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [sortBy, setSortBy] = useState("score");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [showFilter, setShowFilter] = useState(false);

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
  const now = new Date();
  const formatDate = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const formatTime = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const high = allWards.filter((w) => w.level === "HIGH");
  const medium = allWards.filter((w) => w.level === "MEDIUM");
  const low = allWards.filter((w) => w.level === "LOW");
  const avgScore = allWards.length
    ? (allWards.reduce((s, w) => s + (w.score || 0), 0) / allWards.length).toFixed(1)
    : 0;
  const maxScore = allWards.length ? Math.max(...allWards.map((w) => w.score || 0)) : 0;

  // Chart data
  const pieData = [
    { name: "High Risk", value: high.length },
    { name: "Medium Risk", value: medium.length },
    { name: "Low Risk", value: low.length },
  ];

  const topWards = [...allWards].sort((a, b) => b.score - a.score).slice(0, 12);
  const barData = topWards.map((w) => ({
    name: w.ward_name?.length > 10 ? w.ward_name.slice(0, 10) + "…" : w.ward_name,
    score: Math.round(w.score),
    level: w.level,
  }));

  // Filtered + sorted table
  const tableWards = allWards
    .filter((w) => filterLevel === "ALL" || w.level === filterLevel)
    .sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "name") return (a.ward_name || "").localeCompare(b.ward_name || "");
      if (sortBy === "elevation") return a.elevation - b.elevation;
      if (sortBy === "distance") return a.water_distance - b.water_distance;
      return 0;
    });

  const getBarFill = (level) => {
    if (level === "HIGH") return "#ef4444";
    if (level === "MEDIUM") return "#f97316";
    return "#22c55e";
  };

  const handleDownloadCSV = () => {
    const headers = ["Ward No", "Ward Name", "Risk Level", "Score", "Rainfall (mm)", "Elevation (m)", "Water Distance (km)", "Reason"];
    const rows = allWards.map((w) => [
      w.ward_no, w.ward_name, w.level, Math.round(w.score),
      w.rainfall, w.elevation, w.water_distance, `"${w.reason || ""}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FloodSense_Report_${formatDate(now).replace(/ /g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    const lines = [
      "=========================================",
      "   FLOODSENSE — FLOOD INTELLIGENCE REPORT",
      "=========================================",
      `Date: ${formatDate(now)}  Time: ${formatTime(now)}`,
      `Rainfall Input: ${rainfall} mm`,
      `Total Wards Analysed: ${allWards.length}`,
      "",
      "--- SUMMARY ---",
      `High Risk Wards : ${high.length}`,
      `Medium Risk Wards: ${medium.length}`,
      `Low Risk Wards  : ${low.length}`,
      `Average Score   : ${avgScore} / 200`,
      `Highest Score   : ${Math.round(maxScore)} / 200`,
      "",
      "--- TOP HIGH RISK WARDS ---",
      ...high.sort((a, b) => b.score - a.score).slice(0, 10).map((w, i) =>
        `${i + 1}. ${w.ward_name} (W-${w.ward_no}) | Score: ${Math.round(w.score)} | ${w.reason || ""}`)
      ,
      "",
      "--- FULL WARD DATA ---",
      "Ward No | Ward Name | Level | Score | Reason",
      ...allWards.sort((a, b) => b.score - a.score).map((w) =>
        `W-${w.ward_no} | ${w.ward_name} | ${w.level} | ${Math.round(w.score)} | ${w.reason || ""}`)
      ,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FloodSense_Report_${formatDate(now).replace(/ /g, "_")}.txt`;
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
            <h1>Reports & Intelligence Center</h1>
            <p>Flood risk analytics · {formatDate(now)} · {formatTime(now)}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge"><CloudRain size={14} /><span>Rainfall:</span><strong>{rainfall} mm</strong></div>
            <button className="fs-btn secondary" onClick={handleDownloadCSV}><Download size={14} /> Export CSV</button>
            <button className="fs-btn primary" onClick={handleDownloadTxt}><FileText size={14} /> Download Report</button>
          </div>
        </header>

        <div className="fs-content">
          {/* EXECUTIVE SUMMARY */}
          <div className="reports-exec-card fs-card">
            <div className="reports-exec-header">
              <div className="fs-card-label" style={{ marginBottom: 0 }}>Executive Summary</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Generated {formatTime(now)}
              </div>
            </div>
            <div className="reports-exec-body">
              <p>
                FloodSense analysed <strong>{allWards.length} wards</strong> across Chennai with a rainfall input of{" "}
                <strong>{rainfall} mm</strong>. The risk prediction engine identified{" "}
                <strong style={{ color: "#ef4444" }}>{high.length} HIGH risk zones</strong> requiring immediate attention,{" "}
                <strong style={{ color: "#f97316" }}>{medium.length} MEDIUM risk zones</strong> under monitoring, and{" "}
                <strong style={{ color: "#22c55e" }}>{low.length} LOW risk zones</strong> with stable conditions.
                The average risk score is <strong>{avgScore}/200</strong> with a peak of <strong>{Math.round(maxScore)}/200</strong>.
              </p>
              {high.length > 0 && (
                <div className="reports-exec-warning">
                  <AlertTriangle size={15} />
                  <span>
                    <strong>{high.length} wards need emergency response.</strong>{" "}
                    Top at-risk ward: {[...high].sort((a, b) => b.score - a.score)[0]?.ward_name}
                    {" "}(Score: {Math.round([...high].sort((a, b) => b.score - a.score)[0]?.score)}/200)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* KPI ROW */}
          <div className="fs-kpi-row" style={{ padding: 0 }}>
            <div className="fs-kpi-card">
              <div className="fs-kpi-icon red"><AlertTriangle size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">High Risk</div>
                <div className="fs-kpi-value red">{high.length}</div>
                <div className="fs-kpi-sub">{((high.length / allWards.length) * 100).toFixed(1)}% of total</div>
              </div>
            </div>
            <div className="fs-kpi-card">
              <div className="fs-kpi-icon orange"><AlertTriangle size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Medium Risk</div>
                <div className="fs-kpi-value orange">{medium.length}</div>
                <div className="fs-kpi-sub">{((medium.length / allWards.length) * 100).toFixed(1)}% of total</div>
              </div>
            </div>
            <div className="fs-kpi-card">
              <div className="fs-kpi-icon blue"><TrendingUp size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Average Score</div>
                <div className="fs-kpi-value blue">{avgScore}</div>
                <div className="fs-kpi-sub">Out of 200</div>
              </div>
            </div>
            <div className="fs-kpi-card">
              <div className="fs-kpi-icon purple"><BarChart2 size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Peak Score</div>
                <div className="fs-kpi-value purple">{Math.round(maxScore)}</div>
                <div className="fs-kpi-sub">Highest risk ward</div>
              </div>
            </div>
          </div>

          {/* CHARTS ROW */}
          <div className="reports-charts-row">
            <div className="fs-card reports-chart-card">
              <div className="fs-card-label">Top Ward Risk Scores</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 200]} />
                  <Tooltip
                    formatter={(val) => [`${val} / 200`, "Risk Score"]}
                    contentStyle={{ fontSize: "0.78rem", borderRadius: "8px" }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={getBarFill(entry.level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="fs-card reports-chart-card reports-pie-card">
              <div className="fs-card-label">Risk Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: "0.8rem" }} />
                  <Tooltip formatter={(val, name) => [`${val} wards`, name]} contentStyle={{ fontSize: "0.78rem", borderRadius: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FULL WARD TABLE */}
          <div className="fs-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="reports-table-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={15} style={{ color: "#1e88e5" }} />
                <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Complete Ward Risk Intelligence
                </span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>({tableWards.length} wards)</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {/* Filter dropdown */}
                <div style={{ position: "relative" }}>
                  <button className="fs-btn secondary" style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    onClick={() => setShowFilter(!showFilter)}>
                    <Filter size={13} /> {filterLevel} <ChevronDown size={13} />
                  </button>
                  {showFilter && (
                    <div className="reports-dropdown">
                      {["ALL", "HIGH", "MEDIUM", "LOW"].map((f) => (
                        <button key={f} className={`reports-dropdown-item${filterLevel === f ? " active" : ""}`}
                          onClick={() => { setFilterLevel(f); setShowFilter(false); }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Sort */}
                <select className="reports-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="score">Sort: Score</option>
                  <option value="name">Sort: Name</option>
                  <option value="elevation">Sort: Elevation</option>
                  <option value="distance">Sort: Water Distance</option>
                </select>
                <button className="fs-btn secondary" style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                  onClick={handleDownloadCSV}><Download size={13} /> CSV</button>
              </div>
            </div>

            <div className="fs-table-wrap" style={{ borderRadius: 0, border: "none", maxHeight: "420px", overflowY: "auto" }}>
              <table className="fs-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th>#</th>
                    <th>Ward</th>
                    <th>Risk Level</th>
                    <th>Score</th>
                    <th>Rainfall</th>
                    <th>Elevation</th>
                    <th>Water Dist.</th>
                    <th>Key Reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tableWards.map((w, i) => (
                    <tr key={w.ward_no}>
                      <td style={{ color: "#94a3b8", fontWeight: 700, width: "30px" }}>{i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={12} style={{ color: w.level === "HIGH" ? "#ef4444" : w.level === "MEDIUM" ? "#f97316" : "#22c55e", flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{w.ward_name}</div>
                            <div style={{ fontSize: "0.71rem", color: "#94a3b8" }}>W-{w.ward_no}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`fs-badge ${w.level === "HIGH" ? "high" : w.level === "MEDIUM" ? "medium" : "low"}`}>
                          {w.level}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{
                            width: "50px", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%",
                              width: `${(w.score / 200) * 100}%`,
                              background: w.level === "HIGH" ? "#ef4444" : w.level === "MEDIUM" ? "#f97316" : "#22c55e",
                              borderRadius: "3px",
                            }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>{Math.round(w.score)}</span>
                          <span style={{ color: "#94a3b8", fontSize: "0.74rem" }}>/200</span>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>{w.rainfall} mm</td>
                      <td style={{ fontSize: "0.82rem" }}>{w.elevation} m</td>
                      <td style={{ fontSize: "0.82rem" }}>{w.water_distance} km</td>
                      <td style={{ fontSize: "0.78rem", color: "#64748b", maxWidth: "160px" }}>{w.reason}</td>
                      <td>
                        <button
                          className="fs-btn secondary"
                          style={{ padding: "4px 8px", fontSize: "0.72rem", whiteSpace: "nowrap" }}
                          onClick={() => {
                            localStorage.setItem("selectedWard", JSON.stringify(w));
                            navigate("/analysis");
                          }}
                        >
                          Analyse
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "10px 16px", background: "#f8fafc", borderTop: "1px solid var(--fs-border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#64748b" }}>
              <span>Showing {tableWards.length} of {allWards.length} wards</span>
              <button className="fs-btn primary" style={{ padding: "6px 14px", fontSize: "0.78rem" }} onClick={handleDownloadCSV}>
                <Download size={13} /> Export All as CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
