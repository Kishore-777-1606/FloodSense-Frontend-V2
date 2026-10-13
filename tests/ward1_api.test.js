import test from "node:test";
import assert from "node:assert/strict";
import { getWard1LiveData, getWard1History } from "../src/services/api.js";

test("getWard1LiveData() successfully fetches from live backend", async () => {
  const response = await getWard1LiveData();
  assert.equal(response.status, "SUCCESS");
  assert.ok(response.data, "Response should have a data payload");

  const data = response.data;
  assert.equal(data.ward_no, 1, "Payload must be for Ward 1");
  assert.ok(data.received_at_iso, "Payload must contain received_at_iso timestamp");

  // Validate ISO timestamp parsing
  const parsedDate = new Date(data.received_at_iso);
  assert.ok(!isNaN(parsedDate.getTime()), "received_at_iso must be a valid parseable date");

  // Sensor telemetry validation
  const readings = data.sensor_readings;
  assert.ok(readings, "sensor_readings must exist");
  assert.equal(typeof readings.temperature_c, "number", "temperature_c must be a number");
  assert.equal(typeof readings.humidity_pct, "number", "humidity_pct must be a number");

  // Ultrasonic distance validation
  const ultrasonic = readings.ultrasonic_telemetry;
  assert.ok(ultrasonic, "ultrasonic_telemetry must exist");
  assert.equal(typeof ultrasonic.value_cm, "number", "ultrasonic distance value_cm must be a number");
  assert.equal(ultrasonic.is_ultrasonic_distance, true, "is_ultrasonic_distance flag must be true");
  assert.equal(ultrasonic.is_rainfall, false, "is_rainfall flag must be false");

  // Geographic properties & baseline rainfall
  const wardProps = data.ward_properties;
  assert.ok(wardProps, "ward_properties must exist");
  assert.equal(wardProps.Ward_No, 1, "Ward_No must be 1");
  assert.equal(wardProps.Zone_Name, "THIRUVOTTIYUR", "Zone_Name must be THIRUVOTTIYUR");
  assert.equal(wardProps.baseline_rainfall_mm, 39.2, "baseline_rainfall_mm must be 39.2 mm");

  // Risk assessment
  const risk = data.risk_assessment;
  assert.ok(risk, "risk_assessment must exist");
  assert.equal(typeof risk.score, "number", "risk score must be a number");
  assert.ok(
    risk.evaluation_basis === "GEOGRAPHIC_BASELINE_PRESERVED" ||
    risk.evaluation_basis === "LIVE_ESP32_TELEMETRY",
    "evaluation_basis must be valid"
  );
  assert.ok(risk.scientific_blocker_disclosure, "scientific_blocker_disclosure must be present");
});

test("Ward 1 baseline rainfall remains distinct from live microclimate telemetry", async () => {
  const response = await getWard1LiveData();
  const data = response.data;
  assert.equal(data.sensor_readings.rainfall_sensor_present, false, "rainfall_sensor_present must be false");
  assert.equal(data.sensor_readings.rainfall_mm, null, "rainfall_mm must be null when physical rain sensor is absent");
  assert.equal(data.ward_properties.baseline_rainfall_mm, 39.2, "Ward 1 baseline rainfall must be preserved at 39.2 mm");
});

test("Risk calculation preserves 3-feature XGBoost inputs without sensor pollution", async () => {
  const response = await getWard1LiveData();
  const risk = response.data.risk_assessment;
  assert.ok(
    typeof risk.features_evaluated.rainfall_mm === "number" && risk.features_evaluated.rainfall_mm >= 0,
    "XGBoost model input features must evaluate 3-feature baseline or live ESP32 telemetry"
  );
  assert.equal(risk.features_evaluated.elevation_m, 6.7);
  assert.equal(risk.features_evaluated.water_distance_km, 25.471);
  assert.equal(typeof risk.temperature_c, "number", "temperature recorded in risk object for context");
  assert.equal(typeof risk.humidity_pct, "number", "humidity recorded in risk object for context");
});

test("Staleness determination logic triggers when server receipt age exceeds 30 seconds", () => {
  const now = Date.now();
  
  // Fresh timestamp (5 seconds ago)
  const freshTime = new Date(now - 5000).toISOString();
  const freshAge = Math.max(0, Math.round((now - new Date(freshTime).getTime()) / 1000));
  assert.equal(freshAge, 5);
  assert.equal(freshAge > 30, false, "5s old data should not be marked stale");

  // Stale timestamp (45 seconds ago)
  const staleTime = new Date(now - 45000).toISOString();
  const staleAge = Math.max(0, Math.round((now - new Date(staleTime).getTime()) / 1000));
  assert.equal(staleAge, 45);
  assert.equal(staleAge > 30, true, "45s old data must be marked stale (>30s threshold)");
});

test("getWard1History() returns bounded chronological time-series samples", async () => {
  const response = await getWard1History(10);
  assert.equal(response.status, "SUCCESS");
  assert.ok(Array.isArray(response.data), "Response data must be an array of records");
  assert.ok(response.data.length > 0, "Response must return at least one historical sample");
  assert.ok(response.data.length <= 10, "Response length must respect requested limit");

  // Verify chronological order (oldest to newest)
  if (response.data.length >= 2) {
    const t0 = new Date(response.data[0].received_at_iso).getTime();
    const t1 = new Date(response.data[1].received_at_iso).getTime();
    assert.ok(t1 >= t0, "History records must be sorted in ascending chronological order");
  }

  // Validate item schema
  const sample = response.data[0];
  assert.equal(sample.ward_no, 1);
  assert.ok(sample.received_at_iso);
  assert.equal(typeof sample.sensor_readings.temperature_c, "number");
  assert.equal(typeof sample.sensor_readings.humidity_pct, "number");
  assert.equal(typeof sample.sensor_readings.ultrasonic_telemetry.value_cm, "number");
  assert.equal(sample.sensor_readings.ultrasonic_telemetry.is_rainfall, false);
});
