#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_core_dump.h"

// =================================================================
// NETWORK CONFIGURATION
// =================================================================
// When you change Wi-Fi networks, update these THREE lines:
//   1. WIFI_SSID      - the new network name
//   2. WIFI_PASSWORD  - the new network password
//   3. SERVER_HOST    - the PC's IP on the new network
//
// To find the PC's IP on the new network, run on the PC:
//   > ipconfig
// Look for the "IPv4 Address" of the active Wi-Fi adapter.
// =================================================================

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "192.168.137.1";
const int   SERVER_PORT   = 5000;

// Derived automatically — DO NOT edit
String serverBaseUrl() {
  return String("http://") + SERVER_HOST + ":" + SERVER_PORT;
}

// =================================================================
// DEVICE IDENTITY
// =================================================================
const char* DEVICE_ID  = "smartagri-esp32-001";
const char* DEVICE_KEY = "REPLACE_WITH_RANDOM_DEVICE_KEY";

// =================================================================
// PIN ASSIGNMENTS
// =================================================================
const int SOIL_PIN  = 34;
const int RELAY_PIN = 26;

// =================================================================
// SOIL CALIBRATION
// =================================================================
// Raw ADC readings used to map sensor output to moisture percentage
const int SOIL_DRY_RAW = 3000;   // raw value in dry air
const int SOIL_WET_RAW = 1300;   // raw value in wet soil

// =================================================================
// RELAY CONFIGURATION
// =================================================================
// Confirmed by testing: this module is ACTIVE-HIGH.
//   HIGH -> relay ON  (pump running)
//   LOW  -> relay OFF (pump stopped)
const bool RELAY_ACTIVE_LOW = false;

// ---------------------------------------------------------------
// Hysteresis thresholds (moisture %)
// ---------------------------------------------------------------
//   moisture <= 30%  -> pump ON     (dry-start trigger)
//   moisture >= 80%  -> pump OFF    (wet-stop trigger)
//   31% to 79%       -> deadband    (hold current state)
// ---------------------------------------------------------------
const float MOISTURE_TURN_ON  = 30.0;
const float MOISTURE_TURN_OFF = 50.0;

// =================================================================
// TIMING
// =================================================================
const unsigned long SENSOR_INTERVAL     = 5000;   // 5 seconds
const unsigned long WIFI_RETRY_INTERVAL = 5000;

unsigned long lastSensorSend  = 0;
unsigned long lastWiFiAttempt = 0;

// =================================================================
// RELAY STATE
// =================================================================
bool relayIsOn = false;

// =================================================================
// WI-FI
// =================================================================
void connectWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);   // no modem sleep — avoids TCP stalls
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - start < 20000) {

    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi connected");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());

    Serial.print("Subnet mask: ");
    Serial.println(WiFi.subnetMask());

    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());

  } else {

    Serial.println("Wi-Fi connection failed");
  }
}

// =================================================================
// SOIL SENSOR
// =================================================================
int readSoilRaw() {

  long total = 0;

  for (int i = 0; i < 10; i++) {
    total += analogRead(SOIL_PIN);
    delay(10);
  }

  return total / 10;
}

float rawToMoisturePercent(int raw) {

  if (SOIL_DRY_RAW == SOIL_WET_RAW) {
    return 0.0;
  }

  float percent =
      100.0 * (SOIL_DRY_RAW - raw) /
      (SOIL_DRY_RAW - SOIL_WET_RAW);

  if (percent < 0)   percent = 0;
  if (percent > 100) percent = 100;

  return percent;
}

// =================================================================
// RELAY CONTROL (hysteresis state machine)
// =================================================================
//   Rule 1: Pump OFF + moisture <= 30%  -> turn ON
//   Rule 2: Pump ON  + moisture >= 80%  -> turn OFF
//   Rule 3: 31%-79%                     -> hold state
// =================================================================
void setRelay(bool on) {

  if (on == relayIsOn) {
    return;   // no change — skip the click
  }

  int level = RELAY_ACTIVE_LOW ? (on ? LOW : HIGH)
                               : (on ? HIGH : LOW);

  digitalWrite(RELAY_PIN, level);
  relayIsOn = on;

  Serial.print(">>> RELAY -> ");
  Serial.println(on ? "ON (pump running)" : "OFF (pump stopped)");
}

void updateRelayFromMoisture(float moisture) {

  // Rule 1: dry-start
  if (!relayIsOn && moisture <= MOISTURE_TURN_ON) {
    setRelay(true);
  }
  // Rule 2: wet-stop
  else if (relayIsOn && moisture >= MOISTURE_TURN_OFF) {
    setRelay(false);
  }
  // Rule 3: deadband — do nothing
}

// =================================================================
// HTTP HELPERS
// =================================================================
void addDeviceHeaders(HTTPClient& http) {

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
}

void printHttpResult(int status) {

  Serial.print("HTTP status: ");
  Serial.println(status);

  if (status < 0) {
    Serial.print("HTTP error: ");
    Serial.println(HTTPClient::errorToString(status));
  }
}

