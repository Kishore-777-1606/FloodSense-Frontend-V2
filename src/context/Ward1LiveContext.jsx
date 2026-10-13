/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getWard1LiveData, getWard1History } from "../services/api";

const Ward1LiveContext = createContext(null);

export function Ward1LiveProvider({ children }) {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [ageSeconds, setAgeSeconds] = useState(null);

  // Use ref to track mounted state
  const isMountedRef = useRef(true);

  const calculateStaleness = (receivedAtIso) => {
    if (!receivedAtIso) {
      return { age: null, stale: false };
    }
    const serverTimeMs = new Date(receivedAtIso).getTime();
    if (isNaN(serverTimeMs)) {
      return { age: null, stale: false };
    }
    const age = Math.max(0, Math.round((Date.now() - serverTimeMs) / 1000));
    return { age, stale: age > 30 };
  };

  const fetchLiveTelemetry = useCallback(async () => {
    try {
      const res = await getWard1LiveData();
      if (!isMountedRef.current) return;

      if (res && res.status === "SUCCESS" && res.data) {
        const latest = res.data;
        setTelemetry(latest);
        setError(null);

        const { age, stale } = calculateStaleness(latest.received_at_iso);
        setAgeSeconds(age);
        setIsStale(stale);

        // Append to history rolling window, deduplicating by received_at_iso
        setHistory((prev) => {
          if (!latest.received_at_iso) return prev;
          const exists = prev.some(
            (p) => p.received_at_iso === latest.received_at_iso || p._id === latest._id
          );
          if (exists) return prev;
          const updated = [...prev, latest];
          return updated.slice(-30); // Maintain rolling window of 30 recent records
        });
      } else if (res && res.status === "NOT_FOUND") {
        setError("Awaiting first ESP32 transmission");
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.message || "Failed to fetch live telemetry");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load: Fetch initial history window from MongoDB and latest record
  useEffect(() => {
    isMountedRef.current = true;

    async function initialBootstrap() {
      try {
        // Fetch recent bounded history first
        const histRes = await getWard1History(30);
        if (isMountedRef.current && histRes && histRes.status === "SUCCESS" && Array.isArray(histRes.data)) {
          setHistory(histRes.data);
          if (histRes.data.length > 0) {
            const latestFromHist = histRes.data[histRes.data.length - 1];
            setTelemetry(latestFromHist);
            const { age, stale } = calculateStaleness(latestFromHist.received_at_iso);
            setAgeSeconds(age);
            setIsStale(stale);
          }
        }
      } catch (err) {
        console.warn("Could not fetch initial Ward 1 history from MongoDB:", err);
      }

      // Fetch latest live telemetry
      await fetchLiveTelemetry();
    }

    initialBootstrap();

    // Setup 5-second polling cadence
    const intervalId = setInterval(fetchLiveTelemetry, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchLiveTelemetry]);

  const formatServerTime = useCallback((isoStr) => {
    if (!isoStr) return "--:--:--";
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }) +
        " (" +
        d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
        ")"
      );
    } catch {
      return String(isoStr);
    }
  }, []);

  const value = {
    telemetry,
    history,
    loading,
    error,
    isStale,
    ageSeconds,
    refresh: fetchLiveTelemetry,
    formatServerTime,
  };

  return (
    <Ward1LiveContext.Provider value={value}>
      {children}
    </Ward1LiveContext.Provider>
  );
}

export function useWard1Live() {
  const context = useContext(Ward1LiveContext);
  if (!context) {
    throw new Error("useWard1Live must be used within a Ward1LiveProvider");
  }
  return context;
}
