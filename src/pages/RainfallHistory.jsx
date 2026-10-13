import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CloudRain,
  Clock,
  AlertTriangle,
  Shield,
  RefreshCw,
  Search,
  Droplets,
  Info,
  TrendingUp,
  Activity,
  Mountain,
  Waves,
  Calendar,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Ward1TelemetryChart from "../components/Ward1TelemetryChart";
import { useWard1Live } from "../context/Ward1LiveContext";
import { getRiskData, getWardHistory } from "../services/api";
import "../styles/shared.css";
import "../styles/RainfallHistory.css";

function getRiskColor(level) {
  if (!level) return "#64748b";
  const l = String(level).toUpperCase();
  if (l === "CRITICAL" || l === "VERY HIGH") return "#b91c1c";
  if (l === "HIGH") return "#ef4444";
  if (l === "MEDIUM" || l === "MODERATE") return "#f97316";
  if (l === "LOW") return "#22c55e";
  return "#64748b";
}

function formatObsDate(isoStr) {
  if (!isoStr) return "--:--";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-IN", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return String(isoStr);
  }
}

export default function RainfallHistory() {
  const { wardNo: paramWardNo } = useParams();
  const navigate = useNavigate();
  const { telemetry: ward1Telemetry } = useWard1Live();

  const [allWardsRisk, setAllWardsRisk] = useState([]);
  const [wardDetails, setWardDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Initial Load: Load all wards risk list
  useEffect(() => {
    let isMounted = true;
    async function loadRiskList() {
      try {
        // Try localStorage cache first for fast paint
        const cached = localStorage.getItem("riskData");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllWardsRisk(parsed);
          }
        }
        const data = await getRiskData();
        if (isMounted && Array.isArray(data)) {
          setAllWardsRisk(data);
          localStorage.setItem("riskData", JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Could not refresh risk list from server:", err);
      }
    }
    loadRiskList();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Determine which ward to select from params or stored selection
  const selectedWardNo = useMemo(() => {
    if (paramWardNo) {
      const parsed = parseInt(paramWardNo, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 201) {
        return parsed;
      }
    }

    try {
      const stored = localStorage.getItem("selectedWard");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.ward_no) {
          return Number(parsed.ward_no);
        }
      }
    } catch {
      /* ignore */
    }

    return 119;
  }, [paramWardNo]);

  // 3. Fetch detailed rainfall history & momentum when selectedWardNo changes
  const fetchWardData = async (wardNoToFetch = selectedWardNo) => {
    if (!wardNoToFetch) return;
    setLoading(true);
    setError(null);

    try {
      const historyData = await getWardHistory(wardNoToFetch);
      setWardDetails(historyData);
      setLastRefreshed(new Date());

      // Also sync selectedWard in localStorage so other pages stay coherent
      if (allWardsRisk.length > 0) {
        const match = allWardsRisk.find(
          (w) => Number(w.ward_no) === Number(wardNoToFetch)
        );
        if (match) {
          localStorage.setItem("selectedWard", JSON.stringify(match));
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to load ward rainfall history:", err);
      setError("Unable to load rainfall history from backend. Please verify server connection.");
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (selectedWardNo) {
      getWardHistory(selectedWardNo)
        .then((historyData) => {
          if (!active) return;
          setWardDetails(historyData);
          setLastRefreshed(new Date());
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          console.error("Failed to load ward rainfall history:", err);
          setError("Unable to load rainfall history from backend. Please verify server connection.");
          setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [selectedWardNo]);

  // Find risk meta for current ward from allWardsRisk
  const currentRiskMeta = useMemo(() => {
    if (!selectedWardNo || !allWardsRisk.length) return null;
    return (
      allWardsRisk.find((w) => Number(w.ward_no) === Number(selectedWardNo)) || null
    );
  }, [selectedWardNo, allWardsRisk]);

  // Filtered wards for searchable dropdown
  const filteredWards = useMemo(() => {
    if (!searchQuery.trim()) {
      return allWardsRisk.slice(0, 30);
    }
    const q = searchQuery.toLowerCase().trim();
    return allWardsRisk.filter((w) => {
      const matchNo = String(w.ward_no).includes(q);
      const matchName = String(w.ward_name).toLowerCase().includes(q);
      return matchNo || matchName;
    });
  }, [searchQuery, allWardsRisk]);

  const handleSelectWard = (newWardNo) => {
    setIsDropdownOpen(false);
    setSearchQuery("");
    navigate(`/rainfall-history/${newWardNo}`);
  };

  // Safe data extractions from backend response
  const rainfallMem = wardDetails?.rainfall_memory || {};
  const momentum = wardDetails?.flood_momentum || {};
  const longTerm = wardDetails?.long_term_history || {};

  // Observation chart formatting
  const chartData = useMemo(() => {
    const obsList = wardDetails?.recent_observations || [];
    return obsList.map((o) => ({
      rawTime: o.timestamp,
      displayTime: formatObsDate(o.timestamp),
      rainfall_mm: Number(o.rainfall_mm || 0),
      source: o.source || "sensor",
    }));
  }, [wardDetails?.recent_observations]);

  const maxChartRain = useMemo(() => {
    if (!chartData.length) return 20;
    const max = Math.max(...chartData.map((d) => d.rainfall_mm));
    return Math.max(10, Math.ceil(max * 1.25));
  }, [chartData]);

  const isWard1 = Number(selectedWardNo) === 1;
  const ward1LiveSensorValue = isWard1 && (
    (ward1Telemetry?.sensor_readings?.rainfall_sensor_present && ward1Telemetry?.sensor_readings?.rainfall_mm != null)
      ? Number(ward1Telemetry.sensor_readings.rainfall_mm)
      : (ward1Telemetry?.sensor_readings?.ultrasonic_telemetry?.value_cm != null
          ? Number(ward1Telemetry.sensor_readings.ultrasonic_telemetry.value_cm)
          : null)
  );

  const riskColor = getRiskColor((isWard1 && ward1Telemetry?.risk_assessment?.level) ? ward1Telemetry.risk_assessment.level : (currentRiskMeta?.level || wardDetails?.level || "LOW"));
  const momentumColor = getRiskColor(momentum?.momentum_level || "LOW");

  const baseScore = (isWard1 && ward1Telemetry?.risk_assessment?.score != null)
    ? Number(wardDetails?.base_score ?? ward1Telemetry.risk_assessment.score)
    : (currentRiskMeta?.base_score ?? (wardDetails?.base_score || 0));
  const finalScore = (isWard1 && ward1Telemetry?.risk_assessment?.score != null)
    ? Number(ward1Telemetry.risk_assessment.score)
    : (currentRiskMeta?.score ?? (wardDetails?.score || 0));
  const riskLevel = (isWard1 && ward1Telemetry?.risk_assessment?.level)
    ? ward1Telemetry.risk_assessment.level
    : (currentRiskMeta?.level ?? (wardDetails?.level || "LOW"));

  return (
    <div className="fs-page-layout">
      <Navbar />

      <div className="fs-page-main">
        {/* ==================================================================
            PAGE HEADER
            ================================================================== */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <button
              className="fs-btn secondary"
              style={{ marginBottom: "6px", padding: "6px 12px", fontSize: "0.8rem" }}
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </button>
            <h1>Rainfall History & Flood Momentum</h1>
            <p>
              Ward-level hydrological memory, multi-window accumulation & rainfall-derived saturation proxy analytics
            </p>
          </div>

          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <Droplets size={14} style={{ color: "#1e88e5" }} />
              <span>Selected Ward:</span>
              <strong>{wardDetails?.ward_name || `Ward ${selectedWardNo}`}</strong>
            </div>

            <button
              className="fs-btn secondary"
              style={{ padding: "7px 13px", fontSize: "0.8rem" }}
              onClick={() => {
                if (currentRiskMeta) {
                  localStorage.setItem("selectedWard", JSON.stringify(currentRiskMeta));
                }
                navigate("/analysis");
              }}
            >
              View Ward Analysis →
            </button>

            <button
              className="fs-btn primary"
              style={{ padding: "7px 13px", fontSize: "0.8rem" }}
              onClick={() => fetchWardData(selectedWardNo)}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </header>

        {/* ==================================================================
            MAIN CONTENT AREA
            ================================================================== */}
        <div className="rf-page-content">
          {/* SECTION A: Searchable Ward Selector & Overview Bar */}
          <div className="rf-control-bar">
            <div className="rf-selector-group" ref={dropdownRef}>
              <span className="rf-selector-label">
                <Search size={14} /> Search Ward:
              </span>
              <div className="rf-search-box">
                <Search size={15} className="rf-search-icon" />
                <input
                  type="text"
                  className="rf-search-input"
                  placeholder="Enter ward number (1-200) or name..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                />

                {isDropdownOpen && (
                  <div className="rf-dropdown-menu">
                    {filteredWards.length > 0 ? (
                      filteredWards.map((w) => {
                        const isSelected = Number(w.ward_no) === Number(selectedWardNo);
                        const lvlColor = getRiskColor(w.level);
                        return (
                          <div
                            key={w.ward_no}
                            className={`rf-dropdown-item${isSelected ? " active" : ""}`}
                            onClick={() => handleSelectWard(Number(w.ward_no))}
                          >
                            <span>
                              <strong>Ward {w.ward_no}</strong> {w.ward_name && `— ${w.ward_name}`}
                            </span>
                            <span
                              className="fs-badge"
                              style={{
                                background: lvlColor + "15",
                                color: lvlColor,
                                border: `1px solid ${lvlColor}30`,
                                fontSize: "0.68rem",
                                padding: "2px 7px",
                              }}
                            >
                              {w.level} · {Math.round(w.score || 0)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rf-dropdown-empty">
                        No wards found matching &ldquo;{searchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rf-meta-chips">
              <div className="rf-chip">
                <Calendar size={13} />
                <span>Reference Time:</span>
                <strong>
                  {rainfallMem.ref_timestamp
                    ? new Date(rainfallMem.ref_timestamp).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "Latest available"}
                </strong>
              </div>

              <div className="rf-chip">
                <Clock size={13} />
                <span>Last Updated:</span>
                <strong>
                  {lastRefreshed
                    ? lastRefreshed.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "--:--"}
                </strong>
              </div>
            </div>
          </div>

          {/* Loading or Error Banners */}
          {error && (
            <div
              className="fs-card"
              style={{
                borderColor: "#ef4444",
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#991b1b",
              }}
            >
              <AlertTriangle size={24} style={{ color: "#ef4444" }} />
              <div>
                <strong>Connection Error:</strong> {error}
              </div>
              <button
                className="fs-btn secondary"
                style={{ marginLeft: "auto", fontSize: "0.78rem" }}
                onClick={() => fetchWardData(selectedWardNo)}
              >
                Retry
              </button>
            </div>
          )}

          {/* Ward Hero Snapshot */}
          <div className="rf-ward-hero">
            <div className="rf-hero-ward-info">
              <div className="rf-hero-icon">
                <Droplets size={24} />
              </div>
              <div className="rf-hero-title">
                <h2>{wardDetails?.ward_name || `Ward ${selectedWardNo}`}</h2>
                <div className="rf-hero-subtitle">
                  <span>Ward ID: W-{selectedWardNo}</span>
                  <span>·</span>
                  <span
                    className="fs-badge"
                    style={{
                      background: riskColor + "18",
                      color: riskColor,
                      border: `1px solid ${riskColor}40`,
                    }}
                  >
                    {riskLevel} RISK
                  </span>
                </div>
              </div>
            </div>

            <div className="rf-hero-stat">
              <div className="rf-hero-stat-label">Terrain Elevation</div>
              <div className="rf-hero-stat-value">
                <Mountain size={16} style={{ color: "#64748b" }} />
                {wardDetails?.elevation_m ?? currentRiskMeta?.elevation ?? "6.7"}
                <span className="unit">m</span>
              </div>
              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                Above mean sea level
              </span>
            </div>

            <div className="rf-hero-stat">
              <div className="rf-hero-stat-label">Water Body Distance</div>
              <div className="rf-hero-stat-value">
                <Waves size={16} style={{ color: "#0284c7" }} />
                {wardDetails?.water_distance_km ?? currentRiskMeta?.water_distance ?? "10.0"}
                <span className="unit">km</span>
              </div>
              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                Nearest drainage outlet
              </span>
            </div>

            <div className="rf-hero-stat">
              <div className="rf-hero-stat-label">Final Risk Score</div>
              <div className="rf-hero-stat-value" style={{ color: riskColor }}>
                <TrendingUp size={16} style={{ color: riskColor }} />
                {Math.round(finalScore)}
                <span className="unit">/ 200</span>
              </div>
              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                Base XGBoost: {Math.round(baseScore)} × {momentum?.momentum_multiplier ?? 1.0}x
              </span>
            </div>
          </div>

          {/* ==================================================================
              SECTION B: RAINFALL MONITORING WINDOWS (Short-Term & Antecedent)
              ================================================================== */}
          <div>
            <div
              className="fs-card-label"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <CloudRain size={14} /> Rainfall Monitoring Windows (Hydrological Accumulation & Memory)
            </div>
            <div className="rf-windows-grid">
              <AccumulationCard
                label="1-Hour Window"
                value={rainfallMem["1h"]}
                role="Immediate Intensity (Acute runoff burst potential)"
                icon={<Clock size={16} />}
                maxScale={50}
              />
              <AccumulationCard
                label="3-Hour Window"
                value={rainfallMem["3h"]}
                role="Short-Term Load (Drainage surcharge pressure)"
                icon={<Droplets size={16} />}
                maxScale={75}
              />
              <AccumulationCard
                label="6-Hour Window"
                value={rainfallMem["6h"]}
                role="Sub-basin Build-up (Catchment load)"
                icon={<Layers size={16} />}
                maxScale={100}
              />
              <AccumulationCard
                label="8-Hour Window"
                value={rainfallMem["8h"]}
                role="Primary Short-Term Window (Active runoff candidate)"
                icon={<Activity size={16} />}
                maxScale={120}
                isKey
              />
              <AccumulationCard
                label="12-Hour Window"
                value={rainfallMem["12h"]}
                role="Extended Monsoonal Context (Sustained rainfall)"
                icon={<CloudRain size={16} />}
                maxScale={140}
              />
              <AccumulationCard
                label="24-Hour Window"
                value={rainfallMem["24h"]}
                role="Antecedent Rainfall Memory (8-24h intermediate window)"
                icon={<Activity size={16} />}
                maxScale={160}
              />
              <AccumulationCard
                label="72-Hour Window"
                value={rainfallMem["72h"]}
                role="72-hour Rainfall Accumulation (24-72h baseline window)"
                icon={<Shield size={16} />}
                maxScale={200}
              />
            </div>
          </div>

          {/* ==================================================================
              SECTION C: HISTORICAL TIME-SERIES RAINFALL CHART
              ================================================================== */}
          <div className="rf-chart-card">
            <div className="rf-chart-header">
              <div className="rf-chart-title-block">
                <h3>Timestamped Hourly Rainfall (Recent 24 Hours)</h3>
                <p>
                  Actual chronological observations retrieved from database storage
                </p>
              </div>

            <div className="rf-chart-badges">
                <span className="fs-badge blue">
                  <Activity size={12} /> {chartData.length} Hourly Observations
                </span>
                <span className="fs-badge" style={{ background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" }}>
                  Source: Synthetic Hydrological Baseline
                </span>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="rf-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e88e5" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1e88e5" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="displayTime"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, maxChartRain]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={false}
                      unit="mm"
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="rainfall_mm"
                      stroke="#1e88e5"
                      strokeWidth={2.2}
                      fillOpacity={1}
                      fill="url(#rainGradient)"
                      name="Rainfall"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="fs-empty" style={{ padding: "40px 0" }}>
                <CloudRain size={36} className="fs-empty-icon" />
                <h3>No Hourly Observations Available</h3>
                <p>No recent 24-hour readings recorded for Ward {selectedWardNo}.</p>
              </div>
            )}

            <div className="rf-chart-footnote">
              <Info size={14} style={{ color: "#1e88e5", flexShrink: 0 }} />
              <span>
                Observations reflect timestamped prototype records stored in MongoDB (source: synthetic_baseline).
                Missing intervals are not artificially interpolated. This dataset serves as a Synthetic Hydrological
                Baseline demonstrating prototype rainfall memory, not physical gauge or telemetry observations. Longer-term daily summaries are
                presented separately below to prevent conflating hourly rates with multi-day aggregates.
              </span>
            </div>
          </div>

          {/* ==================================================================
              SECTION C-LIVE: WARD 1 PHYSICAL ESP32 REAL-TIME SENSOR TREND
              ================================================================== */}
          {Number(selectedWardNo) === 1 && (
            <div style={{ marginTop: "16px" }}>
              <Ward1TelemetryChart initialTab="distance" />
            </div>
          )}

          {/* ==================================================================
              SECTION D: FLOOD MOMENTUM & ANTECEDENT SATURATION ANALYSIS
              ================================================================== */}
          <div>
            <div
              className="fs-card-label"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Activity size={14} /> Flood Momentum & Saturation Proxy Analysis
            </div>

            <div className="rf-momentum-section">
              {/* Left Column: Authoritative Intermediate Values */}
              <div className="rf-momentum-metrics-card">
                <div className="rf-chart-title-block">
                  <h3>Hydrological Saturation State</h3>
                  <p>Antecedent rainfall memory and terrain retention metrics (rainfall-derived proxy)</p>
                </div>

                <div className="rf-momentum-kpi-grid">
                  <div className="rf-momentum-kpi">
                    <span className="rf-momentum-kpi-label">Decayed Antecedent Rain</span>
                    <span className="rf-momentum-kpi-value" style={{ color: "#0d1b2e" }}>
                      {momentum?.antecedent_rainfall_mm ?? 0}
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginLeft: "4px" }}>
                        mm
                      </span>
                    </span>
                    <span className="rf-momentum-kpi-sub">
                      Time-Decayed (3 Non-Overlapping Tranches)
                    </span>
                  </div>

                  <div className="rf-momentum-kpi">
                    <span className="rf-momentum-kpi-label">Saturation Ratio (Proxy)</span>
                    <span className="rf-momentum-kpi-value" style={{ color: "#1e88e5" }}>
                      {momentum?.saturation_ratio !== undefined
                        ? `${(momentum.saturation_ratio * 100).toFixed(1)}%`
                        : "0.0%"}
                    </span>
                    <span className="rf-momentum-kpi-sub">
                      Rainfall proxy (Cap @ 120mm)
                    </span>
                  </div>

                  <div className="rf-momentum-kpi">
                    <span className="rf-momentum-kpi-label">Active Rain Factor (α)</span>
                    <span className="rf-momentum-kpi-value" style={{ color: (momentum?.active_rainfall_factor ?? 1.0) >= 0.8 ? "#b91c1c" : "#1e88e5" }}>
                      {momentum?.active_rainfall_factor !== undefined ? `${momentum.active_rainfall_factor}x` : "1.00x"}
                    </span>
                    <span className="rf-momentum-kpi-sub">
                      Burst: {momentum?.burst_category || "LOW"}
                    </span>
                  </div>

                  <div className="rf-momentum-kpi">
                    <span className="rf-momentum-kpi-label">Momentum Multiplier</span>
                    <span className="rf-momentum-kpi-value" style={{ color: momentumColor }}>
                      {momentum?.momentum_multiplier ?? 1.0}x
                    </span>
                    <span className="rf-momentum-kpi-sub">
                      Terrain & Active-Rain Gated (1.00x – 1.75x)
                    </span>
                  </div>
                </div>

                {/* 3 Non-Overlapping Tranches Breakdown Box */}
                <div className="rf-weights-box">
                  <div className="rf-weights-header">
                    <Layers size={15} />
                    <span>Time-Decayed Hydrological Memory Breakdown</span>
                  </div>
                  <div className="rf-weights-items">
                    <div className="rf-weight-pill">
                      <span>0–8h Active Window (100% Weight)</span>
                      <strong>
                        {momentum?.tranches?.recent_0_8h_mm ?? rainfallMem["8h"] ?? 0} mm
                      </strong>
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                        Effective: {(1.0 * (momentum?.tranches?.recent_0_8h_mm ?? rainfallMem["8h"] ?? 0)).toFixed(2)} mm
                      </span>
                    </div>

                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#94a3b8" }}>+</div>

                    <div className="rf-weight-pill">
                      <span>8–24h Antecedent Memory (50% Weight)</span>
                      <strong>
                        {momentum?.tranches?.intermediate_8_24h_mm ?? Math.max(0, (rainfallMem["24h"] || 0) - (rainfallMem["8h"] || 0)).toFixed(2)} mm
                      </strong>
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                        Effective: {(0.5 * (momentum?.tranches?.intermediate_8_24h_mm ?? Math.max(0, (rainfallMem["24h"] || 0) - (rainfallMem["8h"] || 0)))).toFixed(2)} mm
                      </span>
                    </div>

                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#94a3b8" }}>+</div>

                    <div className="rf-weight-pill">
                      <span>24–72h Baseline Accumulation (15% Weight)</span>
                      <strong>
                        {momentum?.tranches?.past_24_72h_mm ?? Math.max(0, (rainfallMem["72h"] || 0) - (rainfallMem["24h"] || 0)).toFixed(2)} mm
                      </strong>
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                        Effective: {(0.15 * (momentum?.tranches?.past_24_72h_mm ?? Math.max(0, (rainfallMem["72h"] || 0) - (rainfallMem["24h"] || 0)))).toFixed(2)} mm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Score Progression Pipeline & Mathematical Formulation */}
              <div className="rf-momentum-pipeline-card">
                <div className="rf-chart-title-block">
                  <h3>Risk Scoring Progression</h3>
                  <p>Pipeline combining XGBoost baseline, time-decayed rainfall proxy & active rain gating</p>
                </div>

                <div className="rf-pipeline-steps">
                  <div className="rf-pipeline-step">
                    <div className="rf-step-num">1</div>
                    <div className="rf-step-content">
                      <div className="rf-step-title">
                        <span>XGBoost ML Base Score</span>
                        <span className="rf-step-val">{Math.round(baseScore)} / 200</span>
                      </div>
                      <div className="rf-step-desc">
                        {isWard1 ? (
                          <>
                            Evaluated from live ESP32 telemetry ({ward1LiveSensorValue != null ? ward1LiveSensorValue.toFixed(1) : (currentRiskMeta?.rainfall ?? "46.0")} mm; ultrasonic reading), elevation ({wardDetails?.elevation_m ?? "6.7"} m), and water distance ({wardDetails?.water_distance_km ?? "25.47"} km).
                          </>
                        ) : (
                          <>
                            Evaluated from instant rainfall ({currentRiskMeta?.rainfall ?? "0"} mm), elevation ({wardDetails?.elevation_m ?? "6.7"} m), and water distance ({wardDetails?.water_distance_km ?? "10.0"} km).
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rf-pipeline-step">
                    <div className="rf-step-num">2</div>
                    <div className="rf-step-content">
                      <div className="rf-step-title">
                        <span>Hydrological Multiplier</span>
                        <span className="rf-step-val" style={{ color: momentumColor }}>
                          × {momentum?.momentum_multiplier ?? 1.0}x
                        </span>
                      </div>
                      <div className="rf-step-desc">
                        Augmentation derived from time-decayed rainfall-derived saturation proxy, topographic
                        drainage handicap factor, and active rainfall factor (α).
                      </div>
                    </div>
                  </div>

                  <div className="rf-pipeline-step">
                    <div className="rf-step-num">3</div>
                    <div className="rf-step-content">
                      <div className="rf-step-title">
                        <span>Final Augmented Risk Score</span>
                        <span className="rf-step-val" style={{ color: riskColor }}>
                          = {Math.round(finalScore)} / 200
                        </span>
                      </div>
                      <div className="rf-step-desc">
                        Bounded deterministically: min(200.0, max(0.0, Base Score × Multiplier)).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mathematical Formulation Display */}
                <div className="rf-formula-box">
                  <div style={{ color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                    Time-Aware Scientific Formulation (Experimental):
                  </div>
                  <div className="rf-formula-line">
                    R_recent = R8h &nbsp;|&nbsp; R_inter = max(0, R24h - R8h) &nbsp;|&nbsp; R_past = max(0, R72h - R24h)
                  </div>
                  <div className="rf-formula-line">
                    antecedent_mm = 1.00 × R_recent + 0.50 × R_inter + 0.15 × R_past
                  </div>
                  <div className="rf-formula-line">
                    saturation_ratio = min(1.0, max(0.0, antecedent_mm / 120.0))
                  </div>
                  <div className="rf-formula-line">
                    α_active = f(R8h, R1h) ∈ [0.15, 1.00] &nbsp;(active rain gating)
                  </div>
                  <div className="rf-formula-line">
                    momentum_multiplier = min(1.75, max(1.0, 1.0 + 0.50 × saturation × handicap × α_active))
                  </div>
                  <div className="rf-formula-line">
                    final_score = min(200.0, max(0.0, round(base_score × multiplier, 2)))
                  </div>
                </div>

                <div className="rf-formula-note">
                  * Note: Rainfall totals represent monitoring observations of precipitation load and a rainfall-derived saturation proxy,
                  not physical measurements of soil moisture, standing flood depth, or water-level telemetry.
                  The historical baseline uses synthetic rainfall observations.
                  Older rainfall (24–72h) is discounted (15% weight) and gated by active rainfall (α_active),
                  preventing past accumulations from independently causing a HIGH risk assessment.
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================================
              SECTION E: HISTORICAL SUMMARIES (Long-Term Daily Rollups)
              ================================================================== */}
          <div className="rf-history-card">
            <div className="rf-chart-header">
              <div className="rf-chart-title-block">
                <h3>Historical Rainfall Rollups (Multi-Period Summaries)</h3>
                <p>
                  Aggregated from long-term daily summaries collection in database
                </p>
              </div>

              <span className="fs-badge" style={{ background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" }}>
                Source: Synthetic Hydrological Baseline
              </span>
            </div>

            <div className="rf-history-grid">
              <PeriodSummaryCard
                period="7 Days"
                summary={longTerm["7d"]}
              />
              <PeriodSummaryCard
                period="30 Days (1 Mo)"
                summary={longTerm["30d"]}
              />
              <PeriodSummaryCard
                period="3 Months (90d)"
                summary={longTerm["3m"]}
              />
              <PeriodSummaryCard
                period="6 Months (180d)"
                summary={longTerm["6m"]}
              />
              <PeriodSummaryCard
                period="9 Months (270d)"
                summary={longTerm["9m"]}
              />
            </div>

            <div className="rf-chart-footnote">
              <Calendar size={14} style={{ color: "#1e88e5", flexShrink: 0 }} />
              <span>
                Historical rollups represent a Synthetic Hydrological Baseline demonstrating prototype rainfall memory
                and flood risk functionality across seasonal profiles (Northeast &amp; Southwest Monsoons).
                Values are deterministically derived by aggregating raw hourly baseline observations, not measured from physical gauges or live telemetry.
              </span>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

function AccumulationCard({ label, value, role, icon, maxScale, isKey }) {
  const valNum = Number(value || 0);
  const fillPercent = Math.min(100, Math.round((valNum / maxScale) * 100));

  return (
    <div className={`rf-window-card${isKey ? " highlight" : ""}`}>
      <div className="rf-window-card-header">
        <span className="rf-window-tag">{label}</span>
        <div className="rf-window-icon">{icon}</div>
      </div>
      <div className="rf-window-value">
        {valNum.toFixed(2)}
        <span className="unit">mm</span>
      </div>
      <div className="rf-window-role">{role}</div>
      <div className="rf-window-bar-track">
        <div
          className="rf-window-bar-fill"
          style={{
            width: `${fillPercent}%`,
            background: valNum > 80 ? "#ef4444" : valNum > 40 ? "#f97316" : "#1e88e5",
          }}
        />
      </div>
    </div>
  );
}

function PeriodSummaryCard({ period, summary }) {
  const tot = summary?.total_mm !== undefined ? Number(summary.total_mm).toFixed(2) : "0.00";
  const avg = summary?.avg_daily_mm !== undefined ? Number(summary.avg_daily_mm).toFixed(2) : "0.00";
  const max = summary?.max_daily_mm !== undefined ? Number(summary.max_daily_mm).toFixed(2) : "0.00";
  const expectedDays = summary?.expected_days ?? 0;
  const availableDays = summary?.available_days ?? 0;
  const missingDays = summary?.missing_days ?? 0;
  const startDate = summary?.start_date || "--";
  const endDate = summary?.end_date || "--";

  return (
    <div className="rf-history-period-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="rf-period-label">{period}</span>
        <span
          className="fs-badge"
          style={{
            fontSize: "0.65rem",
            padding: "2px 6px",
            background: availableDays === expectedDays ? "#f0fdf4" : "#fffbeb",
            color: availableDays === expectedDays ? "#166534" : "#b45309",
            border: `1px solid ${availableDays === expectedDays ? "#bbf7d0" : "#fde68a"}`,
          }}
        >
          {availableDays}/{expectedDays} Days{missingDays > 0 ? ` (${missingDays} missing)` : ""}
        </span>
      </div>

      <div className="rf-period-total">
        {tot} <span className="unit">mm</span>
      </div>

      <div style={{ fontSize: "0.68rem", color: "#64748b", margin: "-2px 0 2px" }}>
        {startDate} to {endDate}
      </div>

      <div className="rf-period-sub-rows">
        <div className="rf-period-sub-row">
          <span>Daily Avg:</span>
          <strong>{avg} mm</strong>
        </div>
        <div className="rf-period-sub-row">
          <span>Single-Day Peak:</span>
          <strong>{max} mm</strong>
        </div>
        {summary?.max_daily_date && (
          <div className="rf-period-sub-row" style={{ fontSize: "0.65rem", color: "#94a3b8" }}>
            <span>Peak Date:</span>
            <span>{summary.max_daily_date}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rf-chart-tooltip">
      <div className="rf-chart-tooltip-time">
        {new Date(data.rawTime).toLocaleString("en-IN", {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </div>
      <div className="rf-chart-tooltip-val">
        {data.rainfall_mm.toFixed(2)} mm
      </div>
      <div className="rf-chart-tooltip-src">
        Source: {data.source}
      </div>
    </div>
  );
}