// =================================================================
// RAW TCP HEALTH CHECK
// =================================================================
bool checkBackendHealth() {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  Serial.println();
  Serial.println("==============================");
  Serial.println("BACKEND HEALTH TEST (RAW TCP)");
  Serial.println("==============================");

  WiFiClient client;

  Serial.print("Attempting TCP connect to ");
  Serial.print(SERVER_HOST);
  Serial.print(":");
  Serial.println(SERVER_PORT);

  unsigned long t0 = millis();

  if (!client.connect(SERVER_HOST, SERVER_PORT)) {

    unsigned long elapsed = millis() - t0;

    Serial.print("TCP connect FAILED after ");
    Serial.print(elapsed);
    Serial.println(" ms");

    Serial.print("client.connected() = ");
    Serial.println(client.connected());

    if (elapsed < 200) {
      Serial.println("--> Failed almost instantly.");
      Serial.println("    Likely RST (port closed) or duplicate IP.");
    } else if (elapsed >= 4500 && elapsed <= 5500) {
      Serial.println("--> Failed after ~5s. Likely firewall DROP.");
    } else if (elapsed >= 14000) {
      Serial.println("--> Failed after long timeout. Unreachable.");
    } else {
      Serial.println("--> Unusual timing. Note this number.");
    }

    client.stop();
    return false;
  }

  Serial.println("TCP connect SUCCEEDED.");

  client.print("GET /api/health HTTP/1.1\r\n");
  client.print("Host: ");
  client.print(SERVER_HOST);
  client.print("\r\n");
  client.print("Connection: close\r\n");
  client.print("\r\n");

  Serial.println("--- Response ---");

  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 5000) {
    while (client.available()) {
      Serial.write(client.read());
      timeout = millis();
    }
  }

  Serial.println();
  Serial.println("--- End of response ---");

  client.stop();
  return true;
}

// =================================================================
// SENSOR UPLOAD
// =================================================================
bool sendSensorReading(int raw, float moisture, bool waterDetected) {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  // Sanity check the Wi-Fi stack
  if (WiFi.localIP() == IPAddress(0, 0, 0, 0) || WiFi.RSSI() == 0) {
    Serial.println("Wi-Fi stack unhealthy — forcing reconnect...");
    WiFi.disconnect(true);
    delay(500);
    connectWiFi();
    return false;
  }

  String url = serverBaseUrl() + "/api/iot/reading";

  WiFiClient client;
  HTTPClient http;

  http.setConnectTimeout(15000);
  http.setTimeout(15000);

  if (!http.begin(client, url)) {
    Serial.println("Cannot initialize sensor request");
    return false;
  }

  addDeviceHeaders(http);

  StaticJsonDocument<256> doc;
  doc["moisture_percent"] = moisture;
  doc["soil_sensor_raw"]  = raw;
  doc["water_detected"]   = waterDetected;
  doc["source"]           = "esp32";

  String body;
  serializeJson(doc, body);

  Serial.println();
  Serial.println("----- SENDING SENSOR DATA -----");
  Serial.print("JSON: ");
  Serial.println(body);

  int status = http.POST(body);

  printHttpResult(status);

  if (status > 0) {
    Serial.print("Backend response: ");
    Serial.println(http.getString());
  }

  http.end();

  return status >= 200 && status < 300;
}

// =================================================================
// SETUP
// =================================================================
void setup() {

  Serial.begin(115200);
  delay(1000);

  // Wipe any corrupted core dump so it can't poison the next boot
  esp_core_dump_image_erase();

  Serial.println();
  Serial.println("================================");
  Serial.println("SmartAgri ESP32 - TEST 1");
  Serial.println("================================");

  Serial.println();
  Serial.println("TEST CONFIGURATION:");
  Serial.println("Soil Sensor: ENABLED");
  Serial.println("Water Sensor: DISABLED");
  Serial.println("Relay: ENABLED (local control)");
  Serial.println("Pump: DISCONNECTED (test mode)");
  Serial.print("Relay ON  below: ");
  Serial.print(MOISTURE_TURN_ON);
  Serial.println("% moisture");
  Serial.print("Relay OFF above: ");
  Serial.print(MOISTURE_TURN_OFF);
  Serial.println("% moisture");
  Serial.print("Relay active:    ");
  Serial.println(RELAY_ACTIVE_LOW ? "ACTIVE-LOW" : "ACTIVE-HIGH");
  Serial.println("water_detected:  TRUE (hardcoded)");
  Serial.println();

  // --- Analog setup ---
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);

  // --- Relay setup: default to OFF before anything else ---
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  relayIsOn = false;

  Serial.print("Relay initialized on GPIO ");
  Serial.println(RELAY_PIN);
  Serial.println("Relay state: OFF (safe default)");
  Serial.println();

  // --- Network ---
  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    checkBackendHealth();
  }

  Serial.println();
  Serial.println("Initial setup complete");
  Serial.println("Keep pump disconnected for now.");
}

// =================================================================
// LOOP
// =================================================================
void loop() {

  if (WiFi.status() != WL_CONNECTED) {

    if (millis() - lastWiFiAttempt >= WIFI_RETRY_INTERVAL) {
      lastWiFiAttempt = millis();
      connectWiFi();
    }

    delay(20);
    return;
  }

  unsigned long now = millis();

  if (now - lastSensorSend >= SENSOR_INTERVAL) {

    lastSensorSend = now;

    int   raw      = readSoilRaw();
    float moisture = rawToMoisturePercent(raw);

    // Temporary test value (water sensor not connected)
    bool waterDetected = true;

    Serial.println();
    Serial.println("------------------------------");
    Serial.println("SENSOR READING");
    Serial.println("------------------------------");

    Serial.print("Soil raw ADC: ");
    Serial.println(raw);

    Serial.print("Soil moisture: ");
    Serial.print(moisture, 1);
    Serial.println("%");

    Serial.print("Water detected: ");
    Serial.println(waterDetected ? "YES" : "NO");

    // --- Drive the relay based on moisture ---
    updateRelayFromMoisture(moisture);

    // --- Upload to backend ---
    bool success = sendSensorReading(raw, moisture, waterDetected);

    if (success) {
      Serial.println("SUCCESS: Sensor data sent!");
    } else {
      Serial.println("FAILED: Could not send sensor data.");
    }
  }

  delay(20);
}