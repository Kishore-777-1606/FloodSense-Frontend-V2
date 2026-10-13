const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";
const FALLBACK_API_BASE_URL = "https://floodsense-backend-working.onrender.com";

/**
 * Fetch wrapper that tries the primary local backend first,
 * falling back to the hosted backup if unavailable.
 */
async function fetchWithFallback(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (primaryErr) {
    try {
      const fallbackRes = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
      if (!fallbackRes.ok) throw new Error(`Fallback HTTP error! status: ${fallbackRes.status}`, { cause: primaryErr });
      return await fallbackRes.json();
    } catch {
      throw primaryErr;
    }
  }
}

/**
 * Retrieves risk evaluation and momentum intelligence for all 201 wards.
 */
export async function getRiskData() {
  return fetchWithFallback("/get-risk");
}

/**
 * Retrieves detailed rainfall memory, long-term history, and recent
 * timestamped observations for a specific ward.
 * @param {number|string} wardNo
 */
export async function getWardHistory(wardNo) {
  return fetchWithFallback(`/ward-history/${wardNo}`);
}

/**
 * Checks backend and database operational health.
 */
export async function getHealth() {
  return fetchWithFallback("/health");
}

/**
 * Retrieves spatial propagation scenario simulation data.
 * @param {Object} params - { source_ward, scenario_mode, steps }
 */
export async function getSpatialPropagation(params = {}) {
  const query = new URLSearchParams();
  if (params.source_ward) query.append("source_ward", params.source_ward);
  if (params.scenario_mode) query.append("scenario_mode", params.scenario_mode);
  if (params.steps) query.append("steps", params.steps);
  const qStr = query.toString();
  return fetchWithFallback(`/spatial-propagation${qStr ? `?${qStr}` : ""}`);
}

/**
 * Improvement 5: Runs an interactive rainfall scenario simulation across all 201 wards.
 * @param {number} rainfall_mm - Hypothetical scenario rainfall (0.0 to 300.0 mm)
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel stale in-flight requests
 */
export async function getRainfallScenario(rainfall_mm, signal) {
  return fetchWithFallback("/rainfall-scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rainfall_mm: Number(rainfall_mm) }),
    signal,
  });
}

/**
 * Retrieves the latest live sensor telemetry record for Ward 1 (Thiruvottiyur)
 * from the dedicated ESP32 edge deployment.
 */
export async function getWard1LiveData() {
  return fetchWithFallback("/api/ward1/live-data");
}

/**
 * Retrieves bounded chronological history of Ward 1 live telemetry records
 * from MongoDB for real-time charting.
 * @param {number} [limit=30]
 */
export async function getWard1History(limit = 30) {
  return fetchWithFallback(`/api/ward1/history?limit=${encodeURIComponent(limit)}`);
}


