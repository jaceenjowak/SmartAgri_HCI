/*
  SmartAgri - Phase 4 ESP32 IoT Firmware
  Board: ESP32 Dev Module
  Arduino IDE

  Hardware:
    Soil moisture analog output -> GPIO 34
    Water detection digital output -> GPIO 27
    Relay input -> GPIO 26

  IMPORTANT:
    1) Keep the water pump disconnected during first tests.
    2) Replace WIFI_SSID, WIFI_PASSWORD, SERVER_BASE_URL, DEVICE_ID, DEVICE_KEY.
    3) SERVER_BASE_URL must use your PC's LAN IPv4 address, NOT localhost.
       Example: http://192.168.1.10:5000
    4) This firmware expects Phase-4 backend routes:
       POST /api/iot/reading
       GET  /api/iot/pump-command
       POST /api/iot/pump-status
    5) The ESP32 has a local safety override: no water = relay forced OFF.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =========================
// USER CONFIGURATION
// =========================

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Use your Windows PC IPv4 address on the SAME Wi-Fi.
// Example: "http://192.168.1.15:5000"
const char* SERVER_BASE_URL = "http://YOUR_PC_LAN_IPV4:5000";

// These will be matched by the Phase-4 Express backend.
const char* DEVICE_ID  = "smartagri-esp32-001";
const char* DEVICE_KEY = "YOUR_IOT_DEVICE_KEY_MATCHING_BACKEND_ENV";

// =========================
// ESP32 PIN CONFIGURATION
// =========================

const int SOIL_PIN  = 34;  // ADC input
const int WATER_PIN = 27;  // digital input
const int RELAY_PIN = 26;  // digital output

// Many common relay modules are ACTIVE LOW.
// If your relay behaves backwards, change this to false.
const bool RELAY_ACTIVE_LOW = true;

// Some water detector modules use LOW when water is detected.
// If your readings are reversed, change this value.
const bool WATER_ACTIVE_LOW = true;

// =========================
// SOIL SENSOR CALIBRATION
// =========================
// TEMPORARY starting values only.
// You MUST calibrate these using your own sensor.
//
// SOIL_DRY_RAW = raw reading in dry air/dry soil
// SOIL_WET_RAW = raw reading in wet soil/water
//
// For many capacitive sensors, dry raw is HIGHER than wet raw.
int SOIL_DRY_RAW = 3000;
int SOIL_WET_RAW = 1300;

// =========================
// TIMING
// =========================

const unsigned long SENSOR_SEND_INTERVAL_MS = 5000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 2000;
const unsigned long COMMAND_FAILSAFE_MS = 15000;

unsigned long lastSensorSend = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastGoodCommand = 0;

// =========================
// STATE
// =========================

bool relayOn = false;
bool desiredPumpOn = false;

// =========================
// RELAY CONTROL
// =========================

void setRelay(bool on) {
  relayOn = on;

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  }

  Serial.print("Relay / pump state: ");
  Serial.println(on ? "ON" : "OFF");
}

// =========================
// WIFI
// =========================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  // Fail-safe: never leave pump ON while communication is lost.
  setRelay(false);

  Serial.println();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected.");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("Wi-Fi connection failed. Will retry.");
  }
}

// =========================
// SENSOR FUNCTIONS
// =========================

int readSoilRaw() {
  const int samples = 10;
  long total = 0;

  for (int i = 0; i < samples; i++) {
    total += analogRead(SOIL_PIN);
    delay(10);
  }

  return (int)(total / samples);
}

float rawToMoisturePercent(int raw) {
  // Handles the common case where DRY_RAW > WET_RAW.
  float percent;

  if (SOIL_DRY_RAW == SOIL_WET_RAW) {
    return 0.0;
  }

  percent =
    ((float)(SOIL_DRY_RAW - raw) /
     (float)(SOIL_DRY_RAW - SOIL_WET_RAW)) * 100.0;

  if (percent < 0.0) percent = 0.0;
  if (percent > 100.0) percent = 100.0;

  return percent;
}

bool readWaterDetected() {
  int state = digitalRead(WATER_PIN);

  if (WATER_ACTIVE_LOW) {
    return state == LOW;
  }

  return state == HIGH;
}

// =========================
// HTTP HELPERS
// =========================

void addDeviceHeaders(HTTPClient &http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
}

bool checkBackendHealth() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/health";

  http.setTimeout(5000);
  http.begin(url);

  int status = http.GET();

  Serial.print("Backend health HTTP status: ");
  Serial.println(status);
  if (status < 0) {
    Serial.println("Health request failed. Check PC IPv4, same Wi-Fi, backend, and Windows Firewall.");
  }

  if (status > 0) {
    Serial.println(http.getString());
  }

  http.end();

  return status == 200;
}

// =========================
// SEND REAL SENSOR READING
// =========================

bool sendSensorReading(int raw, float moisture, bool waterDetected) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/iot/reading";

  http.setTimeout(5000);
  http.begin(url);
  addDeviceHeaders(http);

  StaticJsonDocument<256> doc;
  doc["moisture_percent"] = moisture;
  doc["soil_sensor_raw"] = raw;
  doc["water_detected"] = waterDetected;
  doc["source"] = "esp32";

  String body;
  serializeJson(doc, body);

  Serial.println();
  Serial.println("Sending sensor data:");
  Serial.println(body);

  int status = http.POST(body);
  String response = http.getString();

  Serial.print("Sensor POST HTTP status: ");
  Serial.println(status);
  if (status < 0) {
    Serial.println("Sensor request failed to connect. Verify SERVER_BASE_URL and Windows Firewall.");
  }
  Serial.println(response);

  http.end();

  return status >= 200 && status < 300;
}

// =========================
// FETCH DESIRED PUMP COMMAND
// =========================

bool fetchPumpCommand(bool &pumpOn) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/iot/pump-command";

  http.setTimeout(5000);
  http.begin(url);
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int status = http.GET();
  String response = http.getString();

  Serial.print("Pump command HTTP status: ");
  Serial.println(status);
  if (status < 0) {
    Serial.println("Pump command request failed to connect. Verify SERVER_BASE_URL and Windows Firewall.");
  }

  if (status < 200 || status >= 300) {
    Serial.println(response);
    http.end();
    return false;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, response);

  if (error) {
    Serial.print("Invalid command JSON: ");
    Serial.println(error.c_str());
    http.end();
    return false;
  }

  if (!doc["pump_on"].is<bool>()) {
    Serial.println("Response does not contain pump_on boolean.");
    http.end();
    return false;
  }

  pumpOn = doc["pump_on"].as<bool>();

  Serial.print("Server requested pump: ");
  Serial.println(pumpOn ? "ON" : "OFF");

  http.end();
  return true;
}

// =========================
// REPORT ACTUAL RELAY STATE
// =========================

void reportPumpStatus(bool actualPumpOn, bool waterDetected) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/iot/pump-status";

  http.setTimeout(5000);
  http.begin(url);
  addDeviceHeaders(http);

  StaticJsonDocument<256> doc;
  doc["pump_on"] = actualPumpOn;
  doc["water_detected"] = waterDetected;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);

  Serial.print("Pump status report HTTP status: ");
  Serial.println(status);

  if (status > 0) {
    Serial.println(http.getString());
  }

  http.end();
}

// =========================
// SETUP
// =========================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("====================================");
  Serial.println(" SmartAgri ESP32 - Phase 4 IoT");
  Serial.println("====================================");

  if (String(WIFI_SSID) == "YOUR_WIFI_SSID" ||
      String(WIFI_PASSWORD) == "YOUR_WIFI_PASSWORD" ||
      String(SERVER_BASE_URL).indexOf("YOUR_PC_LAN_IPV4") >= 0 ||
      String(DEVICE_KEY) == "YOUR_IOT_DEVICE_KEY_MATCHING_BACKEND_ENV") {
    Serial.println("CONFIG ERROR: Edit Wi-Fi, PC IPv4 URL, and device key before testing.");
  }

  pinMode(WATER_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);

  // Force relay OFF immediately at boot.
  setRelay(false);

  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);

  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    checkBackendHealth();
  }

  Serial.println();
  Serial.println("Initial setup complete.");
  Serial.println("Keep pump disconnected during first tests.");
}

// =========================
// MAIN LOOP
// =========================

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(500);
    return;
  }

  unsigned long now = millis();

  // -------------------------
  // 1. Read and send sensors
  // -------------------------
  if (now - lastSensorSend >= SENSOR_SEND_INTERVAL_MS) {
    lastSensorSend = now;

    int raw = readSoilRaw();
    float moisture = rawToMoisturePercent(raw);
    bool waterDetected = readWaterDetected();

    Serial.println();
    Serial.println("----- SENSOR READING -----");
    Serial.print("Soil raw ADC: ");
    Serial.println(raw);

    Serial.print("Soil moisture: ");
    Serial.print(moisture, 1);
    Serial.println("%");

    Serial.print("Water detected: ");
    Serial.println(waterDetected ? "YES" : "NO");

    sendSensorReading(raw, moisture, waterDetected);
  }

  // -------------------------
  // 2. Poll pump command
  // -------------------------
  if (now - lastCommandPoll >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPoll = now;

    bool requested = false;

    if (fetchPumpCommand(requested)) {
      desiredPumpOn = requested;
      lastGoodCommand = now;

      bool waterDetected = readWaterDetected();

      // LOCAL SAFETY OVERRIDE:
      // no water always forces relay OFF.
      bool safeState = desiredPumpOn && waterDetected;

      if (safeState != relayOn) {
        setRelay(safeState);
        reportPumpStatus(relayOn, waterDetected);
      }

      if (desiredPumpOn && !waterDetected) {
        Serial.println("SAFETY: Pump ON command blocked because no water is detected.");
        // Report OFF even if the relay was already OFF. This lets the backend
        // clear a stale ON command rather than repeatedly requesting ON.
        reportPumpStatus(false, waterDetected);
      }
    }
  }

  // -------------------------
  // 3. Communication fail-safe
  // -------------------------
  if (relayOn &&
      lastGoodCommand > 0 &&
      now - lastGoodCommand > COMMAND_FAILSAFE_MS) {

    Serial.println("FAIL-SAFE: No valid server command recently. Pump forced OFF.");
    setRelay(false);

    bool waterDetected = readWaterDetected();
    reportPumpStatus(false, waterDetected);
  }

  delay(20);
}