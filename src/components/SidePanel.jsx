import "./SidePanel.css";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, ChevronRight, TrendingUp, Droplets } from "lucide-react";

const COLORS = ["#ef4444", "#f97316", "#22c55e"];

export default function SidePanel({ data }) {
  const navigate = useNavigate();
  const high = data.filter((w) => w.level === "HIGH").length;
  const medium = data.filter((w) => w.level === "MEDIUM").length;
  const low = data.filter((w) => w.level === "LOW").length;
  const rainfall = data[0]?.rainfall || 0;
  const total = data.length;

  const topWards = [...data]
    .filter((w) => w.level === "HIGH")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const chartData = [
    { name: "High", value: high },
    { name: "Medium", value: medium },
    { name: "Low", value: low },
  ];

  return (
    <div className="side-panel">
      <h2 className="panel-title">Risk Insights</h2>

      {/* PIE CHART */}
      <div className="chart-section">
        <h4>Risk Distribution</h4>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={chartData} dataKey="value" innerRadius={46} outerRadius={66} paddingAngle={2}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip
                formatter={(val, name) => [`${val} wards`, name]}
                contentStyle={{ fontSize: "0.76rem", borderRadius: "8px" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-center-label">
            <span>{total}</span>
            <span>Wards</span>
          </div>
        </div>
        <div className="legend">
          <div className="legend-item"><span className="dot red"></span>High ({high})</div>
          <div className="legend-item"><span className="dot yellow"></span>Medium ({medium})</div>
          <div className="legend-item"><span className="dot green"></span>Low ({low})</div>
        </div>
      </div>

      {/* RAINFALL */}
      <div className="panel-section panel-rainfall">
        <Droplets size={16} className="panel-section-icon" />
        <div>
          <h4>Current Rainfall</h4>
          <p className="rainfall">{rainfall} <span>mm</span></p>
        </div>
      </div>

      {/* TOP HIGH RISK WARDS */}
      {topWards.length > 0 && (
        <div className="panel-section">
          <h4 className="panel-section-title">
            <AlertTriangle size={14} style={{ color: "#ef4444" }} />
            Top High-Risk Wards
          </h4>
          <div className="top-wards-list">
            {topWards.map((w, i) => (
              <div
                key={w.ward_no}
                className="top-ward-item"
                onClick={() => {
                  localStorage.setItem("selectedWard", JSON.stringify(w));
                  navigate("/analysis");
                }}
              >
                <div className="top-ward-rank">{i + 1}</div>
                <div className="top-ward-info">
                  <div className="top-ward-name">{w.ward_name}</div>
                  <div className="top-ward-score">Score: {Math.round(w.score)}/200</div>
                </div>
                <ChevronRight size={14} style={{ color: "#94a3b8" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="panel-cta"
        onClick={() => navigate("/decision")}
      >
        <TrendingUp size={15} />
        View Decision Support
      </button>
    </div>
  );
}
