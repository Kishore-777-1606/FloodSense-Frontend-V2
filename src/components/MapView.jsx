import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { useWard1Live } from "../context/Ward1LiveContext";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

function getRiskEmoji(level) {
  if (level === "HIGH") return "🔴";
  if (level === "MEDIUM") return "🟠";
  if (level === "LOW") return "🟢";
  return "⬜";
}

function buildTooltipHtml(wardNo, w, ward1Live) {
  const isWard1 = Number(wardNo) === 1;
  const ward1Doc = ward1Live?.telemetry || w?.live_ward_data;
  const readings = ward1Doc?.sensor_readings || w?.live_telemetry || {};
  const ultrasonic = readings.ultrasonic_telemetry?.value_cm;
  const temp = readings.temperature_c;
  const hum = readings.humidity_pct;
  const isStale = ward1Live?.isStale;
  const ageSeconds = ward1Live?.ageSeconds;

  const scoreVal = isWard1 && ward1Doc?.risk_assessment?.score != null
    ? Math.round(ward1Doc.risk_assessment.score)
    : (w ? Math.round(w.score) : "N/A");
  const levelVal = isWard1 && ward1Doc?.risk_assessment?.level
    ? ward1Doc.risk_assessment.level
    : (w?.level || "UNKNOWN");
  const displayRain = isWard1
    ? (ultrasonic != null ? ultrasonic.toFixed(1) : (w?.rainfall != null ? Number(w.rainfall).toFixed(1) : "46.0"))
    : (w?.rainfall != null ? Number(w.rainfall).toFixed(1) : "0.0");

  return `
    <div class="tooltip-content">
      <div class="tooltip-header">
        ${getRiskEmoji(levelVal)}
        <strong>${w?.ward_name || "Ward " + wardNo}</strong>
      </div>
      <div class="tooltip-row">
        <span>Risk Level</span>
        <strong class="tooltip-risk tooltip-risk--${levelVal.toLowerCase()}">${levelVal}</strong>
      </div>
      <div class="tooltip-row">
        <span>Score</span>
        <strong>${scoreVal} / 200</strong>
      </div>
      <div class="tooltip-row">
        <span>${isWard1 ? "Live Input (ESP32)" : "Rainfall"}</span>
        <strong>${displayRain} mm</strong>
      </div>
      ${isWard1 ? `
      <div class="tooltip-row" style="color: #64748b; font-size: 0.68rem;">
        <span>Sensor Type</span>
        <strong style="color: #94a3b8; font-weight: normal;">Ultrasonic reading (not measured rainfall)</strong>
      </div>` : ""}
      <div class="tooltip-row">
        <span>Elevation</span>
        <strong>${w?.elevation || "N/A"} m</strong>
      </div>
      <div class="tooltip-row">
        <span>Water Dist.</span>
        <strong>${w?.water_distance || "N/A"} km</strong>
      </div>
      ${isWard1 && (readings.temperature_c != null || readings.ultrasonic_telemetry != null) ? `
      <div class="tooltip-row" style="color: #059669; border-top: 1px dashed #86efac; padding-top: 5px; margin-top: 5px; display: flex; flex-direction: column; gap: 3px; background: #f0fdf4; padding: 6px 8px; border-radius: 6px; border: 1px solid #bbf7d0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #166534; font-size: 0.72rem;">📡 ESP32 Live Telemetry</span>
          <span style="font-size: 0.63rem; color: ${isStale ? "#92400e" : "#15803d"}; font-weight: 700; background: ${isStale ? "#fef3c7" : "#dcfce7"}; padding: 1px 5px; border-radius: 10px;">
            ${isStale ? `STALE (${ageSeconds}s)` : "ACTIVE (5s)"}
          </span>
        </div>
        <div style="color: #15803d; font-size: 0.72rem; font-weight: 600; display: flex; justify-content: space-between; gap: 4px;">
          <span>Temp: <strong>${temp != null ? temp.toFixed(1) + "°C" : "--"}</strong></span>
          <span>Hum: <strong>${hum != null ? hum.toFixed(1) + "%" : "--"}</strong></span>
          <span>Intensity: <strong>${ultrasonic != null ? ultrasonic.toFixed(1) + " mm" : "--"}</strong></span>
        </div>
      </div>` : ""}
      <div class="tooltip-click">Click to view ward actions →</div>
    </div>
  `;
}

