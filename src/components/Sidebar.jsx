import { useNavigate, useLocation } from "react-router-dom";
import {
  Droplets,
  Home,
  BarChart2,
  Shield,
  Bell,
  FileText,
  CloudRain,
} from "lucide-react";
import "../styles/shared.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: Home, path: "/dashboard" },
  { label: "Ward Analysis", icon: BarChart2, path: "/analysis" },
  { label: "Decision Support", icon: Shield, path: "/decision" },
  { label: "Emergency Alerts", icon: Bell, path: "/alerts" },
  { label: "Reports", icon: FileText, path: "/reports" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="fs-sidebar">
      <div
        className="fs-sidebar-brand"
        onClick={() => navigate("/dashboard")}
        style={{ cursor: "pointer" }}
      >
        <div className="fs-sidebar-logo">
          <Droplets size={18} />
        </div>
        <div>
          <div className="fs-sidebar-brand-name">FloodSense</div>
          <div className="fs-sidebar-brand-sub">Chennai GIS</div>
        </div>
      </div>

      <nav className="fs-sidebar-nav">
        <div className="fs-sidebar-section-label">Navigation</div>
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
          <button
            key={path}
            className={`fs-nav-item${location.pathname === path || (path === "/dashboard" && location.pathname === "/") ? " active" : ""}`}
            onClick={() => navigate(path)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="fs-sidebar-footer">
        <div className="fs-sidebar-footer-icon">
          <CloudRain size={22} />
        </div>
        <div className="fs-sidebar-footer-title">Smart insights.</div>
        <div className="fs-sidebar-footer-title">Safer communities.</div>
        <div className="fs-sidebar-footer-sub">
          Data-driven decisions for flood resilience.
        </div>
      </div>
    </aside>
  );
}
