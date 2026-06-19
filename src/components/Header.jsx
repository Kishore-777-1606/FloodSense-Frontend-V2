import "./Header.css";

export default function Header({ rainfall, totalWards, highRiskZones, lastUpdated }){
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString();
    };

    return (
        <header className = "header">
            <div className="header-left">
                <h1>Flood Risk Dashboard</h1>
            </div>

            <div className="header-center">
                <div className="header-item">
                    <span>Rainfall:</span>
                    <strong>{rainfall} mm</strong>
                </div>
            

                <div className="divider" />

                <div className="header-item">
                    <span>Total wards:</span>
                    <strong>{totalWards}</strong>
                </div>

                <div className="divider" />

                <div className="header-item">
                    <span>High Risk:</span>
                    <strong className="high-risk">{highRiskZones}</strong>
                </div>
            </div>
            <div className="header-right">
                <span>Updated:</span>
                <strong>{formatTime(lastUpdated)}</strong>
            </div>
        </header>
    );
}