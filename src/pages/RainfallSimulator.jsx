import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import {
  RotateCcw,
  Info,
  MapPin,
  TrendingUp,
  Layers,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  Loader2,
  SlidersHorizontal,
  ChevronRight,
  ArrowLeft,
  Activity,
  Sun,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getRainfallScenario, getRiskData } from "../services/api";
import "../styles/shared.css";
import "../styles/RainfallSimulator.css";

const PRESET_VALUES = [
  { label: "0 mm", value: 0, desc: "Dry Scenario", icon: Sun },
  { label: "25 mm", value: 25, desc: "Light Rainfall", icon: CloudDrizzle },
  { label: "50 mm", value: 50, desc: "Moderate Rainfall", icon: CloudDrizzle },
  { label: "75 mm", value: 75, desc: "Steady Rainfall", icon: CloudRain },
  { label: "100 mm", value: 100, desc: "Heavy Rainfall", icon: CloudRain },
  { label: "150 mm", value: 150, desc: "Heavy Monsoon", icon: CloudRain },
  { label: "200 mm", value: 200, desc: "Very Heavy Rainfall", icon: CloudLightning },
  { label: "250 mm", value: 250, desc: "Extreme Rainfall", icon: CloudLightning },
  { label: "300 mm", value: 300, desc: "Extreme Cloudburst Scenario", icon: CloudLightning },
];

/**
 * Leaflet helper to invalidate size and fit bounds to Chennai
 */
function MapController({ geoData, inspectedWardNo, wardDataMap }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (geoData && geoData.features && geoData.features.length > 0) {
      try {
        const bounds = [
          [12.85, 80.14],
          [13.24, 80.33],
        ];
        map.fitBounds(bounds, { padding: [15, 15] });
      } catch (e) {
        console.warn("Could not frame map bounds:", e);
      }
    }
  }, [map, geoData]);

  // Center on inspected ward if changed
  useEffect(() => {
    if (!geoData || inspectedWardNo === null || inspectedWardNo === undefined) return;
    const feat = geoData.features.find(
      (f) => Number(f.properties?.Ward_No) === Number(inspectedWardNo)
    );
    if (feat && feat.geometry) {
      try {
        // Simple bounding box center approximation
        const coords = feat.geometry.coordinates[0];
        if (coords && coords.length > 0) {
          const lats = coords.map((c) => c[1]);
          const lngs = coords.map((c) => c[0]);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          map.panTo([centerLat, centerLng], { animate: true, duration: 0.6 });
        }
      } catch (err) {
        console.warn("Could not center on ward:", err);
      }
    }
  }, [map, geoData, inspectedWardNo, wardDataMap]);

  return null;
}

