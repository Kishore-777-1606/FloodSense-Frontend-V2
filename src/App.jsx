import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Ward1LiveProvider } from "./context/Ward1LiveContext";

import Dashboard from "./pages/Dashboard";
import Analysis from "./pages/Analysis";
import Decision from "./pages/Decision";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import RainfallHistory from "./pages/RainfallHistory";
import SpatialPropagation from "./pages/SpatialPropagation";
import RainfallSimulator from "./pages/RainfallSimulator";

function App() {
  return (
    <Ward1LiveProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/decision" element={<Decision />} />
          <Route path="/propagation" element={<SpatialPropagation />} />
          <Route path="/simulator" element={<RainfallSimulator />} />
          <Route path="/scenario-simulator" element={<RainfallSimulator />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/rainfall-history" element={<RainfallHistory />} />
          <Route path="/rainfall-history/:wardNo" element={<RainfallHistory />} />
          <Route path="/rainfall-intelligence" element={<RainfallHistory />} />
          <Route path="/rainfall-intelligence/:wardNo" element={<RainfallHistory />} />
        </Routes>
      </BrowserRouter>
    </Ward1LiveProvider>
  );
}

export default App;
