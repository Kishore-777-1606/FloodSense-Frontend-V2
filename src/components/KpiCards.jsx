import KPICard from "./KPICard";
import "./KPICard.css";

export default function KpiCards({ high, medium, low }) {
  return (
    <div className="kpi-grid">
      <KPICard
        title="HIGH RISK"
        value={high}
        description="Critical flood-prone regions"
        type="high"
      />

      <KPICard
        title="MEDIUM RISK"
        value={medium}
        description="Moderate flood exposure"
        type="medium"
      />

      <KPICard
        title="LOW RISK"
        value={low}
        description="Stable ward conditions"
        type="low"
      />
    </div>
  );
}