function buildPopupElement(wardNo, w, ward1Live, navigate) {
  const isWard1 = Number(wardNo) === 1;
  const ward1Doc = ward1Live?.telemetry || w?.live_ward_data;
  const readings = ward1Doc?.sensor_readings || w?.live_telemetry || {};
  const ultrasonic = readings.ultrasonic_telemetry?.value_cm;
  const temp = readings.temperature_c;
  const hum = readings.humidity_pct;
  const isStale = ward1Live?.isStale;
  const ageSeconds = ward1Live?.ageSeconds;
  const receiptTime = ward1Live?.formatServerTime?.(ward1Doc?.received_at_iso || ward1Doc?.received_at);

  const scoreVal = isWard1 && ward1Doc?.risk_assessment?.score != null
    ? Math.round(ward1Doc.risk_assessment.score)
    : (w ? Math.round(w.score) : "N/A");
  const levelVal = isWard1 && ward1Doc?.risk_assessment?.level
    ? ward1Doc.risk_assessment.level
    : (w?.level || "UNKNOWN");
  const displayRain = isWard1
    ? (ultrasonic != null ? ultrasonic.toFixed(1) : (w?.rainfall != null ? Number(w.rainfall).toFixed(1) : "46.0"))
    : (w?.rainfall != null ? Number(w.rainfall).toFixed(1) : "0.0");

  const popupContent = document.createElement("div");
  popupContent.className = "fs-map-popup";
  popupContent.innerHTML = `
    <div class="popup-header">
      <div class="popup-title">
        <span class="popup-emoji">${getRiskEmoji(levelVal)}</span>
        <strong>${w?.ward_name || "Ward " + wardNo}</strong>
      </div>
      <span class="fs-badge fs-badge--${levelVal.toLowerCase()}">${levelVal}</span>
    </div>
    <div class="popup-body">
      <div class="popup-row"><span>Risk Score</span><strong>${scoreVal} / 200</strong></div>
      <div class="popup-row">
        <span>${isWard1 ? "Live Input (ESP32)" : "Rainfall"}</span>
        <strong>${displayRain} mm</strong>
      </div>
      ${isWard1 ? `
      <div class="popup-row" style="color: #64748b; font-size: 0.72rem;">
        <span>Sensor Type</span>
        <strong style="color: #94a3b8; font-weight: normal;">Ultrasonic reading (not measured rainfall)</strong>
      </div>` : ""}
      <div class="popup-row"><span>Elevation</span><strong>${w?.elevation || "N/A"} m</strong></div>
      <div class="popup-row"><span>Water Distance</span><strong>${w?.water_distance || "N/A"} km</strong></div>
      ${w?.flood_momentum ? `<div class="popup-row"><span>Momentum</span><strong style="color: #1e88e5;">${w.flood_momentum.momentum_multiplier}x (${w.flood_momentum.momentum_level})</strong></div>` : ""}
      ${isWard1 ? `
      <div class="popup-row" style="background: #f0fdf4; padding: 8px 10px; border-radius: 8px; border: 1px solid #86efac; margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #166534; font-weight: 700; font-size: 0.74rem;">📡 ESP32 Live Edge Telemetry</span>
          <span style="font-size: 0.65rem; color: ${isStale ? "#92400e" : "#15803d"}; font-weight: 700; background: ${isStale ? "#fef3c7" : "#dcfce7"}; padding: 1px 6px; border-radius: 10px;">
            ${isStale ? `STALE (${ageSeconds}s ago)` : "ACTIVE STREAM (5s)"}
          </span>
        </div>
        <div style="font-size: 0.78rem; color: #15803d; font-weight: 600; display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Temp: <strong>${temp != null ? temp.toFixed(1) + "°C" : "--"}</strong></span>
          <span>Hum: <strong>${hum != null ? hum.toFixed(1) + "%" : "--"}</strong></span>
          <span>Intensity: <strong>${ultrasonic != null ? ultrasonic.toFixed(1) + " mm" : "--"}</strong></span>
        </div>
        <div style="font-size: 0.67rem; color: #64748b; border-top: 1px dashed #bbf7d0; padding-top: 3px;">
          MongoDB Receipt: ${receiptTime || "--:--:--"}
        </div>
      </div>` : ""}
    </div>
    <div class="popup-actions">
      <button class="popup-btn popup-btn-analysis" id="btn-analysis-${wardNo}">
        View Analysis →
      </button>
      <button class="popup-btn popup-btn-momentum" id="btn-momentum-${wardNo}">
        Rainfall History & Momentum →
      </button>
    </div>
  `;

  const wardPayload = isWard1 ? {
    ...w,
    rainfall: Number(displayRain),
    rainfall_mm: Number(displayRain),
    score: isWard1 && ward1Doc?.risk_assessment?.score != null ? ward1Doc.risk_assessment.score : w?.score,
    level: levelVal,
    live_telemetry: readings,
    live_ward_data: ward1Doc
  } : w;

  const btnAnalysis = popupContent.querySelector(`#btn-analysis-${wardNo}`);
  if (btnAnalysis) {
    btnAnalysis.addEventListener("click", (e) => {
      e.stopPropagation();
      if (wardPayload) localStorage.setItem("selectedWard", JSON.stringify(wardPayload));
      navigate("/analysis");
    });
  }

  const btnMomentum = popupContent.querySelector(`#btn-momentum-${wardNo}`);
  if (btnMomentum) {
    btnMomentum.addEventListener("click", (e) => {
      e.stopPropagation();
      if (wardPayload) localStorage.setItem("selectedWard", JSON.stringify(wardPayload));
      navigate(`/rainfall-history/${wardNo}`);
    });
  }

  return popupContent;
}

