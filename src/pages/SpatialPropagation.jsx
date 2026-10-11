import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Network,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Info,
  Clock,
  Compass,
  MapPin,
  Layers,
  AlertTriangle
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getSpatialPropagation, getRiskData } from "../services/api";
import "../styles/shared.css";
import "../styles/SpatialPropagation.css";

const PRESET_SOURCES = [
  { label: "Ward 119 (Central)", value: "119", desc: "Teynampet prototype baseline" },
  { label: "Ward 18 (High Risk)", value: "18", desc: "High modeled baseline risk (190/200)" },
  { label: "Ward 174 (Heavy Burst)", value: "174", desc: "Acute 1h burst candidate (151.7/200)" },
  { label: "Wards 18 & 174 (Dual)", value: "18,174", desc: "Multi-source scenario simulation" },
];

/**
 * Controller component inside MapContainer that forces Leaflet
 * to invalidate its size (preventing 0-height SVG canvas projection)
 * and frames the Chennai ward boundary bounds on initial load.
 */
function MapController({ geoData }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after paint to guarantee nonzero SVG canvas
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
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
          [13.24, 80.33]
        ];
        map.fitBounds(bounds, { padding: [15, 15] });
      } catch (e) {
        console.warn("Could not frame map bounds:", e);
      }
    }
  }, [map, geoData]);

  return null;
}

