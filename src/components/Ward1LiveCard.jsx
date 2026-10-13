import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  Thermometer,
  Droplets,
  Ruler,
  Clock,
  Cpu,
  ChevronRight,
  AlertTriangle,
  Info,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useWard1Live } from "../context/Ward1LiveContext";
import Ward1TelemetryChart from "./Ward1TelemetryChart";
import "./Ward1LiveCard.css";

export default function Ward1LiveCard({ onTelemetryUpdate }) {
  const navigate = useNavigate();
  const { telemetry, loading, error, isStale, ageSeconds, formatServerTime } = useWard1Live();
  const [showChart, setShowChart] = useState(true);

  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  useEffect(() => {
    onTelemetryUpdateRef.current = onTelemetryUpdate;
  }, [onTelemetryUpdate]);

  useEffect(() => {
    if (telemetry && onTelemetryUpdateRef.current) {
      onTelemetryUpdateRef.current(telemetry);
    }
  }, [telemetry]);

  const readings = telemetry?.sensor_readings || {};
  const ultrasonic = readings.ultrasonic_telemetry || {};
  const wardProps = telemetry?.ward_properties || {};
  const risk = telemetry?.risk_assessment || {};

  const handleAnalyseWard1 = () => {
    const wardObj = {
      ward_no: 1,
      ward_name: wardProps.Zone_Name ? `Ward 1 (${wardProps.Zone_Name})` : "Ward 1",
      rainfall: wardProps.baseline_rainfall_mm ?? 39.2,
      rainfall_mm: wardProps.baseline_rainfall_mm ?? 39.2,
      elevation: wardProps.elevation_m ?? 6.7,
      elevation_m: wardProps.elevation_m ?? 6.7,
      water_distance: wardProps.water_distance_km ?? 25.471,
      water_distance_km: wardProps.water_distance_km ?? 25.471,
      level: risk.level || "LOW",
      score: risk.score ?? 49.53,
    };
    localStorage.setItem("selectedWard", JSON.stringify(wardObj));
    navigate("/analysis");
  };

  return (
    <div className="ward1-card-wrapper" data-testid="ward1-telemetry-container">
      <div className="ward1-card">
        {/* HEADER BAR */}
        <div className="ward1-card-header">
          <div className="ward1-header-title-block">
            <div className="ward1-title-badge">
              <Cpu size={14} />
              <span>LIVE EDGE DEPLOYMENT</span>
            </div>
            <h3 className="ward1-title">Ward 1 — Thiruvottiyur</h3>
            <span className="ward1-subtitle">
              Dedicated ESP32 Telemetry Node · 5-Second Ingestion Stream
            </span>
          </div>

          <div className="ward1-header-status-block">
            {loading && !telemetry ? (
              <span className="ward1-badge neutral">Connecting to stream…</span>
            ) : error && !telemetry ? (
              <span className="ward1-badge error">
                <AlertTriangle size={13} /> {error}
              </span>
            ) : isStale ? (
              <span className="ward1-badge warning">
                <span className="pulse-dot warning"></span>
                STALE SIGNAL ({ageSeconds}s ago)
              </span>
            ) : (
              <span className="ward1-badge live">
                <span className="pulse-dot active"></span>
                ACTIVE STREAM (5s)
              </span>
            )}

            <div className="ward1-timestamp-row">
              <Clock size={13} className="ward1-clock-icon" />
              <span>Server Receipt:</span>
              <strong className="ward1-timestamp-val">
                {formatServerTime(telemetry?.received_at_iso)}
              </strong>
            </div>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="ward1-metrics-grid">
          {/* 1. TEMPERATURE */}
          <div className="ward1-metric-tile" data-testid="ward1-temperature">
            <div className="ward1-metric-icon orange">
              <Thermometer size={18} />
            </div>
            <div className="ward1-metric-content">
              <span className="ward1-metric-label">Temperature</span>
              <div className="ward1-metric-value">
                {readings.temperature_c != null
                  ? readings.temperature_c.toFixed(1)
                  : "--"}
                <span className="ward1-unit">°C</span>
              </div>
              <span className="ward1-metric-sub">DHT22 Ambient Microclimate</span>
            </div>
          </div>

          {/* 2. HUMIDITY */}
          <div className="ward1-metric-tile" data-testid="ward1-humidity">
            <div className="ward1-metric-icon cyan">
              <Droplets size={18} />
            </div>
            <div className="ward1-metric-content">
              <span className="ward1-metric-label">Relative Humidity</span>
              <div className="ward1-metric-value">
                {readings.humidity_pct != null
                  ? readings.humidity_pct.toFixed(1)
                  : "--"}
                <span className="ward1-unit">%</span>
              </div>
              <span className="ward1-metric-sub">DHT22 Ambient Vapor Sensor</span>
            </div>
          </div>

          {/* 3. ULTRASONIC DISTANCE */}
          <div className="ward1-metric-tile highlight" data-testid="ward1-distance">
            <div className="ward1-metric-icon blue">
              <Ruler size={18} />
            </div>
            <div className="ward1-metric-content">
              <span className="ward1-metric-label">Ultrasonic Telemetry</span>
              <div className="ward1-metric-value">
                {ultrasonic.value_cm != null
                  ? ultrasonic.value_cm.toFixed(1)
                  : "--"}
                <span className="ward1-unit">mm</span>
              </div>
              <span className="ward1-metric-sub">
                JSN-SR04M-2 Sensor to Surface
              </span>
            </div>
          </div>

          {/* 4. LIVE INPUT (ESP32) */}
          <div className="ward1-metric-tile" data-testid="ward1-rainfall-baseline">
            <div className="ward1-metric-icon purple">
              <Radio size={18} />
            </div>
            <div className="ward1-metric-content">
              <span className="ward1-metric-label">Live Input (ESP32)</span>
              <div className="ward1-metric-value">
                {(ultrasonic.value_cm != null ? ultrasonic.value_cm : (wardProps.baseline_rainfall_mm ?? 39.2)).toFixed(1)}
                <span className="ward1-unit">mm</span>
              </div>
              <span className="ward1-metric-sub">
                Model Feature 0 (Live Telemetry)
              </span>
            </div>
          </div>
        </div>

        {/* REAL-TIME DYNAMIC TREND GRAPH COLLAPSIBLE SECTION */}
        <div className="ward1-chart-toggle-row">
          <button
            type="button"
            className="ward1-chart-toggle-btn"
            onClick={() => setShowChart(!showChart)}
          >
            <TrendingUp size={14} />
            <span>{showChart ? "Hide Real-Time Trend Graph" : "Show Real-Time Dynamic Sensor Trend"}</span>
            {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showChart && <Ward1TelemetryChart initialTab="distance" />}

        {/* SCIENTIFIC MODEL INTEGRITY & ACTIONS FOOTER */}
        <div className="ward1-card-footer">
          <div className="ward1-disclaimer">
            <Info size={14} className="ward1-info-icon" />
            <span>
              <strong>Model Independence Note:</strong> Temperature, humidity, and
              ultrasonic distance are edge microclimate and distance telemetry. The
              XGBoost risk engine evaluates strictly 3 features: baseline rainfall
              (39.2 mm), elevation (6.7 m), and canal distance (25.5 km). Live edge
              telemetry does not alter the machine learning flood-risk score.
            </span>
          </div>

          <button className="ward1-action-btn" onClick={handleAnalyseWard1}>
            <span>Analyse Ward 1</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
