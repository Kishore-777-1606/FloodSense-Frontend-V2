import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Ruler,
  Thermometer,
  Droplets,
  Activity,
  AlertTriangle,
  Clock,
  Info,
} from "lucide-react";
import { useWard1Live } from "../context/Ward1LiveContext";
import "./Ward1TelemetryChart.css";

function formatTimestampLabel(isoStr) {
  if (!isoStr) return "--:--:--";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(isoStr);
  }
}

function calculateDomain(values, fallbackMin, fallbackMax, paddingPct = 0.12) {
  const validVals = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (validVals.length === 0) return [fallbackMin, fallbackMax];

  const min = Math.min(...validVals);
  const max = Math.max(...validVals);

  if (min === max) {
    return [Math.max(0, Math.floor(min - 2)), Math.ceil(max + 2)];
  }

  const range = max - min;
  const pad = Math.max(1, range * paddingPct);
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

function CustomTelemetryTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rf-chart-tooltip">
        <div className="rf-chart-tooltip-time">
          <Clock size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
          <span>{label}</span>
        </div>
        {payload.map((entry, idx) => (
          <div key={`item-${idx}`} className="rf-chart-tooltip-metric">
            <div className="rf-chart-tooltip-val">
              {entry.value != null ? Number(entry.value).toFixed(1) : "--"}{" "}
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#93c5fd" }}>{entry.unit}</span>
            </div>
            <div className="rf-chart-tooltip-src">{entry.name}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function Ward1TelemetryChart({ initialTab = "distance" }) {
  const { history, isStale, ageSeconds, loading, error } = useWard1Live();
  const [activeTab, setActiveTab] = useState(initialTab); // "distance", "temperature", "humidity"

  // Transform genuine MongoDB records into time-series chart data points
  const chartData = useMemo(() => {
    if (!history || !Array.isArray(history)) return [];

    return history.map((record) => {
      const readings = record.sensor_readings || {};
      const ultrasonic = readings.ultrasonic_telemetry || {};
      const isoTime = record.received_at_iso || record.received_at;

      return {
        timestamp: isoTime,
        displayTime: formatTimestampLabel(isoTime),
        distance_cm: ultrasonic.value_cm != null ? Number(ultrasonic.value_cm) : null,
        temperature_c: readings.temperature_c != null ? Number(readings.temperature_c) : null,
        humidity_pct: readings.humidity_pct != null ? Number(readings.humidity_pct) : null,
      };
    });
  }, [history]);

  // Compute dynamic domains with padding
  const distanceDomain = useMemo(
    () => calculateDomain(chartData.map((d) => d.distance_cm), 0, 150, 0.12),
    [chartData]
  );

  const temperatureDomain = useMemo(
    () => calculateDomain(chartData.map((d) => d.temperature_c), 20, 45, 0.15),
    [chartData]
  );

  const humidityDomain = useMemo(
    () => calculateDomain(chartData.map((d) => d.humidity_pct), 40, 100, 0.1),
    [chartData]
  );

  if (loading && chartData.length === 0) {
    return (
      <div className="telemetry-chart-loading">
        <Activity size={24} className="spinning-icon" />
        <span>Loading live Ward 1 ESP32 telemetry trend...</span>
      </div>
    );
  }

  if (error && chartData.length === 0) {
    return (
      <div className="telemetry-chart-error">
        <AlertTriangle size={24} style={{ color: "#ef4444" }} />
        <span>Live Telemetry Unavailable: {error}</span>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="telemetry-chart-empty">
        <Activity size={28} style={{ color: "#94a3b8" }} />
        <h4>Awaiting Telemetry Samples</h4>
        <p>No live ESP32 records recorded in MongoDB yet for Ward 1.</p>
      </div>
    );
  }

  return (
    <div className="rf-chart-card ward1-common-chart-card">
      {/* Header and Series Switcher */}
      <div className="rf-chart-header">
        <div className="rf-chart-title-block">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              className="status-dot-pulse"
              style={{ background: isStale ? "#f59e0b" : "#10b981" }}
            />
            <h3 style={{ margin: 0 }}>Ward 1 ESP32 Live Telemetry Trend</h3>
            <span
              className="fs-badge"
              style={{
                background: isStale ? "#fef3c7" : "#ecfdf5",
                color: isStale ? "#92400e" : "#065f46",
                borderColor: isStale ? "#fde68a" : "#a7f3d0",
                fontSize: "0.68rem",
                padding: "2px 8px",
              }}
            >
              {isStale ? `STALE (${ageSeconds}s)` : "LIVE (5s Cadence)"}
            </span>
          </div>
          <p>
            Actual chronological observations from MongoDB <code>ward1_live_data</code> ({chartData.length} samples)
          </p>
        </div>

        {/* Tab Controls in Common Blue FloodSense Style */}
        <div className="rf-chart-badges">
          <div className="chart-tab-group">
            <button
              type="button"
              className={`chart-tab-btn ${activeTab === "distance" ? "active" : ""}`}
              onClick={() => setActiveTab("distance")}
            >
              <Ruler size={13} />
              <span>Ultrasonic (mm)</span>
            </button>
            <button
              type="button"
              className={`chart-tab-btn ${activeTab === "temperature" ? "active" : ""}`}
              onClick={() => setActiveTab("temperature")}
            >
              <Thermometer size={13} />
              <span>Temp (°C)</span>
            </button>
            <button
              type="button"
              className={`chart-tab-btn ${activeTab === "humidity" ? "active" : ""}`}
              onClick={() => setActiveTab("humidity")}
            >
              <Droplets size={13} />
              <span>Humidity (%)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas in Common Blue Design */}
      <div className="rf-chart-container" style={{ height: "260px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "distance" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="ward1BlueGrad" x1="0" y1="0" x2="0" y2="1">
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
                domain={distanceDomain}
                unit=" mm"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTelemetryTooltip />} />
              <Area
                type="monotone"
                dataKey="distance_cm"
                name="Ultrasonic Telemetry"
                unit="mm"
                stroke="#1e88e5"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#ward1BlueGrad)"
              />
            </AreaChart>
          ) : activeTab === "temperature" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="ward1TempGrad" x1="0" y1="0" x2="0" y2="1">
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
                domain={temperatureDomain}
                unit="°C"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTelemetryTooltip />} />
              <Area
                type="monotone"
                dataKey="temperature_c"
                name="Ambient Temperature"
                unit="°C"
                stroke="#1e88e5"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#ward1TempGrad)"
              />
            </AreaChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="ward1HumGrad" x1="0" y1="0" x2="0" y2="1">
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
                domain={humidityDomain}
                unit="%"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTelemetryTooltip />} />
              <Area
                type="monotone"
                dataKey="humidity_pct"
                name="Relative Humidity"
                unit="%"
                stroke="#1e88e5"
                strokeWidth={2.2}
                fillOpacity={1}
                fill="url(#ward1HumGrad)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Common Design Footnote */}
      <div className="rf-chart-footnote">
        <Info size={14} style={{ color: "#1e88e5", flexShrink: 0 }} />
        <span>
          <strong>Microclimate & Ultrasonic Telemetry:</strong> Telemetry points are genuine records from MongoDB{" "}
          <code>ward1_live_data</code> with verified server receipts. The ultrasonic reading displays in mm as requested.
          Note that this is an ultrasonic sensor reading (distance to channel/water surface), not measured rainfall from a physical rain gauge.
        </span>
      </div>
    </div>
  );
}