export default function SpatialPropagation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Parse initial query params if present (useful for deep-linking and automated verification)
  const paramSource = searchParams.get("source") || "119";
  const paramStep = searchParams.get("step") ? parseInt(searchParams.get("step"), 10) : 0;
  const paramWard = searchParams.get("ward") ? parseInt(searchParams.get("ward"), 10) : null;
  const paramMode = searchParams.get("mode") || "USER_DEFINED_SCENARIO";
  const paramPlay = searchParams.get("play") === "true";

  // 1. Data States
  const [geoData, setGeoData] = useState(null);
  const [scenarioData, setScenarioData] = useState(null);
  const [allBaselineData, setAllBaselineData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);

  // 2. Scenario & Inspection States (Strictly Separated)
  const [sourceWardInput, setSourceWardInput] = useState(paramSource);
  const [scenarioMode, setScenarioMode] = useState(paramMode);
  const [selectedStep, setSelectedStep] = useState(paramStep); // 0, 30, or 60 min
  const [inspectedWardId, setInspectedWardId] = useState(
    paramWard || parseInt(paramSource.split(",")[0].trim(), 10) || 119
  ); // Distinct from sourceWardInput!
  const [isPlaying, setIsPlaying] = useState(paramPlay);

  // Sequence ref for race condition / stale async prevention
  const requestSeqRef = useRef(0);
  const playTimerRef = useRef(null);

  // 1. Fetch GeoJSON boundaries on mount
  useEffect(() => {
    fetch("/wards.geojson")
      .then((res) => res.json())
      .then((json) => setGeoData(json))
      .catch((err) => console.error("Could not load wards GeoJSON:", err));
  }, []);

  // 2. Fetch baseline risk list for selector dropdown
  useEffect(() => {
    getRiskData()
      .then((data) => {
        if (Array.isArray(data)) setAllBaselineData(data);
      })
      .catch((err) => console.warn("Could not load baseline risk data:", err));
  }, []);

  // Numerically sort baseline ward data in ascending numerical order (Ward 1 -> Ward 201)
  const sortedBaselineData = useMemo(() => {
    if (!Array.isArray(allBaselineData)) return [];
    return [...allBaselineData].sort((a, b) => {
      const numA = Number(a.ward_no);
      const numB = Number(b.ward_no);
      return numA - numB;
    });
  }, [allBaselineData]);

  // Parse source ward IDs from sourceWardInput
  const sourceWardIds = useMemo(() => {
    return sourceWardInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }, [sourceWardInput]);

  // 3. Fetch spatial propagation scenario data whenever sourceWardInput or scenarioMode changes
  useEffect(() => {
    let isMounted = true;
    const currentReqId = ++requestSeqRef.current;

    getSpatialPropagation({
      source_ward: sourceWardInput,
      scenario_mode: scenarioMode,
      steps: "0,30,60"
    })
      .then((data) => {
        if (!isMounted || currentReqId !== requestSeqRef.current) return;
        setIsLoadingScenario(false);
        if (data.status === "ERROR") {
          setError(data.message || "Failed to load spatial scenario.");
        } else {
          setError(null);
          setScenarioData(data);
          // Default inspected ward to primary source if not set yet
          if (data.source_wards && data.source_wards.length > 0) {
            setInspectedWardId((prev) => (prev ? prev : data.source_wards[0]));
          }
        }
      })
      .catch((err) => {
        if (!isMounted || currentReqId !== requestSeqRef.current) return;
        setIsLoadingScenario(false);
        console.error("Spatial propagation API error:", err);
        setError("Error connecting to spatial propagation API service.");
      });

    return () => {
      isMounted = false;
    };
  }, [sourceWardInput, scenarioMode]);

  // 4. Continuous Auto-Play animation stepper (T=0 -> T+30 -> T+60 -> T=0 -> ... looping continuously)
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    playTimerRef.current = setInterval(() => {
      setSelectedStep((prev) => {
        if (prev === 0) return 30;
        if (prev === 30) return 60;
        return 0; // Seamlessly loop back to T=0 after T+60
      });
    }, 2000);

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  // Handler for source ward changes
  const handleSourceChange = (newSourceInput) => {
    setIsLoadingScenario(true);
    setError(null);
    setSourceWardInput(newSourceInput);
    setSelectedStep(0);
    setIsPlaying(false);
    const parsed = newSourceInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (parsed.length > 0) {
      setInspectedWardId(parsed[0]);
    }
  };

  // Handler for scenario mode changes
  const handleModeChange = (newMode) => {
    setIsLoadingScenario(true);
    setError(null);
    setScenarioMode(newMode);
    setSelectedStep(0);
    setIsPlaying(false);
  };

  // Handler for reset control
  const handleReset = () => {
    setIsLoadingScenario(true);
    setError(null);
    setSourceWardInput("119");
    setScenarioMode("USER_DEFINED_SCENARIO");
    setSelectedStep(0);
    setIsPlaying(false);
    setInspectedWardId(119);
  };

  // Derived Scenario Metrics
  const wardsExposure = useMemo(() => {
    return scenarioData?.wards_exposure || {};
  }, [scenarioData]);

  // Set of source wards (epicenter nodes at T=0)
  const sourceWardsSet = useMemo(() => {
    return new Set(scenarioData?.source_wards || sourceWardIds);
  }, [scenarioData, sourceWardIds]);

  // Wards exposed at or before the selected simulation step
  const exposedWardsUpToActiveStep = useMemo(() => {
    const set = new Set(sourceWardsSet);
    if (!scenarioData?.step_summaries) return set;

    if (selectedStep >= 30) {
      const step30 = scenarioData.step_summaries["30"]?.newly_exposed_wards || [];
      step30.forEach((w) => set.add(w));
    }
    if (selectedStep >= 60) {
      const step60 = scenarioData.step_summaries["60"]?.newly_exposed_wards || [];
      step60.forEach((w) => set.add(w));
    }
    return set;
  }, [scenarioData, selectedStep, sourceWardsSet]);

  // Newly exposed specifically at the active step:
  // At T=0, newly exposed neighbors is 0.
  // At T=30, newly exposed is immediate 1-hop neighbors.
  // At T=60, newly exposed is secondary 2-hop neighbors.
  const newlyExposedAtActiveStep = useMemo(() => {
    if (selectedStep === 0) {
      return new Set();
    }
    const stepInfo = scenarioData?.step_summaries?.[String(selectedStep)];
    return new Set(stepInfo?.newly_exposed_wards || []);
  }, [scenarioData, selectedStep]);

  // Total unexposed count: Total valid city wards (201) minus cumulative scenario footprint
  const totalCityWardsCount = scenarioData?.total_city_wards || 201;
  const totalUnexposedCount = useMemo(() => {
    return Math.max(0, totalCityWardsCount - exposedWardsUpToActiveStep.size);
  }, [totalCityWardsCount, exposedWardsUpToActiveStep]);

  // Inspected ward detail resolution
  const inspectedWardDetail = useMemo(() => {
    if (!inspectedWardId) return null;
    const wData = wardsExposure[String(inspectedWardId)];
    if (wData) return wData;

    // Fallback if scenarioData not loaded yet: lookup from allBaselineData
    const baseFallback = allBaselineData.find((w) => w.ward_no === inspectedWardId);
    return {
      ward_no: inspectedWardId,
      ward_name: baseFallback?.ward_name || `Ward ${inspectedWardId}`,
      baseline_risk_score: baseFallback?.score || 50.0,
      baseline_risk_level: baseFallback?.level || "LOW",
      spatial_exposure_score: 0.0,
      spatial_exposure_level: "NONE",
      propagation_step: null,
      scenario_status: "UNEXPOSED",
      source_ward_ids: [],
      propagation_path: [],
      propagation_explanation: "Outside simulated scenario footprint. This ward is not boundary-adjacent to active sources within the configured 60-minute simulation steps.",
      data_limitations: scenarioData?.data_limitations || []
    };
  }, [wardsExposure, inspectedWardId, allBaselineData, scenarioData]);

  // Role info for inspected ward
  const inspectedRoleInfo = useMemo(() => {
    if (sourceWardsSet.has(inspectedWardId)) {
      return {
        label: "Scenario Source",
        badgeClass: "blue",
        earliestStep: "T = 0 min",
        description: "Epicenter node initiating boundary propagation scenario"
      };
    }
    if (inspectedWardDetail?.propagation_step === 30) {
      return {
        label: "1-Hop Direct Neighbor",
        badgeClass: "orange",
        earliestStep: "T + 30 min",
        description: "Directly adjacent to scenario source via shared polygon boundary"
      };
    }
    if (inspectedWardDetail?.propagation_step === 60) {
      return {
        label: "2-Hop Secondary Neighbor",
        badgeClass: "amber",
        earliestStep: "T + 60 min",
        description: "Secondary neighbor connected through 1-hop exposed ward"
      };
    }
    return {
      label: "Unexposed Ward",
      badgeClass: "neutral",
      earliestStep: "Outside Horizon (> 60m)",
      description: "Outside simulated 60-minute scenario boundary footprint"
    };
  }, [inspectedWardId, sourceWardsSet, inspectedWardDetail]);

  // Polygon styling on Leaflet map
  const styleFeature = (feature) => {
    const wn = Number(feature.properties.Ward_No);
    const wardExp = wardsExposure[String(wn)];
    const isSource = sourceWardsSet.has(wn);
    const isInspected = inspectedWardId === wn;
    const isExposedInActiveHorizon = exposedWardsUpToActiveStep.has(wn);
    const isNewlyExposedAtThisStep = newlyExposedAtActiveStep.has(wn);

    // Baseline risk color for unexposed wards
    const baseLevel = wardExp?.baseline_risk_level || "LOW";
    const baseFill = baseLevel === "HIGH" ? "#ef4444" : baseLevel === "MEDIUM" ? "#f59e0b" : "#22c55e";

    if (isSource) {
      return {
        fillColor: "#2563eb",
        color: isInspected ? "#0f172a" : "#1d4ed8",
        weight: isInspected ? 3.5 : 2.5,
        fillOpacity: 0.85,
        dashArray: isInspected ? "4, 2" : undefined
      };
    }

    if (isExposedInActiveHorizon) {
      const step = wardExp?.propagation_step;
      const stepColor = step === 30 ? "#f97316" : "#fbbf24";
      const borderColor = step === 30 ? "#c2410c" : "#b45309";
      return {
        fillColor: stepColor,
        color: isInspected ? "#0f172a" : borderColor,
        weight: isInspected ? 3.5 : isNewlyExposedAtThisStep ? 2.5 : 1.5,
        fillOpacity: isNewlyExposedAtThisStep ? 0.80 : 0.60,
        dashArray: isInspected ? "4, 2" : isNewlyExposedAtThisStep ? "3, 3" : undefined
      };
    }

    // Unexposed at active horizon: render baseline risk with soft styling
    return {
      fillColor: baseFill,
      color: isInspected ? "#0f172a" : "#94a3b8",
      weight: isInspected ? 3.5 : 0.75,
      fillOpacity: isInspected ? 0.65 : 0.28,
      dashArray: isInspected ? "4, 2" : undefined
    };
  };

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
              <Network size={22} style={{ color: "#2563eb" }} />
              <h1>Spatial Flood Risk Propagation</h1>
            </div>
            <p>
              Bounded time-stepped boundary adjacency scenario modeling · Authoritative baseline risk preserved
            </p>
          </div>

          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <Compass size={14} style={{ color: "#2563eb" }} />
              <span>Scenario Mode:</span>
              <strong>{scenarioMode === "PREDICTED_RISK_SCENARIO" ? "Predicted Risk" : "User Defined"}</strong>
            </div>

            <div className="fs-header-badge">
              <Clock size={14} style={{ color: "#ea580c" }} />
              <span>Active Horizon:</span>
              <strong>T + {selectedStep} min</strong>
            </div>
          </div>
        </header>

        {/* PROPERLY PADDED CONTENT WRAPPER (Prevents flush sidebar overlap) */}
        <div className="propagation-content-wrap">

          {/* ERROR BANNER IF PRESENT */}
          {error && (
            <div className="propagation-error-banner">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* SCENARIO CONTROL TOOLBAR */}
          <div className="propagation-control-panel">
            {/* Group 1: Source & Scenario Setup */}
            <div className="propagation-control-group source-group">
              <span className="control-label">
                <MapPin size={14} style={{ color: "#2563eb" }} /> Source Ward:
              </span>

              <select
                className="propagation-select"
                value={sourceWardInput}
                onChange={(e) => handleSourceChange(e.target.value)}
                title="Select source ward to initiate scenario"
              >
                {sourceWardInput.includes(",") && (
                  <option value={sourceWardInput}>
                    Wards {sourceWardInput.split(",").join(" & ")} (Dual Source Preset)
                  </option>
                )}
                {sortedBaselineData.length > 0 ? (
                  sortedBaselineData.map((w) => (
                    <option key={w.ward_no} value={String(w.ward_no)}>
                      Ward {w.ward_no} ({w.ward_name}) · {w.level} ({Math.round(w.score)}/200)
                    </option>
                  ))
                ) : (
                  Array.from({ length: 201 }, (_, i) => i + 1).map((wn) => (
                    <option key={wn} value={String(wn)}>
                      Ward {wn} {wn === 119 ? "(Teynampet)" : wn === 18 ? "(High Risk)" : wn === 174 ? "(Burst Candidate)" : ""}
                    </option>
                  ))
                )}
              </select>

              {/* Quick Presets */}
              <div className="preset-btn-group">
                {PRESET_SOURCES.map((p) => (
                  <button
                    key={p.value}
                    className={`preset-chip${sourceWardInput === p.value ? " active" : ""}`}
                    title={p.desc}
                    onClick={() => handleSourceChange(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Scenario Mode Pill Toggle */}
              <div className="mode-toggle-group">
                <button
                  className={`mode-pill-btn${scenarioMode === "USER_DEFINED_SCENARIO" ? " active" : ""}`}
                  onClick={() => handleModeChange("USER_DEFINED_SCENARIO")}
                  title="Hypothetical scenario initiated manually"
                >
                  Hypothetical
                </button>
                <button
                  className={`mode-pill-btn${scenarioMode === "PREDICTED_RISK_SCENARIO" ? " active" : ""}`}
                  onClick={() => handleModeChange("PREDICTED_RISK_SCENARIO")}
                  title="Scenario initiated based on modeled risk"
                >
                  Modeled Risk
                </button>
              </div>
            </div>

            {/* Group 2: Simulation Timeline Controls */}
            <div className="propagation-control-group timeline-group">
              <span className="control-label">
                <Clock size={14} style={{ color: "#ea580c" }} /> Simulation Horizon:
              </span>

              <div className="timeline-stepper">
                <button
                  className={`step-btn${selectedStep === 0 ? " active" : ""}`}
                  onClick={() => { setSelectedStep(0); setIsPlaying(false); }}
                  title="T=0: Source Epicenters"
                >
                  T = 0 <span className="step-subtext">(Sources)</span>
                </button>

                <button
                  className={`step-btn${selectedStep === 30 ? " active" : ""}`}
                  onClick={() => { setSelectedStep(30); setIsPlaying(false); }}
                  title="T+30 min: 1-Hop Boundary Neighbors"
                >
                  T + 30 min <span className="step-subtext">(1-Hop)</span>
                </button>

                <button
                  className={`step-btn${selectedStep === 60 ? " active" : ""}`}
                  onClick={() => { setSelectedStep(60); setIsPlaying(false); }}
                  title="T+60 min: 2-Hop Secondary Neighbors"
                >
                  T + 60 min <span className="step-subtext">(2-Hop)</span>
                </button>

                <button
                  className={`step-btn play-btn${isPlaying ? " playing" : ""}`}
                  onClick={() => setIsPlaying((prev) => !prev)}
                  title={isPlaying ? "Stop/Pause simulation loop" : "Play continuous time-step progression (T=0 -> T+30 -> T+60 loop)"}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isPlaying ? "Pause" : "Play"}</span>
                </button>

                <button
                  className="step-btn reset-btn"
                  onClick={handleReset}
                  title="Reset simulation to default (Ward 119, T=0)"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI SUMMARY ROW */}
          <div className="fs-kpi-row">
            <div className="fs-kpi-card">
              <div className="fs-kpi-icon blue"><MapPin size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Source Wards</div>
                <div className="fs-kpi-value blue">{sourceWardsSet.size}</div>
                <div className="fs-kpi-sub">Active scenario sources at T=0</div>
              </div>
            </div>

            <div className="fs-kpi-card">
              <div className="fs-kpi-icon orange"><Network size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Newly Exposed at Active Step</div>
                <div className="fs-kpi-value orange">{newlyExposedAtActiveStep.size}</div>
                <div className="fs-kpi-sub">First included at the selected step</div>
              </div>
            </div>

            <div className="fs-kpi-card">
              <div className="fs-kpi-icon red"><Layers size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Cumulative Scenario Zone</div>
                <div className="fs-kpi-value red">{exposedWardsUpToActiveStep.size}</div>
                <div className="fs-kpi-sub">Unique source and exposed wards</div>
              </div>
            </div>

            <div className="fs-kpi-card">
              <div className="fs-kpi-icon green"><Shield size={20} /></div>
              <div className="fs-kpi-body">
                <div className="fs-kpi-label">Unexposed City Wards</div>
                <div className="fs-kpi-value green">{totalUnexposedCount}</div>
                <div className="fs-kpi-sub">Outside the current scenario footprint</div>
              </div>
            </div>
          </div>

          {/* MAIN INTERACTIVE GRID */}
          <div className="propagation-main-grid">

            {/* LEFT COLUMN: GIS MAP SECTION */}
            <div className="propagation-map-card">
              <div className="propagation-map-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Compass size={16} style={{ color: "#2563eb" }} />
                  <span className="map-title">
                    Boundary Adjacency Scenario Map
                  </span>
                  <span className="fs-badge blue" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                    {exposedWardsUpToActiveStep.size} / {totalCityWardsCount} Wards
                  </span>
                </div>

                {/* Map Layer Legend */}
                <div className="map-layer-legend">
                  <div className="legend-item" title="Selected scenario source wards at T=0">
                    <div className="legend-swatch source"></div>
                    <span>Source (T=0)</span>
                  </div>
                  <div className="legend-item" title="Immediate 1-hop boundary neighbors at T+30m">
                    <div className="legend-swatch step30"></div>
                    <span>1-Hop (T+30m)</span>
                  </div>
                  <div className="legend-item" title="Secondary 2-hop boundary neighbors at T+60m">
                    <div className="legend-swatch step60"></div>
                    <span>2-Hop (T+60m)</span>
                  </div>
                  <div className="legend-item" title="Unexposed city wards showing baseline risk">
                    <div className="legend-swatch-group">
                      <span className="swatch-dot low" title="Low Baseline"></span>
                      <span className="swatch-dot med" title="Medium Baseline"></span>
                      <span className="swatch-dot high" title="High Baseline"></span>
                    </div>
                    <span>Unexposed Base</span>
                  </div>
                </div>
              </div>

              {/* Stable, explicitly dimensioned map canvas wrapper */}
              <div className="propagation-map-canvas-wrap">
                {geoData ? (
                  <MapContainer
                    center={[13.06, 80.24]}
                    zoom={11}
                    minZoom={10}
                    maxZoom={16}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                    maxBounds={[[12.75, 79.95], [13.35, 80.45]]}
                  >
                    <MapController geoData={geoData} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <GeoJSON
                      key={`prop-map-${sourceWardInput}-${selectedStep}-${inspectedWardId}`}
                      data={geoData}
                      style={styleFeature}
                      onEachFeature={(feat, layer) => {
                        const wn = Number(feat.properties.Ward_No);
                        const wData = wardsExposure[String(wn)];
                        const isSrc = sourceWardsSet.has(wn);
                        const isExp = exposedWardsUpToActiveStep.has(wn);

                        layer.on("click", () => {
                          setInspectedWardId(wn); // Inspects clicked ward WITHOUT changing scenario source!
                        });

                        layer.bindTooltip(
                          `<div style="font-family: inherit; font-size: 0.76rem; padding: 4px;">
                            <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px;">
                              ${wData?.ward_name || `Ward ${wn}`} (Ward #${wn})
                            </div>
                            <div><strong>Scenario Role:</strong> ${
                              isSrc ? "SCENARIO SOURCE" :
                              isExp ? `EXPOSED AT T+${wData?.propagation_step}m` :
                              "UNEXPOSED (Outside Horizon)"
                            }</div>
                            <div><strong>Baseline Risk:</strong> ${wData?.baseline_risk_level || "LOW"} (${wData ? Math.round(wData.baseline_risk_score) : 0}/200)</div>
                            <div><strong>Spatial Exposure:</strong> ${isExp || isSrc ? `${wData?.spatial_exposure_level || "NONE"} (${wData ? Math.round(wData.spatial_exposure_score) : 0}/100)` : "NONE (0/100)"}</div>
                            <div style="margin-top: 4px; font-size: 0.68rem; color: #2563eb;">Click to inspect details in side panel →</div>
                          </div>`,
                          { sticky: true }
                        );
                      }}
                    />
                  </MapContainer>
                ) : (
                  <div className="map-loading-placeholder">
                    Loading ward boundary geometry...
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: WARD DETAIL & TIMELINE BREAKDOWN */}
            <div className="propagation-side-col">

              {/* WARD EXPOSURE DETAIL CARD */}
              <div className="fs-card detail-card-container">
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={16} style={{ color: "#2563eb" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>
                      Ward Exposure Detail
                    </span>
                  </div>
                  <div className="inspected-pill-tag">
                    Inspected Ward #{inspectedWardId}
                  </div>
                </div>

                {isLoadingScenario ? (
                  <div className="detail-loading-box">
                    <div className="detail-spinner" />
                    <span>Loading scenario data for Ward #{inspectedWardId}...</span>
                  </div>
                ) : (
                  <div className="detail-card-section">

                    {/* Ward Identity & Role Header */}
                    <div className="ward-identity-block">
                      <div className="identity-title-row">
                        <h3 className="ward-name-text">
                          {inspectedWardDetail?.ward_name || `Ward ${inspectedWardId}`}
                        </h3>
                        <span className="ward-code-badge">Ward #{inspectedWardId}</span>
                      </div>

                      <div className="role-status-row">
                        <span className={`fs-badge role-pill ${inspectedRoleInfo.badgeClass}`}>
                          Role: {inspectedRoleInfo.label}
                        </span>
                        <span className="step-pill">
                          Earliest: {inspectedRoleInfo.earliestStep}
                        </span>
                      </div>

                      <div className="context-meta-bar">
                        <span className="meta-pair">
                          <strong>Active Source(s):</strong> Ward {sourceWardIds.join(", ")}
                        </span>
                        <span className="meta-divider">·</span>
                        <span className="meta-pair">
                          <strong>Inspected:</strong> Ward {inspectedWardId}
                        </span>
                      </div>
                    </div>

                    {/* Side-by-Side Comparison Table */}
                    <table className="exposure-comparison-table">
                      <thead>
                        <tr>
                          <th>Metric Dimension</th>
                          <th>Baseline Risk</th>
                          <th>Spatial Exposure</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Score</td>
                          <td>
                            <strong>{inspectedWardDetail ? Math.round(inspectedWardDetail.baseline_risk_score) : 0}</strong> / 200
                          </td>
                          <td>
                            <strong>{inspectedWardDetail ? Math.round(inspectedWardDetail.spatial_exposure_score) : 0}</strong> / 100
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Level</td>
                          <td>
                            <span className={`fs-badge ${inspectedWardDetail?.baseline_risk_level === "HIGH" ? "high" : inspectedWardDetail?.baseline_risk_level === "MEDIUM" ? "medium" : "low"}`} style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
                              {inspectedWardDetail?.baseline_risk_level || "LOW"}
                            </span>
                          </td>
                          <td>
                            <span className={`fs-badge ${inspectedWardDetail?.spatial_exposure_level === "ELEVATED" ? "high" : inspectedWardDetail?.spatial_exposure_level === "MODERATE" ? "medium" : "low"}`} style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
                              {inspectedWardDetail?.spatial_exposure_level || "NONE"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Calculation Engine</td>
                          <td style={{ color: "#64748b", fontSize: "0.72rem" }}>
                            XGBoost + Rainfall Momentum
                          </td>
                          <td style={{ color: "#2563eb", fontSize: "0.72rem", fontWeight: 600 }}>
                            Boundary Adjacency Scenario
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Operational Status</td>
                          <td style={{ color: "#0f172a", fontSize: "0.72rem" }}>
                            Authoritative Ground Risk
                          </td>
                          <td style={{ color: "#475569", fontSize: "0.72rem" }}>
                            {sourceWardsSet.has(inspectedWardId) ? (
                              <strong style={{ color: "#2563eb" }}>Active Scenario Epicenter</strong>
                            ) : exposedWardsUpToActiveStep.has(inspectedWardId) ? (
                              <strong style={{ color: "#ea580c" }}>Reached @ T+{inspectedWardDetail?.propagation_step}m</strong>
                            ) : inspectedWardDetail?.propagation_step ? (
                              <span>Reaches @ T+{inspectedWardDetail.propagation_step}m</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>Outside Scenario Footprint</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Adjacency Transmission Chain */}
                    <div className="transmission-chain-box">
                      <div className="section-subheading">
                        Adjacency Transmission Chain:
                      </div>
                      {sourceWardsSet.has(inspectedWardId) ? (
                        <div className="propagation-path-bar">
                          <span className="path-node-btn active">Ward {inspectedWardId}</span>
                          <span className="path-source-tag">Scenario Inception Epicenter</span>
                        </div>
                      ) : inspectedWardDetail?.propagation_path && inspectedWardDetail.propagation_path.length > 1 ? (
                        <div className="propagation-path-bar">
                          {inspectedWardDetail.propagation_path.map((w, idx) => (
                            <span key={w} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <button
                                className={`path-node-btn${w === inspectedWardId ? " active" : ""}`}
                                onClick={() => setInspectedWardId(w)}
                                title={`Inspect Ward ${w}`}
                              >
                                Ward {w}
                              </button>
                              {idx < inspectedWardDetail.propagation_path.length - 1 && (
                                <span className="path-arrow">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="path-empty-msg">
                          No transmission path — Ward #{inspectedWardId} is outside the simulated scenario horizon.
                        </div>
                      )}
                    </div>

                    {/* Scenario Inclusion Explanation */}
                    <div className="inclusion-explanation-box">
                      <div className="section-subheading">
                        Scenario Inclusion Explanation:
                      </div>
                      <p className="explanation-paragraph">
                        {inspectedWardDetail?.propagation_explanation ||
                          `Ward ${inspectedWardId} is outside the active scenario footprint. It does not share a boundary with source Ward(s) within the configured 60-minute simulation steps.`}
                      </p>
                    </div>

                    {/* Data Limitations Note */}
                    <div className="data-limitations-mini-box">
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                        <Info size={12} style={{ color: "#64748b" }} />
                        <strong style={{ fontSize: "0.7rem", color: "#475569" }}>Data &amp; Modeling Limitations:</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.68rem", color: "#64748b", lineHeight: 1.4 }}>
                        Topological boundary adjacency scenario proxy only. Directional hydraulic flow, underground drainage conduits, and micro-elevation barriers are not modeled; uniform or missing micro-elevation is not used to fabricate downhill flow.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* TIMELINE STEP SUMMARY CARD */}
              <div className="fs-card timeline-card-container">
                <div className="decision-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Clock size={16} style={{ color: "#ea580c" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e293b" }}>
                      Simulation Horizon Breakdown
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    3 Bounded Steps
                  </span>
                </div>

                <div style={{ padding: "12px" }}>
                  {/* Step 0 */}
                  <div className={`step-accordion-item${selectedStep === 0 ? " active-step" : ""}`}>
                    <div className="step-accordion-header" onClick={() => setSelectedStep(0)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="step-dot source"></span>
                        <span>T = 0 min · Scenario Sources</span>
                      </div>
                      <span className="fs-badge blue">{sourceWardsSet.size} Source{sourceWardsSet.size > 1 ? "s" : ""}</span>
                    </div>
                    <div className="step-accordion-body">
                      {Array.from(sourceWardsSet).map((w) => (
                        <span
                          key={w}
                          className={`ward-badge-pill source${inspectedWardId === w ? " active" : ""}`}
                          onClick={() => setInspectedWardId(w)}
                          title={`Inspect Ward ${w}`}
                        >
                          Ward {w}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Step 30 */}
                  <div className={`step-accordion-item${selectedStep === 30 ? " active-step" : ""}`}>
                    <div className="step-accordion-header" onClick={() => setSelectedStep(30)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="step-dot step30"></span>
                        <span>T + 30 min · 1-Hop Direct Boundary</span>
                      </div>
                      <span className="fs-badge" style={{ background: "#ffedd5", color: "#9a3412" }}>
                        {scenarioData?.step_summaries?.["30"]?.newly_exposed_count || 0} Newly Exposed
                      </span>
                    </div>
                    <div className="step-accordion-body">
                      {(scenarioData?.step_summaries?.["30"]?.newly_exposed_wards || []).map((w) => (
                        <span
                          key={w}
                          className={`ward-badge-pill step30${inspectedWardId === w ? " active" : ""}`}
                          onClick={() => setInspectedWardId(w)}
                          title={`Inspect Ward ${w}`}
                        >
                          Ward {w}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Step 60 */}
                  <div className={`step-accordion-item${selectedStep === 60 ? " active-step" : ""}`}>
                    <div className="step-accordion-header" onClick={() => setSelectedStep(60)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="step-dot step60"></span>
                        <span>T + 60 min · 2-Hop Secondary Adjacency</span>
                      </div>
                      <span className="fs-badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                        {scenarioData?.step_summaries?.["60"]?.newly_exposed_count || 0} Newly Exposed
                      </span>
                    </div>
                    <div className="step-accordion-body">
                      {(scenarioData?.step_summaries?.["60"]?.newly_exposed_wards || []).map((w) => (
                        <span
                          key={w}
                          className={`ward-badge-pill step60${inspectedWardId === w ? " active" : ""}`}
                          onClick={() => setInspectedWardId(w)}
                          title={`Inspect Ward ${w}`}
                        >
                          Ward {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SCIENTIFIC DISCLAIMER CALLOUT BANNER */}
          <div className="propagation-disclaimer-callout">
            <Info size={20} style={{ color: "#2563eb", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div className="disclaimer-title">Operational Scenario Guidance &amp; Scientific Disclaimer</div>
              <div className="disclaimer-text">
                Spatial propagation is an adjacency-based scenario using available ward geography. T=0, T+30 and T+60 are illustrative simulation steps, not validated flood-arrival predictions. The current model does not fully represent terrain micro-topography, drainage infrastructure, barriers, water levels or hydraulic flow.
              </div>
              <div className="disclaimer-bullets">
                <span>• Baseline risk scores are calculated independently by the XGBoost &amp; rainfall-momentum engine and remain strictly authoritative.</span>
                <span>• Simulated spatial exposure serves as secondary monitoring decision-support and does not confirm observed inundation or mandate public evacuation.</span>
              </div>
            </div>
          </div>

        </div>

        <Footer />
      </div>
    </div>
  );
}
