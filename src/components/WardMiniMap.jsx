import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/WardMiniMap.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#ef4444"/>
        <circle cx="12" cy="12" r="5" fill="#fff"/>
      </svg>
    `),
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

function FitBounds({ geojsonData }) {
  const map = useMap();

  useEffect(() => {
    if (!geojsonData) return;
    try {
      const layer = L.geoJSON(geojsonData);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      }
    } catch {
      // ignore invalid geojson bounds
    }
  }, [geojsonData, map]);

  return null;
}

export default function WardMiniMap({ wardNo, wardName }) {
  const [wardFeature, setWardFeature] = useState(null);
  const [center, setCenter] = useState([13.0827, 80.2707]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wardNo) return;

    setLoading(true);
    setError(null);

    fetch("/wards.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load wards.geojson");
        return res.json();
      })
      .then((geojson) => {
        const feature = geojson.features?.find(
          (f) =>
            f.properties?.Ward_No === wardNo ||
            f.properties?.Ward_No === String(wardNo) ||
            Number(f.properties?.Ward_No) === Number(wardNo)
        );

        if (!feature) {
          setError(`Ward ${wardNo} not found in GeoJSON`);
          setLoading(false);
          return;
        }

        setWardFeature(feature);

        try {
          const layer = L.geoJSON(feature);
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            const c = bounds.getCenter();
            setCenter([c.lat, c.lng]);
          }
        } catch {
          // fallback to default center
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [wardNo]);

  const wardGeoJSON = wardFeature
    ? { type: "FeatureCollection", features: [wardFeature] }
    : null;

  if (loading) {
    return (
      <div className="ward-mini-map-placeholder">
        <div className="ward-mini-map-spinner" />
        <span>Loading map…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ward-mini-map-placeholder">
        <span className="ward-mini-map-error">{error}</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="ward-mini-map"
      zoomControl={true}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {wardGeoJSON && (
        <>
          <GeoJSON
            key={wardNo}
            data={wardGeoJSON}
            style={{
              color: "#ef4444",
              weight: 2.5,
              fillColor: "#ef4444",
              fillOpacity: 0.18,
            }}
          />
          <FitBounds geojsonData={wardGeoJSON} />
        </>
      )}

      {center && (
        <Marker position={center} icon={redIcon} />
      )}
    </MapContainer>
  );
}
