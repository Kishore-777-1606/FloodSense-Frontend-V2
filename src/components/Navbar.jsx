import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Droplets,
  Home,
  BarChart2,
  Shield,
  Bell,
  FileText,
  CloudRain,
  Network,
  SlidersHorizontal,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import "../styles/shared.css";

const PRIMARY_NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: Home,
    path: "/dashboard",
    match: (p) => p === "/dashboard" || p === "/",
  },
  {
    label: "Ward Analysis",
    icon: BarChart2,
    path: "/analysis",
    match: (p) => p.startsWith("/analysis"),
  },
  {
    label: "Rainfall & Momentum",
    icon: CloudRain,
    path: "/rainfall-history",
    match: (p) =>
      p.startsWith("/rainfall-history") || p.startsWith("/rainfall-intelligence"),
  },
  {
    label: "Decision Support",
    icon: Shield,
    path: "/decision",
    match: (p) => p.startsWith("/decision"),
  },
  {
    label: "Spatial Propagation",
    icon: Network,
    path: "/propagation",
    match: (p) => p.startsWith("/propagation"),
  },
  {
    label: "Rainfall Simulator",
    icon: SlidersHorizontal,
    path: "/simulator",
    match: (p) =>
      p.startsWith("/simulator") || p.startsWith("/scenario-simulator"),
  },
];

const MORE_NAV_ITEMS = [
  {
    label: "Emergency Alerts",
    icon: Bell,
    path: "/alerts",
    match: (p) => p.startsWith("/alerts"),
    desc: "Critical threshold & breach warnings",
  },
  {
    label: "Reports",
    icon: FileText,
    path: "/reports",
    match: (p) => p.startsWith("/reports"),
    desc: "Export summaries & ward analytics",
  },
];

const ALL_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...MORE_NAV_ITEMS];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef(null);

  const isMoreActive = MORE_NAV_ITEMS.some((item) =>
    item.match(location.pathname)
  );

  // Close menus on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close menus on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setMoreOpen(false);
      setMobileOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    setMoreOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="fs-top-navbar-wrapper">
      <div className="fs-top-navbar-container">
        {/* BRAND IDENTITY */}
        <div
          className="fs-nav-brand"
          onClick={() => handleNavigate("/dashboard")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleNavigate("/dashboard");
            }
          }}
          title="Go to FloodSense Dashboard"
        >
          <div className="fs-nav-logo">
            <Droplets size={19} />
          </div>
          <div className="fs-brand-meta">
            <div className="fs-nav-brand-title">FloodSense</div>
            <div className="fs-nav-brand-sub">
              <span>Chennai GIS</span>
              <span className="fs-brand-sep">·</span>
              <span className="fs-brand-pill">Flood Intelligence Platform</span>
            </div>
          </div>
        </div>

        {/* DESKTOP FLOATING PILL NAVBAR */}
        <nav className="fs-floating-pill-nav" aria-label="Main Navigation">
          {PRIMARY_NAV_ITEMS.map(({ label, icon: Icon, path, match }) => {
            const isActive = match(location.pathname);
            return (
              <button
                key={path}
                type="button"
                className={`fs-pill-item${isActive ? " active" : ""}`}
                onClick={() => handleNavigate(path)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={15} className="fs-pill-icon" />
                <span className="fs-pill-label">{label}</span>
              </button>
            );
          })}

          {/* MORE DROPDOWN INSIDE PILL */}
          <div className="fs-pill-dropdown-container" ref={moreRef}>
            <button
              type="button"
              className={`fs-pill-item fs-pill-more-btn${
                isMoreActive ? " active-more" : ""
              }${moreOpen ? " open" : ""}`}
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              <span className="fs-pill-label">More</span>
              {isMoreActive && <span className="fs-pill-active-dot" />}
              <ChevronDown
                size={14}
                className={`fs-pill-chevron${moreOpen ? " rotated" : ""}`}
              />
            </button>

            {moreOpen && (
              <div className="fs-pill-dropdown-menu">
                <div className="fs-dropdown-header">Additional Modules</div>
                {MORE_NAV_ITEMS.map(
                  ({ label, icon: Icon, path, match, desc }) => {
                    const isActive = match(location.pathname);
                    return (
                      <button
                        key={path}
                        type="button"
                        className={`fs-dropdown-item${
                          isActive ? " active" : ""
                        }`}
                        onClick={() => handleNavigate(path)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <div className="fs-dropdown-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="fs-dropdown-item-content">
                          <div className="fs-dropdown-item-title">{label}</div>
                          <div className="fs-dropdown-item-desc">{desc}</div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </nav>

        {/* MOBILE MENU TOGGLE PILL */}
        <div className="fs-mobile-nav-toggle-wrap">
          <button
            type="button"
            className={`fs-mobile-toggle-pill${mobileOpen ? " open" : ""}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            <span className="fs-mobile-toggle-text">Menu</span>
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fs-mobile-drawer">
          <div className="fs-mobile-drawer-header">
            <span className="fs-mobile-drawer-title">FloodSense Navigation</span>
            <button
              type="button"
              className="fs-mobile-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close Navigation Menu"
            >
              <X size={16} />
            </button>
          </div>
          <div className="fs-mobile-drawer-list">
            {ALL_NAV_ITEMS.map(({ label, icon: Icon, path, match }) => {
              const isActive = match(location.pathname);
              return (
                <button
                  key={path}
                  type="button"
                  className={`fs-mobile-nav-item${isActive ? " active" : ""}`}
                  onClick={() => handleNavigate(path)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="fs-mobile-nav-icon">
                    <Icon size={17} />
                  </div>
                  <span className="fs-mobile-nav-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
