import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Analysis from "./pages/Analysis";
import Decision from "./pages/Decision";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/decision" element={<Decision />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