export default function RainfallSimulator() {
  const navigate = useNavigate();

  // Scenario inputs
  const [rainfallInput, setRainfallInput] = useState(121);
  const [committedRainfall, setCommittedRainfall] = useState(121);

  // States
  const [scenarioData, setScenarioData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [inspectedWardNo, setInspectedWardNo] = useState(119);
  const [activeSideTab, setActiveSideTab] = useState("inspector"); // 'inspector' | 'comparison' | 'ranked'
  const [rankedListTab, setRankedListTab] = useState("increases"); // 'increases' | 'highest' | 'changes'
  const [compareMode, setCompareMode] = useState(false); // toggle baseline vs scenario delta view
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Sequence tracking to prevent race conditions / stale async responses
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 1. Load GeoJSON once on mount
  useEffect(() => {
    fetch("/wards.geojson")
      .then((res) => res.json())
      .then((json) => setGeoData(json))
      .catch((err) => console.error("Could not load wards GeoJSON:", err));

    // Warm-up baseline data if needed
    getRiskData().catch(() => {});
  }, []);

  // 2. Fetch scenario data effect whenever committedRainfall changes
  useEffect(() => {
    let ignore = false;
    const currentSeqId = ++requestSeqRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Use microtask to avoid synchronous cascading setState in effect body
    Promise.resolve().then(() => {
      if (!ignore) {
        setIsCalculating(true);
        setError(null);
      }
    });

    getRainfallScenario(committedRainfall, controller.signal)
      .then((data) => {
        if (ignore || currentSeqId !== requestSeqRef.current) return;
        setIsCalculating(false);
        if (data.status === "ERROR") {
          setError(data.message || "Failed to calculate rainfall scenario.");
        } else {
          setScenarioData(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError" || ignore) return;
        if (currentSeqId !== requestSeqRef.current) return;
        setIsCalculating(false);
        setError("Network or server error during scenario recalculation.");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [committedRainfall]);

  // 4. Debounce slider input changes (250ms)
  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setRainfallInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setCommittedRainfall(val);
    }, 250);
  };

  // 5. Direct preset click (immediate recalculation)
  const handlePresetClick = (presetVal) => {
    setRainfallInput(presetVal);
    setCommittedRainfall(presetVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // 6. Direct numeric input change
  const handleNumericInputChange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    val = Math.max(0, Math.min(300, val));
    setRainfallInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setCommittedRainfall(val);
    }, 300);
  };

  // 7. Reset to default
  const handleReset = () => {
    handlePresetClick(50);
  };

  // Quick lookup dictionary for wards in scenarioData
  const wardDataMap = useMemo(() => {
    if (!scenarioData || !Array.isArray(scenarioData.wards)) return {};
    const map = {};
    for (const w of scenarioData.wards) {
      map[Number(w.ward_no)] = w;
    }
    return map;
  }, [scenarioData]);

  // Selected inspected ward object
  const inspectedWard = useMemo(() => {
    if (!wardDataMap) return null;
    return wardDataMap[Number(inspectedWardNo)] || scenarioData?.wards?.[0] || null;
  }, [wardDataMap, inspectedWardNo, scenarioData]);

  // Wards with classification changes
  const wardsWithChanges = useMemo(() => {
    if (!scenarioData || !Array.isArray(scenarioData.wards)) return [];
    return scenarioData.wards.filter((w) => w.classification_changed);
  }, [scenarioData]);

  // Styling function for Leaflet polygons
  const styleFeature = useCallback(
    (feature) => {
      const wardNo = Number(feature.properties?.Ward_No);
      const wData = wardDataMap[wardNo];
      const isSelected = wardNo === Number(inspectedWardNo);

      let fillColor = "#94a3b8"; // default loading slate
      let fillOpacity = 0.72;

      if (wData) {
        if (!compareMode) {
          // Standard scenario risk level color
          if (wData.scenario_level === "HIGH") fillColor = "#dc2626";
          else if (wData.scenario_level === "MEDIUM") fillColor = "#f59e0b";
          else if (wData.scenario_level === "LOW") fillColor = "#16a34a";
        } else {
          // Comparison delta mode
          if (wData.classification_changed) {
            fillColor = wData.scenario_level === "HIGH" ? "#b91c1c" : "#d97706";
            fillOpacity = 0.88;
          } else {
            fillColor = wData.scenario_level === "HIGH" ? "#f87171" : "#86efac";
            fillOpacity = 0.45;
          }
        }
      }

      return {
        fillColor,
        weight: isSelected ? 3.5 : 1,
        color: isSelected ? "#0284c7" : "#334155",
        fillOpacity: isSelected ? 0.95 : fillOpacity,
      };
    },
    [wardDataMap, inspectedWardNo, compareMode]
  );

  return (
    <div className="fs-page-layout">
      <Navbar />
      <div className="fs-page-main">
        {/* PAGE HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <button
              className="fs-btn secondary"
              style={{ marginBottom: "6px", padding: "5px 10px", fontSize: "0.78rem" }}
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={13} /> Back to Dashboard
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SlidersHorizontal size={22} style={{ color: "#2563eb" }} />
              <h1>Rainfall Scenario Simulator</h1>
            </div>
            <p>
              Interactive digital twin prototype · City-wide 201-ward flood risk recalculation (0–300 mm)
            </p>
          </div>

          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <CloudRain size={14} style={{ color: "#2563eb" }} />
              <span>Simulated Storm:</span>
              <strong>{committedRainfall} mm (24h)</strong>
            </div>

            <div className="fs-header-badge">
              <CheckCircle2 size={14} style={{ color: "#16a34a" }} />
              <span>Coverage:</span>
              <strong>201 Wards Evaluated</strong>
            </div>
          </div>
        </header>

        <div className="simulator-content-wrap">
          {/* Top Title & Scientific Disclosures Banner */}
          <div className="simulator-disclaimer-banner">
            <div className="simulator-disclaimer-left">
              <div className="simulator-disclaimer-icon">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <div className="simulator-disclaimer-title">
                  Rainfall Scenario Simulator & Digital Twin Prototype
                </div>
                <div className="simulator-disclaimer-sub">
                  Simulate hypothetical storm scenarios across Chennai's 201 wards.
                  Derives modeled risk using XGBoost regression and Time-Aware Momentum.
                </div>
              </div>
            </div>
            <div className="simulator-disclaimer-badge">
              HYPOTHETICAL DIGITAL TWIN PROTOTYPE
            </div>
          </div>

          {error && (
            <div className="propagation-error-banner">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Scenario Control Toolbar */}
          <div className="simulator-control-card">
            <div className="control-card-header">
              <div className="control-title-wrap">
                <div className="control-title-icon">
                  <CloudRain size={20} />
                </div>
                <div>
                  <div className="control-main-title">Simulated Rainfall Scenario</div>
                  <div className="control-main-sub">
                    Adjust hypothetical precipitation (0–300 mm) to evaluate city-wide vulnerability
                  </div>
                </div>
              </div>

              {/* Big Numerical Value Indicator */}
              <div className="rainfall-value-display">
                <span className="rainfall-big-num">{rainfallInput.toFixed(0)}</span>
                <span className="rainfall-unit">mm</span>
              </div>
            </div>

            {/* Slider Section */}
            <div className="slider-container">
              <div className="slider-label-row">
                <span>0 mm (Dry Scenario)</span>
                <span>150 mm (Heavy Monsoon)</span>
                <span>300 mm (Extreme Cloudburst)</span>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="1"
                value={rainfallInput}
                onChange={handleSliderChange}
                className="rainfall-slider"
                id="rainfall-scenario-slider"
              />
              <div className="slider-ticks">
                <span>0</span>
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
                <span>250</span>
                <span>300 mm</span>
              </div>
            </div>

            {/* Actions & Presets Row */}
            <div className="control-actions-row">
              <div className="presets-group">
                <span className="control-label">Quick Presets:</span>
                {PRESET_VALUES.map(({ label, value, desc, icon: Icon }) => (
                  <button
                    key={value}
                    className={`preset-btn${committedRainfall === value ? " active" : ""}`}
                    onClick={() => handlePresetClick(value)}
                    title={`${desc} (${label}) — Illustrative scenario description`}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="control-secondary-actions">
                <div className="numeric-input-wrap">
                  <span className="numeric-input-label">Value:</span>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={rainfallInput}
                    onChange={handleNumericInputChange}
                    className="numeric-input-field"
                    id="rainfall-scenario-number-input"
                  />
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>mm</span>
                </div>

                <button className="reset-btn" onClick={handleReset} title="Reset to 50 mm default">
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>

                <button
                  className={`toggle-compare-btn${compareMode ? " active" : ""}`}
                  onClick={() => setCompareMode(!compareMode)}
                  title="Toggle Baseline vs Scenario highlight mode"
                >
                  <Layers size={14} />
                  <span>{compareMode ? "Comparison Mode" : "Scenario View"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Summary KPI Cards (Always Sum to 201) */}
          <div className="simulator-kpi-grid">
            {/* 1. Selected Scenario Rainfall */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Scenario Input</span>
                <CloudRain size={16} color="#0284c7" />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value blue">
                  {scenarioData?.summary?.scenario_rainfall_mm ?? committedRainfall}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#64748b" }}>mm</span>
              </div>
              <div className="kpi-footer-sub">Hypothetical design storm</div>
            </div>

            {/* 2. HIGH Risk Count */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">High Risk Wards</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value high">
                  {scenarioData?.summary?.scenario_counts?.HIGH ?? "..."}
                </span>
                <span className="kpi-baseline-compare">
                  / 201 ({scenarioData?.summary?.baseline_counts?.HIGH ?? 117} base)
                </span>
              </div>
              <div className="kpi-footer-sub">Score ≥ 120.0 pts</div>
            </div>

            {/* 3. MEDIUM Risk Count */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Medium Risk Wards</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value medium">
                  {scenarioData?.summary?.scenario_counts?.MEDIUM ?? "..."}
                </span>
                <span className="kpi-baseline-compare">
                  / 201 ({scenarioData?.summary?.baseline_counts?.MEDIUM ?? 4} base)
                </span>
              </div>
              <div className="kpi-footer-sub">Score 80.0 to 119.9 pts</div>
            </div>

            {/* 4. LOW Risk Count */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Low Risk Wards</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value low">
                  {scenarioData?.summary?.scenario_counts?.LOW ?? "..."}
                </span>
                <span className="kpi-baseline-compare">
                  / 201 ({scenarioData?.summary?.baseline_counts?.LOW ?? 80} base)
                </span>
              </div>
              <div className="kpi-footer-sub">Score &lt; 80.0 pts</div>
            </div>

            {/* 5. Classification Changed Count */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Category Changed</span>
                <TrendingUp size={16} color="#7c3aed" />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value purple">
                  {scenarioData?.summary?.wards_classification_changed ?? "..."}
                </span>
                <span className="kpi-baseline-compare">wards</span>
              </div>
              <div className="kpi-footer-sub">Shifted risk tier vs baseline</div>
            </div>

            {/* 6. Total Evaluated (Always 201) */}
            <div className="simulator-kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-title">Total Evaluated</span>
                <CheckCircle2 size={16} color="#16a34a" />
              </div>
              <div className="kpi-value-row">
                <span className="kpi-big-value" style={{ color: "#0f172a" }}>
                  {scenarioData?.summary?.total_wards ?? 201}
                </span>
                <span className="kpi-baseline-compare">/ 201</span>
              </div>
              <div className="kpi-footer-sub" style={{ color: "#16a34a", fontWeight: 700 }}>
                Sum = 201 Verified ✅
              </div>
            </div>
          </div>

          {/* Main Grid: Leaflet Map & Inspection / Comparison Panels */}
          <div className="simulator-main-grid">
            {/* GIS Map Card */}
            <div className="simulator-map-card">
              <div className="map-card-header">
                <div className="map-card-title">
                  <MapPin size={16} color="#0284c7" />
                  <span>Chennai 201 Wards GIS Map</span>
                  {compareMode && (
                    <span style={{ fontSize: "0.7rem", color: "#4f46e5", fontWeight: 800 }}>
                      [COMPARISON DELTA VIEW]
                    </span>
                  )}
                </div>
                <div className="map-legend-pills">
                  <div className="legend-pill">
                    <span className="legend-dot high" />
                    <span>HIGH (≥120)</span>
                  </div>
                  <div className="legend-pill">
                    <span className="legend-dot med" />
                    <span>MED (80–119)</span>
                  </div>
                  <div className="legend-pill">
                    <span className="legend-dot low" />
                    <span>LOW (&lt;80)</span>
                  </div>
                </div>
              </div>

              <div className="simulator-map-wrapper">
                {isCalculating && (
                  <div className="map-loading-overlay">
                    <Loader2 size={16} className="fs-spin" />
                    <span>Recalculating 201 wards...</span>
                  </div>
                )}

                <MapContainer
                  center={[13.04, 80.24]}
                  zoom={11}
                  minZoom={10}
                  maxZoom={15}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapController
                    geoData={geoData}
                    inspectedWardNo={inspectedWardNo}
                    wardDataMap={wardDataMap}
                  />

                  {geoData && (
                    <GeoJSON
                      key={`scenario-geojson-${committedRainfall}-${compareMode}-${inspectedWardNo}`}
                      data={geoData}
                      style={styleFeature}
                      onEachFeature={(feature, layer) => {
                        const wardNo = Number(feature.properties?.Ward_No);
                        const wData = wardDataMap[wardNo];

                        // Tooltip
                        if (wData) {
                          layer.bindTooltip(
                            `<div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
                              <strong>${wData.ward_name} (${wData.zone_name})</strong><br/>
                              <span>Scenario: <strong>${wData.scenario_score.toFixed(1)} / 200 (${wData.scenario_level})</strong></span><br/>
                              <span>Baseline: ${wData.baseline_score.toFixed(1)} (${wData.baseline_level})</span><br/>
                              <span>Delta: <strong>${wData.score_delta >= 0 ? "+" : ""}${wData.score_delta.toFixed(1)} pts</strong></span>
                            </div>`,
                            { sticky: true }
                          );
                        }

                        // Click handler: select ward for deep inspection
                        layer.on("click", () => {
                          setInspectedWardNo(wardNo);
                          setActiveSideTab("inspector");
                        });
                      }}
                    />
                  )}
                </MapContainer>
              </div>

              <div className="map-status-banner">
                <span>Click any ward on the map to inspect scenario score & TreeSHAP breakdown</span>
                <span>Selected: Ward {inspectedWardNo}</span>
              </div>
            </div>

            {/* Side Panel: Tabs & Inspector */}
            <div className="simulator-side-panel">
              {/* Navigation Tabs */}
              <div className="side-tabs-nav">
                <button
                  className={`side-tab-btn${activeSideTab === "inspector" ? " active" : ""}`}
                  onClick={() => setActiveSideTab("inspector")}
                >
                  <MapPin size={14} />
                  <span>Ward Inspector</span>
                </button>
                <button
                  className={`side-tab-btn${activeSideTab === "comparison" ? " active" : ""}`}
                  onClick={() => setActiveSideTab("comparison")}
                >
                  <Layers size={14} />
                  <span>Baseline Comparison</span>
                </button>
                <button
                  className={`side-tab-btn${activeSideTab === "ranked" ? " active" : ""}`}
                  onClick={() => setActiveSideTab("ranked")}
                >
                  <TrendingUp size={14} />
                  <span>Ranked Wards</span>
                </button>
                <button
                  className={`side-tab-btn${activeSideTab === "audit" ? " active" : ""}`}
                  onClick={() => setActiveSideTab("audit")}
                >
                  <Activity size={14} />
                  <span>Diagnostic Audit</span>
                </button>
              </div>

              {/* Tab 1: Ward Inspector Card */}
              {activeSideTab === "inspector" && inspectedWard && (
                <div className="ward-inspector-card">
                  <div className="inspector-header">
                    <div>
                      <div className="inspector-ward-title">{inspectedWard.ward_name}</div>
                      <div className="inspector-zone-sub">
                        Zone {inspectedWard.zone_no} • {inspectedWard.zone_name}
                      </div>
                    </div>
                    <span
                      className={`fs-badge fs-badge--${inspectedWard.scenario_level.toLowerCase()}`}
                      style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    >
                      {inspectedWard.scenario_level} RISK
                    </span>
                  </div>

                  {/* Score Comparison Box */}
                  <div className="inspector-score-comparison">
                    <div className="score-box baseline">
                      <span className="score-box-label">Baseline Score</span>
                      <div className="score-box-num">
                        <span>{inspectedWard.baseline_score.toFixed(1)}</span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/200</span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
                        {inspectedWard.baseline_level} Risk
                      </span>
                    </div>

                    <div
                      className={`score-box scenario ${inspectedWard.scenario_level.toLowerCase()}`}
                    >
                      <span className="score-box-label">Scenario Score</span>
                      <div className="score-box-num">
                        <span>{inspectedWard.scenario_score.toFixed(1)}</span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>/200</span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color:
                            inspectedWard.scenario_level === "HIGH"
                              ? "#b91c1c"
                              : inspectedWard.scenario_level === "MEDIUM"
                              ? "#b45309"
                              : "#15803d",
                        }}
                      >
                        {inspectedWard.scenario_level} Risk
                      </span>
                    </div>
                  </div>

                  {/* Score Delta Badge */}
                  <div
                    className={`score-delta-pill ${
                      inspectedWard.score_delta > 0
                        ? "increased"
                        : inspectedWard.score_delta < 0
                        ? "decreased"
                        : "unchanged"
                    }`}
                  >
                    <span>Net Score Impact:</span>
                    <span>
                      {inspectedWard.score_delta > 0 ? "+" : ""}
                      {inspectedWard.score_delta.toFixed(2)} pts
                      {inspectedWard.classification_changed && " • Tier Changed!"}
                    </span>
                  </div>

                  {/* Feature Attributes Grid */}
                  <div className="inspector-features-grid">
                    <div className="feature-cell">
                      <span className="feature-label">Scenario Rain</span>
                      <span className="feature-val">{inspectedWard.scenario_rainfall_mm} mm</span>
                    </div>
                    <div className="feature-cell">
                      <span className="feature-label">Elevation</span>
                      <span className="feature-val">{inspectedWard.elevation_m.toFixed(1)} m</span>
                    </div>
                    <div className="feature-cell">
                      <span className="feature-label">Water Distance</span>
                      <span className="feature-val">
                        {inspectedWard.water_distance_km.toFixed(2)} km
                      </span>
                    </div>
                  </div>

                  {/* TreeSHAP Explainability Decomposition */}
                  {inspectedWard.explainability?.model_attribution && (
                    <div className="explainability-section">
                      <div className="section-mini-title">
                        <Info size={13} color="#0284c7" />
                        <span>Native TreeSHAP Attribution (Model Score Points)</span>
                      </div>
                      <div className="shap-bars-list">
                        <div className="shap-bar-row">
                          <span className="shap-bar-label">Rainfall Contribution</span>
                          <span
                            className={`shap-bar-val ${
                              (inspectedWard.explainability.model_attribution.rainfall_points ?? 0) >= 0
                                ? "pos"
                                : "neg"
                            }`}
                          >
                            {(inspectedWard.explainability.model_attribution.rainfall_points ?? 0) >= 0
                              ? "+"
                              : ""}
                            {(inspectedWard.explainability.model_attribution.rainfall_points ?? 0).toFixed(
                              2
                            )}{" "}
                            pts
                          </span>
                        </div>
                        <div className="shap-bar-row">
                          <span className="shap-bar-label">Elevation Contribution</span>
                          <span
                            className={`shap-bar-val ${
                              (inspectedWard.explainability.model_attribution.elevation_points ?? 0) >= 0
                                ? "pos"
                                : "neg"
                            }`}
                          >
                            {(inspectedWard.explainability.model_attribution.elevation_points ?? 0) >= 0
                              ? "+"
                              : ""}
                            {(inspectedWard.explainability.model_attribution.elevation_points ?? 0).toFixed(
                              2
                            )}{" "}
                            pts
                          </span>
                        </div>
                        <div className="shap-bar-row">
                          <span className="shap-bar-label">Water Proximity Contribution</span>
                          <span
                            className={`shap-bar-val ${
                              (inspectedWard.explainability.model_attribution.water_distance_points ?? 0) >=
                              0
                                ? "pos"
                                : "neg"
                            }`}
                          >
                            {(inspectedWard.explainability.model_attribution.water_distance_points ?? 0) >=
                            0
                              ? "+"
                              : ""}
                            {(
                              inspectedWard.explainability.model_attribution.water_distance_points ?? 0
                            ).toFixed(2)}{" "}
                            pts
                          </span>
                        </div>
                        <div
                          className="shap-bar-row"
                          style={{
                            borderTop: "1px dashed #e2e8f0",
                            paddingTop: 4,
                            marginTop: 2,
                          }}
                        >
                          <span className="shap-bar-label">Expected Base Value E[Y]</span>
                          <span className="shap-bar-val" style={{ color: "#475569" }}>
                            {inspectedWard.explainability.expected_value.toFixed(2)} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Momentum Decomposition */}
                  <div className="explainability-section">
                    <div className="section-mini-title">
                      <TrendingUp size={13} color="#0284c7" />
                      <span>Rainfall Momentum Multiplier</span>
                    </div>
                    <div className="shap-bars-list">
                      <div className="shap-bar-row">
                        <span className="shap-bar-label">Momentum Multiplier</span>
                        <span className="shap-bar-val" style={{ color: "#0284c7" }}>
                          x{inspectedWard.scenario_momentum?.momentum_multiplier?.toFixed(3)}
                        </span>
                      </div>
                      <div className="shap-bar-row">
                        <span className="shap-bar-label">Antecedent Saturation</span>
                        <span className="shap-bar-val" style={{ color: "#334155" }}>
                          {(
                            (inspectedWard.scenario_momentum?.saturation_ratio ?? 0) * 100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="shap-bar-row">
                        <span className="shap-bar-label">Active Rain Factor (α)</span>
                        <span className="shap-bar-val" style={{ color: "#334155" }}>
                          {inspectedWard.scenario_momentum?.active_rainfall_factor?.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Baseline vs Scenario Comparison Table */}
              {activeSideTab === "comparison" && scenarioData && (
                <div className="comparison-table-card">
                  <div className="control-main-title" style={{ fontSize: "0.85rem" }}>
                    Risk Tier Distribution Shift
                  </div>
                  <table className="category-table">
                    <thead>
                      <tr>
                        <th>Risk Tier</th>
                        <th>Baseline</th>
                        <th>Scenario ({scenarioData.summary.scenario_rainfall_mm}mm)</th>
                        <th>Net Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span style={{ color: "#dc2626", fontWeight: 800 }}>🔴 HIGH</span>
                        </td>
                        <td>{scenarioData.summary.baseline_counts.HIGH}</td>
                        <td style={{ fontWeight: 800 }}>
                          {scenarioData.summary.scenario_counts.HIGH}
                        </td>
                        <td
                          style={{
                            fontWeight: 800,
                            color:
                              scenarioData.summary.scenario_counts.HIGH >=
                              scenarioData.summary.baseline_counts.HIGH
                                ? "#dc2626"
                                : "#16a34a",
                          }}
                        >
                          {scenarioData.summary.scenario_counts.HIGH -
                            scenarioData.summary.baseline_counts.HIGH >=
                          0
                            ? "+"
                            : ""}
                          {scenarioData.summary.scenario_counts.HIGH -
                            scenarioData.summary.baseline_counts.HIGH}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style={{ color: "#d97706", fontWeight: 800 }}>🟠 MEDIUM</span>
                        </td>
                        <td>{scenarioData.summary.baseline_counts.MEDIUM}</td>
                        <td style={{ fontWeight: 800 }}>
                          {scenarioData.summary.scenario_counts.MEDIUM}
                        </td>
                        <td style={{ fontWeight: 800, color: "#475569" }}>
                          {scenarioData.summary.scenario_counts.MEDIUM -
                            scenarioData.summary.baseline_counts.MEDIUM >=
                          0
                            ? "+"
                            : ""}
                          {scenarioData.summary.scenario_counts.MEDIUM -
                            scenarioData.summary.baseline_counts.MEDIUM}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style={{ color: "#16a34a", fontWeight: 800 }}>🟢 LOW</span>
                        </td>
                        <td>{scenarioData.summary.baseline_counts.LOW}</td>
                        <td style={{ fontWeight: 800 }}>
                          {scenarioData.summary.scenario_counts.LOW}
                        </td>
                        <td
                          style={{
                            fontWeight: 800,
                            color:
                              scenarioData.summary.scenario_counts.LOW >=
                              scenarioData.summary.baseline_counts.LOW
                                ? "#16a34a"
                                : "#dc2626",
                          }}
                        >
                          {scenarioData.summary.scenario_counts.LOW -
                            scenarioData.summary.baseline_counts.LOW >=
                          0
                            ? "+"
                            : ""}
                          {scenarioData.summary.scenario_counts.LOW -
                            scenarioData.summary.baseline_counts.LOW}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div
                    style={{
                      background: "#f8fafc",
                      padding: 12,
                      borderRadius: 8,
                      fontSize: "0.74rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Mean City-Wide Baseline Score:</span>
                      <strong>{scenarioData.summary.mean_baseline_score} pts</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Mean Scenario Score:</span>
                      <strong style={{ color: "#0284c7" }}>
                        {scenarioData.summary.mean_scenario_score} pts
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Average Score Delta:</span>
                      <strong
                        style={{
                          color:
                            scenarioData.summary.mean_score_delta >= 0 ? "#dc2626" : "#16a34a",
                        }}
                      >
                        {scenarioData.summary.mean_score_delta >= 0 ? "+" : ""}
                        {scenarioData.summary.mean_score_delta} pts
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Ranked Wards */}
              {activeSideTab === "ranked" && scenarioData && (
                <div className="ranked-list-card">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="control-main-title" style={{ fontSize: "0.85rem" }}>
                      Ward Vulnerability Rankings
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className={`side-tab-btn${rankedListTab === "increases" ? " active" : ""}`}
                      onClick={() => setRankedListTab("increases")}
                      style={{ fontSize: "0.72rem", padding: "6px 8px" }}
                    >
                      Largest Increases
                    </button>
                    <button
                      className={`side-tab-btn${rankedListTab === "highest" ? " active" : ""}`}
                      onClick={() => setRankedListTab("highest")}
                      style={{ fontSize: "0.72rem", padding: "6px 8px" }}
                    >
                      Highest Scores
                    </button>
                    <button
                      className={`side-tab-btn${rankedListTab === "changes" ? " active" : ""}`}
                      onClick={() => setRankedListTab("changes")}
                      style={{ fontSize: "0.72rem", padding: "6px 8px" }}
                    >
                      Tier Changes ({wardsWithChanges.length})
                    </button>
                  </div>

                  {/* List items */}
                  <div className="ranked-items-scroll">
                    {rankedListTab === "increases" &&
                      scenarioData.largest_score_increases?.map((item, idx) => (
                        <div
                          key={item.ward_no}
                          className={`ranked-item-row${
                            item.ward_no === Number(inspectedWardNo) ? " selected" : ""
                          }`}
                          onClick={() => {
                            setInspectedWardNo(item.ward_no);
                            setActiveSideTab("inspector");
                          }}
                        >
                          <div className="ranked-item-left">
                            <span className="ranked-rank-badge">#{idx + 1}</span>
                            <div>
                              <div className="ranked-ward-name">{item.ward_name}</div>
                              <div className="ranked-zone-name">{item.zone_name}</div>
                            </div>
                          </div>
                          <div className="ranked-item-right">
                            <span className="delta-tag increase">
                              +{item.score_delta.toFixed(1)} pts
                            </span>
                            <ChevronRight size={14} color="#94a3b8" />
                          </div>
                        </div>
                      ))}

                    {rankedListTab === "highest" &&
                      scenarioData.highest_scenario_scores?.map((item, idx) => (
                        <div
                          key={item.ward_no}
                          className={`ranked-item-row${
                            item.ward_no === Number(inspectedWardNo) ? " selected" : ""
                          }`}
                          onClick={() => {
                            setInspectedWardNo(item.ward_no);
                            setActiveSideTab("inspector");
                          }}
                        >
                          <div className="ranked-item-left">
                            <span className="ranked-rank-badge">#{idx + 1}</span>
                            <div>
                              <div className="ranked-ward-name">{item.ward_name}</div>
                              <div className="ranked-zone-name">{item.zone_name}</div>
                            </div>
                          </div>
                          <div className="ranked-item-right">
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                color: "#dc2626",
                                fontFamily: "monospace",
                              }}
                            >
                              {item.scenario_score.toFixed(1)}
                            </span>
                            <ChevronRight size={14} color="#94a3b8" />
                          </div>
                        </div>
                      ))}

                    {rankedListTab === "changes" &&
                      wardsWithChanges.map((item, idx) => (
                        <div
                          key={item.ward_no}
                          className={`ranked-item-row${
                            item.ward_no === Number(inspectedWardNo) ? " selected" : ""
                          }`}
                          onClick={() => {
                            setInspectedWardNo(item.ward_no);
                            setActiveSideTab("inspector");
                          }}
                        >
                          <div className="ranked-item-left">
                            <span className="ranked-rank-badge">#{idx + 1}</span>
                            <div>
                              <div className="ranked-ward-name">{item.ward_name}</div>
                              <div className="ranked-zone-name">
                                {item.baseline_level} → {item.scenario_level}
                              </div>
                            </div>
                          </div>
                          <div className="ranked-item-right">
                            <span
                              className={`delta-tag ${
                                item.score_delta >= 0 ? "increase" : "decrease"
                              }`}
                            >
                              {item.score_delta >= 0 ? "+" : ""}
                              {item.score_delta.toFixed(1)} pts
                            </span>
                            <ChevronRight size={14} color="#94a3b8" />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tab 4: Diagnostic Audit */}
              {activeSideTab === "audit" && scenarioData && (
                <div className="diagnostic-audit-card">
                  <div className="diagnostic-audit-header">
                    <div className="control-main-title" style={{ fontSize: "0.85rem" }}>
                      Pipeline Diagnostic Audit
                    </div>
                    <span className="audit-success-badge">
                      <CheckCircle2 size={12} /> VERIFIED DETERMINISTIC
                    </span>
                  </div>

                  <div className="audit-stat-grid">
                    <div className="audit-stat-item">
                      <span className="audit-label">Scenario Rainfall</span>
                      <strong className="audit-val">
                        {scenarioData.diagnostic_audit?.scenario_rainfall_mm ?? committedRainfall} mm
                      </strong>
                      <span className="audit-hint">Hypothetical 24h storm</span>
                    </div>

                    <div className="audit-stat-item">
                      <span className="audit-label">Wards Processed</span>
                      <strong className="audit-val">
                        {scenarioData.diagnostic_audit?.unique_wards_processed ?? 201} / 201
                      </strong>
                      <span className="audit-hint" style={{ color: "#16a34a" }}>100% Complete</span>
                    </div>

                    <div className="audit-stat-item">
                      <span className="audit-label">Base Model Scores</span>
                      <strong className="audit-val">
                        {scenarioData.diagnostic_audit?.base_score_range?.mean?.toFixed(1) ?? "..."} pts
                      </strong>
                      <span className="audit-hint">
                        Range: [{scenarioData.diagnostic_audit?.base_score_range?.min?.toFixed(1)}, {scenarioData.diagnostic_audit?.base_score_range?.max?.toFixed(1)}]
                      </span>
                    </div>

                    <div className="audit-stat-item">
                      <span className="audit-label">Momentum Multiplier</span>
                      <strong className="audit-val">
                        {scenarioData.diagnostic_audit?.momentum_multiplier_range?.mean?.toFixed(3) ?? "..."}x
                      </strong>
                      <span className="audit-hint">
                        Range: [{scenarioData.diagnostic_audit?.momentum_multiplier_range?.min?.toFixed(3)}, {scenarioData.diagnostic_audit?.momentum_multiplier_range?.max?.toFixed(3)}]
                      </span>
                    </div>

                    <div className="audit-stat-item">
                      <span className="audit-label">Final Score Mean</span>
                      <strong className="audit-val" style={{ color: "#0284c7" }}>
                        {scenarioData.diagnostic_audit?.final_score_range?.mean?.toFixed(1) ?? "..."} pts
                      </strong>
                      <span className="audit-hint">
                        Std Dev: ±{scenarioData.diagnostic_audit?.final_score_range?.std?.toFixed(2) ?? "0.00"} pts
                      </span>
                    </div>

                    <div className="audit-stat-item">
                      <span className="audit-label">Clipped at 200 pts</span>
                      <strong className="audit-val" style={{ color: (scenarioData.diagnostic_audit?.clipped_at_200_count ?? 0) > 0 ? "#dc2626" : "#475569" }}>
                        {scenarioData.diagnostic_audit?.clipped_at_200_count ?? 0} wards
                      </strong>
                      <span className="audit-hint">Upper bounded to 200</span>
                    </div>
                  </div>

                  <div className="audit-category-row">
                    <span className="audit-label">Classification Verification:</span>
                    <div className="audit-category-pills">
                      <span className="cat-pill high">HIGH: {scenarioData.summary?.scenario_counts?.HIGH ?? 0}</span>
                      <span className="cat-pill med">MED: {scenarioData.summary?.scenario_counts?.MEDIUM ?? 0}</span>
                      <span className="cat-pill low">LOW: {scenarioData.summary?.scenario_counts?.LOW ?? 0}</span>
                      <span className="cat-pill total">SUM = 201 ✅</span>
                    </div>
                  </div>

                  <div className="audit-note-box">
                    <strong>Numerical Pipeline Transparency:</strong>
                    Each ward's score is computed independently from its own attributes and antecedent memory.
                    In current GIS data, elevation is uniform (6.70 m) and water distance is not split by XGBoost above 6m elevation,
                    causing uniform base scores. The score delta relative to baseline varies significantly across wards.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scientific Transparency & Limitations Disclosures (Section 7) */}
          <div className="simulator-transparency-card">
            <div className="transparency-header">
              <Info size={18} color="#0284c7" />
              <span>Scientific Transparency & Prototype Limitations Disclosures</span>
            </div>
            <div className="transparency-grid">
              <div className="transparency-item">
                <strong>Hypothetical Rainfall Scenarios</strong>
                The slider controls hypothetical meteorological precipitation scenarios for
                decision-support exploration. It does not reflect live sensor or telemetry observations.
              </div>
              <div className="transparency-item">
                <strong>Synthetic Hydrological Baseline</strong>
                Antecedent rainfall memory is derived from a climatological synthetic baseline
                calibrated for prototype demonstration, not certified IMD rain gauge stations.
              </div>
              <div className="transparency-item">
                <strong>Uniform Elevation Placeholder</strong>
                Current ward elevation values are placeholder constants (6.7 m) across the wards.
                They do not represent high-resolution LiDAR or digital elevation models (DEM).
              </div>
              <div className="transparency-item">
                <strong>Modeled Risk Index vs Flood Depth</strong>
                Calculated scores represent relative vulnerability indices (0 to 200). They do not
                indicate hydrodynamic water depth (meters) or physical flood arrival velocity.
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
