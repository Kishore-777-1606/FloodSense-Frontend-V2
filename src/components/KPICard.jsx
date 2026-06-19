import "./KPICard.css";

export default function KPICard({ title, value, description, type }) {
  const ICONS = {
    high: "🔴",
    medium: "🟠",
    low: "🟢",
  };

  return (
    <div className={`kpi-card ${type}`}>
      <div className="kpi-top">
        <div className="kpi-indicator"></div>
        <div>
          <h4 className="kpi-title">{ICONS[type]} {title}</h4>
          <p className="kpi-description">{description}</p>
        </div>
      </div>
      <div className="kpi-bottom">
        <h1 className="kpi-value">{value}</h1>
        <span className="kpi-label">Wards</span>
      </div>
    </div>
  );
}
