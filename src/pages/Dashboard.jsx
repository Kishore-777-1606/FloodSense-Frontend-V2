import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Shield,
  BarChart2,
  MapPin,
  RefreshCw,
  CloudRain,
  TrendingUp,
  Activity,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import MapView from "../components/MapView";
import SidePanel from "../components/SidePanel";
import Footer from "../components/Footer";
import "../styles/shared.css";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [rainfall, setRainfall] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    fetch("https://floodsense-backend-working.onrender.com/get-risk?rainfall=250")
      .then((res) => res.json())
      .then((apiData) => {
        setData(apiData);
        setRainfall(apiData[0]?.rainfall || 0);
        setLastUpdated(new Date());
        localStorage.setItem("riskData", JSON.stringify(apiData));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="fs-page-layout">
        <Sidebar />
        <div className="fs-loading">
          <div className="fs-spinner" />
          <div className="fs-loading-text">Loading flood risk data…</div>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Connecting to backend prediction engine
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fs-page-layout">
        <Sidebar />
        <div className="fs-loading">
          <AlertTriangle size={48} color="#ef4444" />
          <div className="fs-loading-text">Failed to load data</div>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "12px" }}>
            Could not connect to the FloodSense backend
          </div>
          <button className="fs-btn primary" onClick={fetchData}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const totalWards = data.length;
  const high = data.filter((w) => w.level === "HIGH").length;
  const medium = data.filter((w) => w.level === "MEDIUM").length;
  const low = data.filter((w) => w.level === "LOW").length;
  const avgScore = data.length
    ? Math.round(data.reduce((s, w) => s + (w.score || 0), 0) / data.length)
    : 0;

  const formatTime = (d) =>
    d
      ? d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "--:--";

  const alertLevel =
    high >= 10 ? "CRITICAL" : high >= 5 ? "HIGH ALERT" : "MODERATE";
  const alertColor = high >= 10 ? "#ef4444" : high >= 5 ? "#f97316" : "#eab308";

  return (
    <div className="fs-page-layout">
      <Sidebar />

      <div className="fs-page-main">
        {/* HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <h1>Flood Risk Dashboard</h1>
            <p>Chennai Ward-Level Risk Intelligence · {formatTime(lastUpdated)}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <CloudRain size={14} />
              <span>Rainfall:</span>
              <strong>{rainfall} mm</strong>
            </div>
            <div className="fs-header-badge" style={{
              background: alertColor + "15",
              borderColor: alertColor + "40",
              color: alertColor,
            }}>
              <Activity size={14} />
              <strong>{alertLevel}</strong>
            </div>
            <button className="fs-btn secondary" style={{ padding: "7px 13px", fontSize: "0.8rem" }} onClick={fetchData}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        {/* EXECUTIVE SUMMARY BANNER */}
        {high > 0 && (
          <div className="dashboard-exec-summary">
            <AlertTriangle size={18} className="exec-icon" />
            <div className="exec-text">
              <strong>Executive Summary:</strong> {high} ward{high !== 1 ? "s" : ""} require
              immediate attention with flood risk scores above threshold.{" "}
              {medium > 0 && `${medium} wards are on moderate watch. `}
              Current rainfall of {rainfall} mm is{" "}
              {rainfall >= 200 ? "critically high" : rainfall >= 100 ? "elevated" : "moderate"}.
            </div>
            <button
              className="exec-action-btn"
              onClick={() => navigate("/decision")}
            >
              View Action Plan →
            </button>
          </div>
        )}

        {/* KPI ROW */}
        <div className="fs-kpi-row" style={{ padding: "20px 24px 0" }}>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon red"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">High Risk</div>
              <div className="fs-kpi-value red">{high}</div>
              <div className="fs-kpi-sub">Immediate attention</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon orange"><AlertTriangle size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Medium Risk</div>
              <div className="fs-kpi-value orange">{medium}</div>
              <div className="fs-kpi-sub">Monitor closely</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon green"><Shield size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Low Risk</div>
              <div className="fs-kpi-value green">{low}</div>
              <div className="fs-kpi-sub">Stable conditions</div>
            </div>
          </div>
          <div className="fs-kpi-card">
            <div className="fs-kpi-icon blue"><TrendingUp size={20} /></div>
            <div className="fs-kpi-body">
              <div className="fs-kpi-label">Avg Risk Score</div>
              <div className="fs-kpi-value blue">{avgScore}</div>
              <div className="fs-kpi-sub">Out of 200 · {totalWards} wards</div>
            </div>
          </div>
        </div>

        {/* MAP + PANEL */}
        <div className="dashboard-map-section">
          <div className="dashboard-map-col">
            <div className="dashboard-map-label">
              <MapPin size={14} />
              <span>Chennai Ward Risk Map — Click any ward to analyse</span>
            </div>
            <MapView data={data} />
          </div>
          <div className="dashboard-panel-col">
            <SidePanel data={data} />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
