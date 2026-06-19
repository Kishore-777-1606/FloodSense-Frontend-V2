import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CloudRain,
  Clock,
  MapPin,
  Mountain,
  Waves,
  ChevronRight,
  AlertTriangle,
  Shield,
  Info,
  ArrowLeft,
} from "lucide-react";
import WardMiniMap from "../components/WardMiniMap";
import Sidebar from "../components/Sidebar";
import "../styles/shared.css";
import "../styles/Analysis.css";

function getRiskColor(level) {
  if (!level) return "#64748b";
  const l = level.toUpperCase();
  if (l === "HIGH") return "#ef4444";
  if (l === "VERY HIGH") return "#b91c1c";
  if (l === "MEDIUM") return "#f97316";
  return "#22c55e";
}

function getBarColor(score) {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  return "#22c55e";
}

function getBarLabel(score) {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getRainfallImpact(rainfall) { return Math.min(100, Math.round((rainfall / 300) * 100)); }
function getElevationImpact(elevation) {
  if (elevation <= 1) return 95;
  if (elevation <= 3) return 80;
  if (elevation <= 6) return 60;
  if (elevation <= 10) return 40;
  return 20;
}
function getProximityImpact(distance) {
  if (distance <= 0.2) return 90;
  if (distance <= 0.5) return 75;
  if (distance <= 1) return 55;
  if (distance <= 2) return 35;
  return 20;
}
function getComparisonPercent(score) { return Math.min(99, Math.round((score / 200) * 100) + 20); }

function formatTimestamp() {
  return new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function Analysis() {
  const navigate = useNavigate();
  const [ward, setWard] = useState(null);
  const [timestamp] = useState(formatTimestamp());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("selectedWard");
      if (stored) setWard(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  if (!ward) {
    return (
      <div className="fs-page-layout">
        <Sidebar />
        <div className="fs-page-main">
          <header className="fs-page-header">
            <div className="fs-page-header-left">
              <h1>Ward Analysis</h1>
              <p>Detailed flood risk analysis for the selected ward</p>
            </div>
          </header>
          <div className="fs-empty" style={{ marginTop: "80px" }}>
            <div className="fs-empty-icon"><AlertTriangle size={52} /></div>
            <h3>No ward selected</h3>
            <p>Go back to the Dashboard and click on a ward on the map to analyse it.</p>
            <button className="fs-btn primary" onClick={() => navigate("/dashboard")} style={{ marginTop: "8px" }}>
              <ArrowLeft size={15} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rainfallImpact = getRainfallImpact(ward.rainfall);
  const elevationImpact = getElevationImpact(ward.elevation);
  const proximityImpact = getProximityImpact(ward.water_distance);
  const comparisonPct = getComparisonPercent(ward.score);
  const riskColor = getRiskColor(ward.level);

  return (
    <div className="fs-page-layout">
      <Sidebar />

      <div className="fs-page-main">
        {/* HEADER */}
        <header className="fs-page-header">
          <div className="fs-page-header-left">
            <button
              className="fs-btn secondary"
              style={{ marginBottom: "6px", padding: "6px 12px", fontSize: "0.8rem" }}
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={14} /> Dashboard
            </button>
            <h1>Ward Analysis</h1>
            <p>Detailed flood risk breakdown · {timestamp}</p>
          </div>
          <div className="fs-page-header-right">
            <div className="fs-header-badge">
              <CloudRain size={14} />
              <span>Rainfall:</span>
              <strong>{ward.rainfall} mm</strong>
            </div>
            <div className="fs-header-badge">
              <Clock size={14} />
              <strong>{timestamp}</strong>
            </div>
          </div>
        </header>

        <div className="fs-content">
          {/* ROW 1: Ward Overview + Mini Map */}
          <div className="analysis-row analysis-row-top">
            <div className="fs-card ward-overview-card">
              <div className="fs-card-label">Selected Ward</div>
              <div className="ward-overview-header">
                <div className="ward-name-block">
                  <MapPin size={18} className="ward-pin-icon" />
                  <div>
                    <h2 className="ward-name">{ward.ward_name}</h2>
                    <p className="ward-id">Ward ID: W-{ward.ward_no}</p>
                  </div>
                </div>
                <span className="fs-badge" style={{
                  background: riskColor + "18",
                  color: riskColor,
                  border: `1px solid ${riskColor}30`,
                  fontSize: "0.75rem",
                  padding: "5px 12px",
                }}>
                  {ward.level} RISK
                </span>
              </div>

              <div className="risk-score-block">
                <p className="risk-score-label">Risk Score</p>
                <p className="risk-score-value" style={{ color: riskColor }}>
                  {Math.round(ward.score)}
                  <span className="risk-score-max"> / 200</span>
                </p>
              </div>

              <div className="ward-details-list">
                <DetailRow icon={<CloudRain size={16} />} label="Rainfall Input" value={`${ward.rainfall} mm`} />
                <DetailRow icon={<Mountain size={16} />} label="Elevation" value={`${ward.elevation} m`} />
                <DetailRow icon={<Waves size={16} />} label="Distance to Water" value={`${ward.water_distance} km`} />
                <DetailRow icon={<Clock size={16} />} label="Analysis Time" value={timestamp} />
              </div>
            </div>

            <div className="fs-card ward-map-card">
              <div className="fs-card-label">Ward Location</div>
              <div className="ward-map-container">
                <WardMiniMap wardNo={ward.ward_no} wardName={ward.ward_name} />
              </div>
            </div>
          </div>

          {/* ROW 2: Risk Breakdown + Summary */}
          <div className="analysis-row analysis-row-mid">
            <div className="fs-card risk-breakdown-card">
              <div className="fs-card-label">Risk Factor Breakdown</div>
              <RiskBar
                icon={<CloudRain size={19} />} iconBg="rain-icon-bg"
                title="Rainfall Intensity Impact"
                desc="Higher rainfall increases flood risk"
                score={rainfallImpact}
              />
              <RiskBar
                icon={<Mountain size={19} />} iconBg="elev-icon-bg"
                title="Low Elevation Impact"
                desc="Lower elevation areas are more prone to flooding"
                score={elevationImpact}
              />
              <RiskBar
                icon={<Waves size={19} />} iconBg="water-icon-bg"
                title="Proximity to Water Bodies"
                desc="Closer proximity to water increases overflow risk"
                score={proximityImpact}
              />
            </div>

            <div className="fs-card risk-summary-card">
              <div className="fs-card-label">Risk Summary</div>
              <div className="risk-summary-main">
                <div className="risk-summary-icon-wrap" style={{
                  backgroundColor: riskColor + "18",
                  borderColor: riskColor + "30",
                }}>
                  <Shield size={20} style={{ color: riskColor }} />
                </div>
                <div>
                  <p className="risk-summary-title">
                    <strong>{ward.ward_name}</strong> is at{" "}
                    <span style={{ color: riskColor, fontWeight: 700 }}>{ward.level}</span> risk of flooding.
                  </p>
                  <p className="risk-summary-body">
                    {ward.reason
                      ? ward.reason + `. Combined with the current rainfall of ${ward.rainfall} mm, this results in a high probability of flooding.`
                      : `Conditions significantly increase flood probability with current rainfall of ${ward.rainfall} mm.`}
                  </p>
                </div>
              </div>
              <div className="risk-comparison-card">
                <div className="risk-comparison-icon"><Info size={17} /></div>
                <div>
                  <p className="risk-comparison-label">This ward is riskier than</p>
                  <p className="risk-comparison-pct">{comparisonPct}%</p>
                  <p className="risk-comparison-sub">of all wards in Chennai</p>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: Insights + Next Step */}
          <div className="analysis-row analysis-row-bottom">
            <div className="fs-card key-insights-card">
              <div className="fs-card-label">Key Insights</div>
              <div className="insights-grid">
                <InsightCard icon={<CloudRain size={20} />} iconBg="rain-icon-bg"
                  text="Heavy rainfall increases surface water accumulation and runoff velocity." />
                <InsightCard icon={<Mountain size={20} />} iconBg="elev-icon-bg"
                  text="Very low elevation makes the area highly vulnerable to flood inundation." />
                <InsightCard icon={<Waves size={20} />} iconBg="water-icon-bg"
                  text="Extreme proximity to water bodies significantly increases overflow risk." />
              </div>
            </div>

            <div className="fs-card next-step-card">
              <div className="next-step-inner">
                <div className="next-step-icon-wrap"><ChevronRight size={26} /></div>
                <div>
                  <p className="next-step-title">Recommended Actions</p>
                  <p className="next-step-sub">View prioritized actions for this ward's risk level.</p>
                </div>
              </div>
              <button className="fs-btn primary" style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}
                onClick={() => navigate("/decision")}>
                View Decision Support <ChevronRight size={15} />
              </button>
              <button className="fs-btn secondary" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}
                onClick={() => navigate("/alerts")}>
                Emergency Alerts <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-icon">{icon}</span>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function RiskBar({ icon, iconBg, title, desc, score }) {
  const color = getBarColor(score);
  const label = getBarLabel(score);
  return (
    <div className="risk-bar-item">
      <div className="risk-bar-header">
        <div className={`risk-bar-icon ${iconBg}`}>{icon}</div>
        <div className="risk-bar-info">
          <p className="risk-bar-title">{title}</p>
          <p className="risk-bar-desc">{desc}</p>
        </div>
        <div className="risk-bar-score-wrap">
          <span className="risk-bar-score" style={{ color }}>{Math.round(score)}</span>
          <span className="risk-bar-max">/100</span>
        </div>
        <span className="risk-bar-badge" style={{ color, borderColor: color }}>{label}</span>
      </div>
      <div className="risk-bar-track">
        <div className="risk-bar-fill" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function InsightCard({ icon, iconBg, text }) {
  return (
    <div className="insight-card">
      <div className={`insight-icon ${iconBg}`}>{icon}</div>
      <p className="insight-text">{text}</p>
    </div>
  );
}