export default function MapView({ data }) {
  const navigate = useNavigate();
  const ward1Live = useWard1Live();
  const [geoData, setGeoData] = useState(null);

  const ward1LayerRef = useRef(null);
  const ward1DataRef = useRef(null);
  const ward1LiveRef = useRef(ward1Live);

  // Keep ref up to date for dynamic leaflet events
  useEffect(() => {
    ward1LiveRef.current = ward1Live;
    const w1 = data.find((d) => Number(d.ward_no) === 1);
    ward1DataRef.current = w1;

    // If Ward 1 layer is mounted, keep its tooltip and open popup updated live
    if (ward1LayerRef.current) {
      const layer = ward1LayerRef.current;
      layer.setTooltipContent(buildTooltipHtml(1, w1, ward1Live));

      const popup = layer.getPopup();
      if (popup && popup.isOpen()) {
        layer.setPopupContent(buildPopupElement(1, w1, ward1Live, navigate));
      }
    }
  }, [ward1Live, data, navigate]);

  useEffect(() => {
    fetch("/wards.geojson")
      .then((res) => res.json())
      .then((json) => setGeoData(json));
  }, []);

  const getColor = (level) => {
    if (level === "HIGH") return "#dc2626";
    if (level === "MEDIUM") return "#f59e0b";
    if (level === "LOW") return "#16a34a";
    return "#dbe4ee";
  };

  const styleFeature = (feature) => {
    const wardNo = feature.properties.Ward_No;
    const wardData = data.find((d) => Number(d.ward_no) === Number(wardNo));
    const level = wardData?.level;
    return {
      fillColor: getColor(level),
      weight: 1,
      color: "#374151",
      fillOpacity: level ? 0.75 : 0.25,
    };
  };

  return (
    <div className="map-wrapper">
      <div className="map-legend">
        <h4>Risk Levels</h4>
        <div><span className="legend-color red"></span>High</div>
        <div><span className="legend-color yellow"></span>Medium</div>
        <div><span className="legend-color green"></span>Low</div>
      </div>
      <div className="map-hint">Click a ward for detailed analysis</div>
      <div className="map-container">
        <MapContainer
          center={[13.12, 80.23]}
          zoom={10.5}
          minZoom={10}
          maxZoom={16}
          zoomControl={true}
          maxBounds={[[12.75, 79.95], [13.35, 80.45]]}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
              key={data.length ? `geo-loaded-${data.length}` : "geo-loading"}
              data={geoData}
              style={styleFeature}
              onEachFeature={(feature, layer) => {
                const wardNo = feature.properties.Ward_No;
                const isWard1 = Number(wardNo) === 1;
                const w = data.find((d) => Number(d.ward_no) === Number(wardNo));

                if (isWard1) {
                  ward1LayerRef.current = layer;
                  ward1DataRef.current = w;
                }

                // Bind tooltip
                layer.bindTooltip(
                  buildTooltipHtml(wardNo, w, isWard1 ? ward1LiveRef.current : null),
                  { sticky: true, direction: "top", opacity: 1 }
                );

                // Bind popup
                layer.bindPopup(
                  buildPopupElement(wardNo, w, isWard1 ? ward1LiveRef.current : null, navigate),
                  {
                    maxWidth: 290,
                    minWidth: 260,
                    className: "fs-leaflet-popup",
                  }
                );

                layer.on({
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 2.5, fillOpacity: 0.95 });
                    if (isWard1) {
                      e.target.setTooltipContent(
                        buildTooltipHtml(1, ward1DataRef.current, ward1LiveRef.current)
                      );
                    }
                  },
                  mouseout: (e) => {
                    e.target.setStyle({ weight: 1, fillOpacity: w ? 0.75 : 0.25 });
                  },
                  click: (e) => {
                    if (!w) return;
                    layer.setStyle({ weight: 3, color: "#111827", fillOpacity: 1 });
                    localStorage.setItem("selectedWard", JSON.stringify(w));

                    if (isWard1) {
                      e.target.setPopupContent(
                        buildPopupElement(1, ward1DataRef.current, ward1LiveRef.current, navigate)
                      );
                    }
                  },
                  popupopen: (e) => {
                    if (isWard1) {
                      e.target.setPopupContent(
                        buildPopupElement(1, ward1DataRef.current, ward1LiveRef.current, navigate)
                      );
                    }
                  },
                });
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
