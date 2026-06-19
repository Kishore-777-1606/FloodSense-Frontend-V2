import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-section">
        <h3>FloodSense · Chennai GIS</h3>
        <p>Flood Risk Intelligence Dashboard</p>
        <p>Built with React + Leaflet + Recharts</p>
      </div>
      <div className="footer-section">
        <h3>About This Project</h3>
        <p>
          FloodSense visualizes flood-prone wards across Chennai using
          rainfall-based risk analysis and geospatial mapping, helping identify
          high-risk regions and support emergency planning decisions.
        </p>
      </div>
      <div className="footer-section footer-disclaimer">
        <h3>Disclaimer</h3>
        <p>Predictions are model-based estimates. Always follow official Chennai NDMA advisories during active flood events.</p>
      </div>
    </footer>
  );
}
