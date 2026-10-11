import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

export default function MapView({ data }) {
  const navigate = useNavigate();
  const [geoData, setGeoData] = useState(null);

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
    const wardData = data.find((w) => Number(w.ward_no) === Number(wardNo));
    const level = wardData?.level;
    return {
      fillColor: getColor(level),
      weight: 1,
      color: "#374151",
      fillOpacity: level ? 0.75 : 0.25,
    };
  };

  const getRiskEmoji = (level) => {
    if (level === "HIGH") return "🔴";
    if (level === "MEDIUM") return "🟠";
    if (level === "LOW") return "🟢";
    return "⬜";
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
                const w = data.find((d) => Number(d.ward_no) === Number(wardNo));

                layer.bindTooltip(
                  `<div class="tooltip-content">
                    <div class="tooltip-header">
                      ${getRiskEmoji(w?.level || "UNKNOWN")}
                      <strong>${w?.ward_name || "Ward " + wardNo}</strong>
                    </div>
                    <div class="tooltip-row"><span>Risk Level</span><strong class="tooltip-risk tooltip-risk--${(w?.level || "unknown").toLowerCase()}">${w?.level || "UNKNOWN"}</strong></div>
                    <div class="tooltip-row"><span>Score</span><strong>${w ? Math.round(w.score) : "N/A"} / 200</strong></div>
                    <div class="tooltip-row"><span>Rainfall</span><strong>${w?.rainfall || 0} mm</strong></div>
                    <div class="tooltip-row"><span>Elevation</span><strong>${w?.elevation || "N/A"} m</strong></div>
                    <div class="tooltip-row"><span>Water Dist.</span><strong>${w?.water_distance || "N/A"} km</strong></div>
                    <div class="tooltip-click">Click to view ward actions →</div>
                  </div>`,
                  { sticky: true, direction: "top", opacity: 1 }
                );

                // Leaflet click popup with dual independent navigation actions
                const popupContent = document.createElement("div");
                popupContent.className = "fs-map-popup";
                popupContent.innerHTML = `
                  <div class="popup-header">
                    <div class="popup-title">
                      <span class="popup-emoji">${getRiskEmoji(w?.level || "UNKNOWN")}</span>
                      <strong>${w?.ward_name || "Ward " + wardNo}</strong>
                    </div>
                    <span class="fs-badge fs-badge--${(w?.level || "unknown").toLowerCase()}">${w?.level || "UNKNOWN"}</span>
                  </div>
                  <div class="popup-body">
                    <div class="popup-row"><span>Risk Score</span><strong>${w ? Math.round(w.score) : "N/A"} / 200</strong></div>
                    <div class="popup-row"><span>Rainfall</span><strong>${w?.rainfall || 0} mm</strong></div>
                    <div class="popup-row"><span>Elevation</span><strong>${w?.elevation || "N/A"} m</strong></div>
                    <div class="popup-row"><span>Water Distance</span><strong>${w?.water_distance || "N/A"} km</strong></div>
                    ${w?.flood_momentum ? `<div class="popup-row"><span>Momentum</span><strong style="color: #1e88e5;">${w.flood_momentum.momentum_multiplier}x (${w.flood_momentum.momentum_level})</strong></div>` : ""}
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

                const btnAnalysis = popupContent.querySelector(`#btn-analysis-${wardNo}`);
                if (btnAnalysis) {
                  btnAnalysis.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (w) localStorage.setItem("selectedWard", JSON.stringify(w));
                    navigate("/analysis");
                  });
                }

                const btnMomentum = popupContent.querySelector(`#btn-momentum-${wardNo}`);
                if (btnMomentum) {
                  btnMomentum.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (w) localStorage.setItem("selectedWard", JSON.stringify(w));
                    navigate(`/rainfall-history/${wardNo}`);
                  });
                }

                layer.bindPopup(popupContent, {
                  maxWidth: 290,
                  minWidth: 260,
                  className: "fs-leaflet-popup",
                });

                layer.on({
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 2.5, fillOpacity: 0.95 });
                  },
                  mouseout: (e) => {
                    e.target.setStyle({ weight: 1, fillOpacity: w ? 0.75 : 0.25 });
                  },
                  click: () => {
                    if (!w) return;
                    layer.setStyle({ weight: 3, color: "#111827", fillOpacity: 1 });
                    localStorage.setItem("selectedWard", JSON.stringify(w));
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
