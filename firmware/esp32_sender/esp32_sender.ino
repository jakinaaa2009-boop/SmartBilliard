/*
  SMART BILLIARD ESP32 SENDER
  IR + MPU6050 + BUZZER + WEBSITE + ESP-NOW

  Target: ESP32 Dev Module
  Arduino ESP32 Core 3.x

  GPIO:
  27 - Button
  26 - IR Transmitter
  25 - IR Receiver
  21 - MPU6050 SDA
  22 - MPU6050 SCL
  33 - Buzzer
   2 - WiFi LED

  BALL DETECTION:
  1. IR beam interrupted
  2. MPU6050 detects impact
  3. Ball count +1
  4. Send count to website

  Alarm:
  - Target: 12 balls
  - No progress for 30 seconds: buzzer ON
  - 12 balls returned: buzzer OFF
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <esp_system.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <esp_idf_version.h>
#include <esp_err.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

// =======================================
// WEBSITE CONFIGURATION
// =======================================

const char* API_BASE = "https://smart-billiard.vercel.app";

const char* DEVICE_ID = "billiard_01";
const char* DEVICE_NAME = "Billiard 01";

const char* DEVICE_SECRET_OVERRIDE = "";

// =======================================
// GPIO CONFIGURATION
// =======================================

#define BUTTON_PIN 27

#define IR_TX 26
#define IR_RX 25

#define MPU_SDA 21
#define MPU_SCL 22

#define BUZZER_PIN 33

#define WIFI_LED 2

#define BUZZER_ON HIGH
#define BUZZER_OFF LOW

#define WIFI_LED_ON HIGH
#define WIFI_LED_OFF LOW

// =======================================
// BALL DETECTION SETTINGS
// =======================================

// Required balls
const uint32_t BALL_TARGET = 12;

// MPU vibration sensitivity (m/s2)
const float IMPACT_THRESHOLD = 1.70f;

// Gravity baseline adaptation
const float BASELINE_ALPHA = 0.008f;

// Time to detect MPU after IR (ms)
const uint32_t IMPACT_WINDOW_MS = 1800;

// Minimum time between counted balls
const uint32_t BALL_COOLDOWN_MS = 220;

// IR debounce
const uint8_t BLOCKED_SAMPLES_REQUIRED = 2;
const uint8_t CLEAR_SAMPLES_REQUIRED = 2;

// =======================================
// BUZZER SETTINGS
// =======================================

// 30 seconds without confirmed ball
const uint32_t ALARM_IDLE_TIMEOUT_MS = 30000;

// Buzzer beep pattern
const uint32_t BEEP_ON_MS = 250;
const uint32_t BEEP_OFF_MS = 650;

// =======================================
// IR SETTINGS
// =======================================

// Most 38kHz IR receivers output LOW
// when the IR carrier is detected.
//
// If your receiver has different polarity,
// this must be adjusted.

const int IR_RECEIVED_LEVEL = LOW;

// Require 3 detections from 4 samples
const uint8_t IR_CARRIER_HITS_FOR_CLEAR = 3;

// =======================================
// ESP-NOW RECEIVER
// =======================================

uint8_t receiverAddress[] = {
  0x58, 0x2A, 0xBD, 0xD8, 0x9C, 0x00
};

// Must match receiver firmware
typedef struct __attribute__((packed)) {
  uint8_t command;
  // 1 = Toggle
  // 2 = Open
  // 3 = Close
} RadioMessage;

struct APIEvent {
  int eventType;
  int value;
};

// =======================================
// GLOBAL OBJECTS
// =======================================

Preferences prefs;

Adafruit_MPU6050 mpu;

// Hardware may be absent: never prevent WiFi / ESP-NOW startup.
bool mpuReady = false;
bool espNowReady = false;

// WiFiManager-free configuration portal. No automatic ESP.restart() calls.
// Hotspot is always available for configuration, even without router access.
const char* SETUP_AP_SSID = "Billiard-Setup";
const char* SETUP_AP_PASSWORD = "12345678";
WebServer configServer(80);
DNSServer captiveDns;
bool configPortalActive = false;
volatile bool newCredentialsPending = false;
volatile bool forgetCredentialsPending = false;
volatile bool wifiScanActive = false;

// RTC memory survives software reset and helps distinguish a reboot loop.
RTC_DATA_ATTR uint32_t bootCount = 0;
RTC_DATA_ATTR uint32_t lastBootStage = 0; // 1=WiFi,2=ESP-NOW,3=MPU,4=Tasks,5=Ready


String deviceSecret;

RadioMessage radioMsg;

esp_now_peer_info_t peerInfo;

SemaphoreHandle_t radioMutex = NULL;

QueueHandle_t apiQueue = NULL;

// Shared state mutex
portMUX_TYPE stateMux =
  portMUX_INITIALIZER_UNLOCKED;

// =======================================
// GLOBAL STATE
// =======================================

bool doorOpen = false;

bool ballCounterActive = false;

bool forceAlarm = false;

bool alarmMuted = false;

uint32_t ballCount = 0;

uint32_t counterGeneration = 0;

uint32_t lastBallProgressMs = 0;

bool countDirty = false;

uint32_t lastPostedCount = 0;

// Admin can enable each sensor on its own to see which one counts.
bool irEnabled = true;
bool vibrationEnabled = true;
bool irHitPending = false;
bool vibrationHitPending = false;
bool irDetectedNow = false;
bool irSeenSinceReport = false;
uint32_t vibrationCount = 0;

bool irSensorEnabled() {
  portENTER_CRITICAL(&stateMux);
  bool value = irEnabled;
  portEXIT_CRITICAL(&stateMux);
  return value;
}

bool vibrationSensorEnabled() {
  portENTER_CRITICAL(&stateMux);
  bool value = vibrationEnabled;
  portEXIT_CRITICAL(&stateMux);
  return value;
}

void setIrSensorEnabled(bool on) {
  portENTER_CRITICAL(&stateMux);
  irEnabled = on;
  portEXIT_CRITICAL(&stateMux);
  Serial.printf("[SENSOR] IR %s\n", on ? "ON" : "OFF");
}

void setVibrationSensorEnabled(bool on) {
  portENTER_CRITICAL(&stateMux);
  vibrationEnabled = on;
  if (on) vibrationCount = 0;
  portEXIT_CRITICAL(&stateMux);
  Serial.printf("[SENSOR] VIBRATION %s\n", on ? "ON" : "OFF");
}

void noteIrSample(bool blocked) {
  portENTER_CRITICAL(&stateMux);
  irDetectedNow = blocked;
  if (blocked) irSeenSinceReport = true;
  portEXIT_CRITICAL(&stateMux);
}

bool takeIrDetected() {
  portENTER_CRITICAL(&stateMux);
  bool value = irDetectedNow || irSeenSinceReport;
  irSeenSinceReport = false;
  portEXIT_CRITICAL(&stateMux);
  return value;
}

void noteVibration() {
  portENTER_CRITICAL(&stateMux);
  if (vibrationCount < 1000000) vibrationCount++;
  portEXIT_CRITICAL(&stateMux);
}

uint32_t currentVibrationCount() {
  portENTER_CRITICAL(&stateMux);
  uint32_t value = vibrationCount;
  portEXIT_CRITICAL(&stateMux);
  return value;
}

void markIrHit() {
  portENTER_CRITICAL(&stateMux);
  irHitPending = true;
  portEXIT_CRITICAL(&stateMux);
}

void markVibrationHit() {
  portENTER_CRITICAL(&stateMux);
  vibrationHitPending = true;
  portEXIT_CRITICAL(&stateMux);
}

bool takeIrHit() {
  portENTER_CRITICAL(&stateMux);
  bool hit = irHitPending;
  irHitPending = false;
  portEXIT_CRITICAL(&stateMux);
  return hit;
}

bool takeVibrationHit() {
  portENTER_CRITICAL(&stateMux);
  bool hit = vibrationHitPending;
  vibrationHitPending = false;
  portEXIT_CRITICAL(&stateMux);
  return hit;
}

// =======================================
// COUNTER SNAPSHOT
// =======================================

struct CounterSnapshot {
  bool active;
  bool forced;
  bool muted;
  uint32_t count;
  uint32_t generation;
  uint32_t lastProgress;
  bool dirty;
};

// Explicit prototype prevents Arduino auto-prototype from moving this before the struct.
CounterSnapshot snapshotCounter();

CounterSnapshot snapshotCounter() {

  CounterSnapshot s;

  portENTER_CRITICAL(&stateMux);

  s.active = ballCounterActive;
  s.forced = forceAlarm;
  s.muted = alarmMuted;
  s.count = ballCount;
  s.generation = counterGeneration;
  s.lastProgress = lastBallProgressMs;
  s.dirty = countDirty;

  portEXIT_CRITICAL(&stateMux);

  return s;
}

// =======================================
// DOOR STATUS
// =======================================

bool snapshotDoorOpen() {

  portENTER_CRITICAL(&stateMux);

  bool result = doorOpen;

  portEXIT_CRITICAL(&stateMux);

  return result;
}

void setDoorOpen(bool open) {

  portENTER_CRITICAL(&stateMux);

  doorOpen = open;

  portEXIT_CRITICAL(&stateMux);
}

// =======================================
// WIFI LED
// =======================================

void updateWiFiLED() {

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(WIFI_LED, WIFI_LED_ON);
  } else {
    digitalWrite(WIFI_LED, WIFI_LED_OFF);
  }
}

// =======================================
// SAVE DEVICE SECRET
// =======================================

void saveSecret(const String& secret) {

  deviceSecret = secret;

  prefs.begin("smartbilliard", false);

  prefs.putString("secret", secret);

  prefs.end();

  Serial.println("[AUTH] Secret stored");
}

// =======================================
// LOAD DEVICE SECRET
// =======================================

void loadSecret() {

  if (strlen(DEVICE_SECRET_OVERRIDE) > 0) {

    deviceSecret = DEVICE_SECRET_OVERRIDE;
    return;
  }

  prefs.begin("smartbilliard", true);

  deviceSecret = prefs.getString("secret", "");

  prefs.end();
}

// =======================================
// ESP-NOW SEND CALLBACK
// =======================================

void printSendStatus(
  esp_now_send_status_t status
) {

  Serial.printf(
    "[ESP-NOW] Delivery: %s\n",
    status == ESP_NOW_SEND_SUCCESS
      ? "SUCCESS"
      : "FAILED"
  );
}

// Support ESP-IDF callback signatures
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 5, 0)

void OnDataSent(
  const esp_now_send_info_t* info,
  esp_now_send_status_t status
) {
  printSendStatus(status);
}

#else

void OnDataSent(
  const uint8_t* mac,
  esp_now_send_status_t status
) {
  printSendStatus(status);
}

#endif

// =======================================
// SEND ESP-NOW COMMAND
// =======================================

void sendRadio(uint8_t command) {

  if (!radioMutex || !espNowReady) {
    Serial.println("[ESP-NOW] Not ready; command not sent");
    return;
  }

  if (
    xSemaphoreTake(
      radioMutex,
      pdMS_TO_TICKS(200)
    ) != pdTRUE
  ) {
    return;
  }

  radioMsg.command = command;

  // One press must be enough. ESP-NOW drops frames while Wi-Fi is busy,
  // so the same open/close command is repeated. Repeats are safe because
  // command 2 and 3 set a state instead of toggling.
  esp_err_t result = ESP_FAIL;
  for (uint8_t attempt = 0; attempt < 4; attempt++) {
    result = esp_now_send(
      receiverAddress,
      (const uint8_t*)&radioMsg,
      sizeof(radioMsg)
    );
    if (attempt < 3) {
      vTaskDelay(pdMS_TO_TICKS(40));
    }
  }

  xSemaphoreGive(radioMutex);

  Serial.printf(
    "[ESP-NOW] Command %u x4: %s | channel %d | %s\n",
    command,
    result == ESP_OK ? "QUEUED" : "SEND ERROR",
    WiFi.channel(),
    esp_err_to_name(result)
  );
}

// =======================================
// START BALL COUNTER
// =======================================

void startBallCounter(bool resetCounter) {

  portENTER_CRITICAL(&stateMux);

  bool wasActive = ballCounterActive;

  if (!wasActive) {

    if (resetCounter) {
      ballCount = 0;
    }

    ballCounterActive = true;

    forceAlarm = false;
    alarmMuted = false;

    lastBallProgressMs = millis();

    counterGeneration++;

    countDirty = true;
  }

  uint32_t count = ballCount;

  portEXIT_CRITICAL(&stateMux);

  Serial.printf(
    "[COUNT] %s - %lu / %lu\n",
    wasActive ? "ALREADY ACTIVE" : "STARTED",
    (unsigned long)count,
    (unsigned long)BALL_TARGET
  );
}

// =======================================
// STOP BALL COUNTER
// =======================================

void stopBallCounter(bool resetCounter) {

  portENTER_CRITICAL(&stateMux);

  ballCounterActive = false;

  forceAlarm = false;
  alarmMuted = false;

  if (resetCounter) {
    ballCount = 0;
    countDirty = true;
  }

  counterGeneration++;

  uint32_t count = ballCount;

  portEXIT_CRITICAL(&stateMux);

  ledcWrite(IR_TX, 0);

  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.printf(
    "[COUNT] STOPPED - %lu\n",
    (unsigned long)count
  );
}

// =======================================
// RESET COUNTER
// =======================================

void resetBallCounter() {

  portENTER_CRITICAL(&stateMux);

  ballCount = 0;

  counterGeneration++;

  countDirty = true;

  lastBallProgressMs = millis();

  forceAlarm = false;
  alarmMuted = false;

  portEXIT_CRITICAL(&stateMux);

  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.println("[COUNT] RESET 0/12");
}

// Always restarts at 0, even if a count is already running.
void restartBallCounter() {

  portENTER_CRITICAL(&stateMux);

  ballCount = 0;
  ballCounterActive = true;
  forceAlarm = false;
  alarmMuted = false;
  lastBallProgressMs = millis();
  counterGeneration++;
  countDirty = true;

  portEXIT_CRITICAL(&stateMux);

  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.println("[COUNT] TEST START 0");
}

// =======================================
// CONFIRM BALL
// IR + MPU REQUIRED
// =======================================

bool confirmBall(uint32_t expectedGeneration) {

  bool success = false;

  uint32_t count = 0;

  portENTER_CRITICAL(&stateMux);

  if (
    ballCounterActive &&
    counterGeneration == expectedGeneration &&
    ballCount < BALL_TARGET
  ) {

    ballCount++;

    countDirty = true;

    // Restart alarm timer
    lastBallProgressMs = millis();

    count = ballCount;

    success = true;
  }

  portEXIT_CRITICAL(&stateMux);

  if (success) {

    Serial.printf(
      "[BALL] IR + MPU CONFIRMED: %lu / %lu\n",
      (unsigned long)count,
      (unsigned long)BALL_TARGET
    );

    if (count == BALL_TARGET) {

      Serial.println(
        "[BALL] ALL 12 RETURNED!"
      );

      Serial.println(
        "[ALARM] BUZZER OFF"
      );

      digitalWrite(
        BUZZER_PIN,
        BUZZER_OFF
      );
    }
  }

  return success;
}

// =======================================
// ALARM COMMAND CONTROL
// =======================================

void setAlarmForced(bool enabled) {

  portENTER_CRITICAL(&stateMux);

  forceAlarm = enabled;

  alarmMuted = !enabled;

  portEXIT_CRITICAL(&stateMux);
}

// =======================================
// IR BEAM SAMPLING
// =======================================

bool sampleBeamBlocked() {

  uint8_t hits = 0;

  for (uint8_t j = 0; j < 4; j++) {

    // Send 38kHz IR
    ledcWrite(IR_TX, 128);

    delayMicroseconds(450);

    if (
      digitalRead(IR_RX) == IR_RECEIVED_LEVEL
    ) {
      hits++;
    }

    // Stop IR temporarily
    ledcWrite(IR_TX, 0);

    delayMicroseconds(350);
  }

  // Too few carrier detections
  // means the beam is blocked
  return hits < IR_CARRIER_HITS_FOR_CLEAR;
}

// =======================================
// BUZZER TASK
// =======================================

void AlarmTask(void* parameter) {

  bool previousAlarm = false;

  while (true) {

    CounterSnapshot s = snapshotCounter();

    uint32_t now = millis();

    bool timedOut =
      (uint32_t)(now - s.lastProgress)
      >= ALARM_IDLE_TIMEOUT_MS;

    bool alarm =
      s.active &&
      s.count < BALL_TARGET &&
      !s.muted &&
      (s.forced || timedOut);

    if (alarm != previousAlarm) {

      Serial.printf(
        "[ALARM] %s - BALLS: %lu/%lu\n",
        alarm ? "ON" : "OFF",
        (unsigned long)s.count,
        (unsigned long)BALL_TARGET
      );

      previousAlarm = alarm;
    }

    if (!alarm) {

      digitalWrite(
        BUZZER_PIN,
        BUZZER_OFF
      );

    } else {

      // Intermittent buzzer
      uint32_t cycle =
        BEEP_ON_MS + BEEP_OFF_MS;

      bool beep =
        (now % cycle) < BEEP_ON_MS;

      digitalWrite(
        BUZZER_PIN,
        beep ? BUZZER_ON : BUZZER_OFF
      );
    }

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// =======================================
// HTTP POST
// =======================================

bool postJson(
  const String& path,
  const String& body,
  String& response,
  bool auth
) {

  response = "";

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] Wi-Fi offline");
    return false;
  }

  String uri = path.startsWith("/") ? path : "/" + path;

  String host = API_BASE;
  if (host.startsWith("https://")) host.remove(0, 8);
  else if (host.startsWith("http://")) host.remove(0, 7);
  while (host.length() && host.endsWith("/")) {
    host.remove(host.length() - 1);
  }

  WiFiClientSecure client;

  // Certificate is not validated. Vercel uses a public CA;
  // setInsecure keeps the board working without a bundled root.
  client.setInsecure();
  client.setHandshakeTimeout(30);
  client.setTimeout(20000);

  HTTPClient http;

  http.setReuse(false);
  http.setTimeout(20000);

  if (!http.begin(client, host.c_str(), 443, uri.c_str(), true)) {
    Serial.println("[API] begin failed");
    return false;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "Connection",
    "close"
  );

  if (auth && deviceSecret.length()) {

    http.addHeader(
      "Authorization",
      String("Bearer ") + deviceSecret
    );
  }

  int code = http.POST(body);

  response = http.getString();

  if (code < 0) {
    String err = HTTPClient::errorToString(code);
    Serial.printf(
      "[API] POST %s failed: %s\n",
      uri.c_str(),
      err.c_str()
    );
  } else {
    Serial.printf(
      "[API] POST %s -> %d\n",
      uri.c_str(),
      code
    );
  }

  http.end();
  client.stop();

  if (code == 401) {
    Serial.println("[API] Unauthorized");
    if (auth && deviceSecret.length()) {
      deviceSecret = "";
      prefs.begin("smartbilliard", false);
      prefs.remove("secret");
      prefs.end();
      Serial.println("[AUTH] Stored secret cleared");
    }
  }

  return code >= 200 && code < 300;
}

// =======================================
// HANDLE WEBSITE COMMANDS
// =======================================

void handleApiJson(const String& response) {

  JsonDocument doc;

  if (deserializeJson(doc, response)) {
    return;
  }

  const char* secret = doc["secret"];

  if (secret && strlen(secret) > 0) {
    saveSecret(secret);
  }

  JsonVariant cmd = doc["command"];

  if (cmd.isNull()) return;

  const char* commandId = cmd["commandId"];

  const char* command = cmd["command"];

  if (!commandId || !command) return;

  bool ok = true;

  Serial.printf(
    "[COMMAND] %s\n",
    command
  );

  if (strcmp(command, "OPEN_BOX") == 0) {

    setDoorOpen(true);

    sendRadio(2);

    stopBallCounter(true);

  } else if (
    strcmp(command, "CLOSE_BOX") == 0
  ) {

    setDoorOpen(false);

    sendRadio(3);

  } else if (
    strcmp(command, "START_BALL_COUNT") == 0
  ) {

    restartBallCounter();

  } else if (
    strcmp(command, "TIME_EXPIRED") == 0
  ) {

    // Start IR + MPU counting
    startBallCounter(true);

    Serial.println(
      "[SYSTEM] TIMER EXPIRED - COUNTING"
    );

  } else if (
    strcmp(command, "ENABLE_IR") == 0
  ) {

    setIrSensorEnabled(true);

  } else if (
    strcmp(command, "DISABLE_IR") == 0
  ) {

    setIrSensorEnabled(false);

  } else if (
    strcmp(command, "ENABLE_VIBRATION") == 0
  ) {

    setVibrationSensorEnabled(true);

  } else if (
    strcmp(command, "DISABLE_VIBRATION") == 0
  ) {

    setVibrationSensorEnabled(false);

  } else if (
    strcmp(command, "START_ALARM") == 0
  ) {

    startBallCounter(false);

    // Website requests immediate alarm
    setAlarmForced(true);

  } else if (
    strcmp(command, "STOP_BALL_COUNT") == 0
  ) {

    stopBallCounter(false);

  } else if (
    strcmp(command, "STOP_ALARM") == 0
  ) {

    setAlarmForced(false);

  } else if (
    strcmp(command, "RESET_BALL_COUNT") == 0
  ) {

    resetBallCounter();

  } else if (
    strcmp(command, "RESET") == 0
  ) {

    setDoorOpen(false);

    sendRadio(3);

    stopBallCounter(true);

  } else {

    ok = false;
  }

  // Confirm command to server
  String resultBody =
    String("{\"commandId\":\"") +
    commandId +
    "\",\"success\":" +
    (ok ? "true" : "false") +
    "}";

  String ignored;

  postJson(
    String("/api/iot/devices/") +
      DEVICE_ID +
      "/command-result",
    resultBody,
    ignored,
    true
  );
}

// =======================================
// DEVICE ENROLLMENT
// =======================================

void enroll() {

  if (
    deviceSecret.length() ||
    WiFi.status() != WL_CONNECTED
  ) {
    return;
  }

  String body = "{";

  body += "\"deviceId\":\"" +
    String(DEVICE_ID) + "\",";

  body += "\"name\":\"" +
    String(DEVICE_NAME) + "\",";

  body += "\"firmwareVersion\":\"1.4.3\",";

  body += "\"uptime\":" +
    String(millis() / 1000) + ",";

  body += "\"wifiRssi\":" +
    String(WiFi.RSSI()) + ",";

  body += "\"ipAddress\":\"" +
    WiFi.localIP().toString() + "\"";

  body += "}";

  String response;

  if (
    postJson(
      "/api/iot/announce",
      body,
      response,
      false
    )
  ) {

    handleApiJson(response);

    Serial.println("[AUTH] Enrolled");

  } else {

    Serial.println("[AUTH] Enrollment failed");
    if (response.length()) {
      Serial.println(response);
    }
  }
}

// =======================================
// HEARTBEAT
// =======================================

void heartbeat() {

  CounterSnapshot s = snapshotCounter();

  bool open = snapshotDoorOpen();

  String body = "{";

  body += "\"deviceId\":\"" +
    String(DEVICE_ID) + "\",";

  body += "\"name\":\"" +
    String(DEVICE_NAME) + "\",";

  body += "\"firmwareVersion\":\"1.4.3\",";

  body += "\"uptime\":" +
    String(millis() / 1000) + ",";

  body += "\"wifiRssi\":" +
    String(WiFi.RSSI()) + ",";

  body += "\"ipAddress\":\"" +
    WiFi.localIP().toString() + "\",";

  body += "\"boxStatus\":\"" +
    String(open ? "UNLOCKED" : "LOCKED") +
    "\",";

  body += "\"ballCounterActive\":" +
    String(s.active ? "true" : "false") +
    ",";

  body += "\"ballCount\":" +
    String(s.count) + ",";

  bool irOn = irSensorEnabled();
  bool vibrationOn = vibrationSensorEnabled();
  bool irHit = takeIrHit();
  bool vibrationHit = takeVibrationHit();
  bool irDetected = takeIrDetected();
  uint32_t vibCount = currentVibrationCount();

  body += "\"irEnabled\":" +
    String(irOn ? "true" : "false") + ",";

  body += "\"vibrationEnabled\":" +
    String(vibrationOn ? "true" : "false") + ",";

  body += "\"irDetected\":" +
    String(irDetected ? "true" : "false") + ",";

  body += "\"vibrationCount\":" +
    String(vibCount) + ",";

  body += "\"irHit\":" +
    String(irHit ? "true" : "false") + ",";

  body += "\"vibrationHit\":" +
    String(vibrationHit ? "true" : "false") + ",";

  body += "\"mpuReady\":" +
    String(mpuReady ? "true" : "false");

  body += "}";

  String response;

  if (
    postJson(
      "/api/iot/announce",
      body,
      response,
      true
    )
  ) {

    handleApiJson(response);
  }
}

// =======================================
// REPORT BUTTON
// =======================================

void reportButton() {

  String body =
    "{\"device\":\"" +
    String(DEVICE_ID) +
    "\",\"action\":\"button_pressed\","
    "\"eventType\":1,\"value\":1}";

  String response;

  if (
    postJson(
      "/api/button",
      body,
      response,
      true
    )
  ) {

    handleApiJson(response);
  }
}

// =======================================
// SEND BALL COUNT TO WEBSITE
// =======================================

void reportLatestCount() {

  CounterSnapshot snap = snapshotCounter();

  String body =
    "{\"device\":\"" +
    String(DEVICE_ID) +
    "\",\"action\":\"ball_detected\","
    "\"eventType\":2,\"value\":" +
    String(snap.count) +
    "}";

  String response;

  if (!postJson(
    "/api/button",
    body,
    response,
    true
  )) {
    return;
  }

  portENTER_CRITICAL(&stateMux);

  lastPostedCount = snap.count;

  if (
    ballCount == snap.count &&
    counterGeneration == snap.generation
  ) {
    countDirty = false;
  }

  portEXIT_CRITICAL(&stateMux);

  handleApiJson(response);
}

// =======================================
// BUTTON TASK
// =======================================

void ButtonTask(void* parameter) {

  bool reading = HIGH;
  bool stable = HIGH;
  uint32_t changedAt = 0;
  uint32_t lastPress = 0;

  while (true) {

    bool state = digitalRead(BUTTON_PIN);
    uint32_t now = millis();

    if (state != reading) {
      reading = state;
      changedAt = now;
    }

    // Accept the press only after it stays down, then ignore bounce.
    if (
      (uint32_t)(now - changedAt) >= 40 &&
      reading != stable
    ) {
      stable = reading;

      if (stable == LOW && (uint32_t)(now - lastPress) > 500) {

        lastPress = now;

        bool nextDoor = !snapshotDoorOpen();

        setDoorOpen(nextDoor);

        Serial.printf(
          "[BUTTON] %s\n",
          nextDoor ? "OPEN" : "CLOSE"
        );

        // 2 = open, 3 = close. Do not send toggle (1): a second
        // bounce or a repeated frame would undo the close.
        sendRadio(nextDoor ? 2 : 3);

        APIEvent event{1, 1};

        xQueueSend(
          apiQueue,
          &event,
          0
        );
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// =======================================
// IR + MPU6050 SENSOR TASK
// =======================================

void SensorTask(void* parameter) {

  bool beamArmed = false;

  bool previousImpactHigh = false;

  bool waitingForImpact = false;

  uint8_t blockedSamples = 0;

  uint8_t clearSamples = 0;

  uint32_t pendingSince = 0;

  uint32_t lastBallAt = 0;

  uint32_t lastStatus = 0;

  uint32_t seenGeneration = UINT32_MAX;

  float baseX = 0;
  float baseY = 0;
  float baseZ = 0;

  sensors_event_t a, g, temp;

  // =====================================
  // MPU INITIAL CALIBRATION
  // =====================================

  if (!mpuReady) {
    Serial.println("[SENSOR] MPU6050 absent. IR can still be tested alone.");
  } else {

  Serial.println(
    "[MPU] Calibrating..."
  );

  int validSamples = 0;

  for (int i = 0; i < 40; i++) {

    if (mpu.getEvent(&a, &g, &temp)) {

      baseX += a.acceleration.x;
      baseY += a.acceleration.y;
      baseZ += a.acceleration.z;

      validSamples++;
    }

    vTaskDelay(pdMS_TO_TICKS(5));
  }

  if (validSamples > 0) {

    baseX /= validSamples;
    baseY /= validSamples;
    baseZ /= validSamples;
  }

  Serial.println(
    "[MPU] Calibration complete"
  );

  }

  // =====================================
  // SENSOR MAIN LOOP
  // =====================================

  while (true) {

    CounterSnapshot s = snapshotCounter();

    uint32_t now = millis();

    // Detect new session or reset
    if (s.generation != seenGeneration) {

      seenGeneration = s.generation;

      beamArmed = false;
      waitingForImpact = false;

      blockedSamples = 0;
      clearSamples = 0;

      lastBallAt = 0;

      previousImpactHigh = false;
    }

    bool useIr = irSensorEnabled();
    bool useMpu = vibrationSensorEnabled() && mpuReady;
    bool counting = s.active && s.count < BALL_TARGET;

    // Both sensors off: do not emit IR or watch for vibration.
    if (!useIr && !useMpu) {

      ledcWrite(IR_TX, 0);
      waitingForImpact = false;

      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }

    // ===================================
    // READ MPU6050
    // ===================================

    bool readingOK = false;

    if (mpuReady) {
      readingOK = mpu.getEvent(&a, &g, &temp);
    }

    float impact = 0.0f;

    if (readingOK) {

      float dx = a.acceleration.x - baseX;
      float dy = a.acceleration.y - baseY;
      float dz = a.acceleration.z - baseZ;

      // Dynamic acceleration magnitude
      impact = sqrtf(
        dx * dx +
        dy * dy +
        dz * dz
      );

      // Update gravity baseline
      baseX += BASELINE_ALPHA * dx;
      baseY += BASELINE_ALPHA * dy;
      baseZ += BASELINE_ALPHA * dz;
    }

    // ===================================
    // DETECT NEW MPU IMPACT
    // ===================================

    bool impactHigh =
      useMpu &&
      readingOK &&
      impact >= IMPACT_THRESHOLD;

    bool newImpact =
      impactHigh &&
      !previousImpactHigh;

    previousImpactHigh = impactHigh;

    if (newImpact) {
      noteVibration();
      markVibrationHit();
    }

    // ===================================
    // READ IR SENSOR
    // ===================================

    bool blocked = false;

    if (!useIr) {

      ledcWrite(IR_TX, 0);
      beamArmed = false;
      blockedSamples = 0;
      clearSamples = 0;
      waitingForImpact = false;
      noteIrSample(false);

    } else {

    blocked = sampleBeamBlocked();

    if (blocked) {

      if (blockedSamples < 10) {
        blockedSamples++;
      }

      clearSamples = 0;

    } else {

      if (clearSamples < 10) {
        clearSamples++;
      }

      blockedSamples = 0;

      // Arm for next ball
      if (
        clearSamples >= CLEAR_SAMPLES_REQUIRED &&
        (
          lastBallAt == 0 ||
          (uint32_t)(now - lastBallAt)
            >= BALL_COOLDOWN_MS
        )
      ) {

        beamArmed = true;
      }
    }

      noteIrSample(blocked);
    }

    // ===================================
    // IR DETECTED
    // ===================================

    if (
      useIr &&
      !waitingForImpact &&
      beamArmed &&
      blockedSamples >= BLOCKED_SAMPLES_REQUIRED &&
      (
        lastBallAt == 0 ||
        (uint32_t)(now - lastBallAt)
          >= BALL_COOLDOWN_MS
      )
    ) {

      beamArmed = false;
      markIrHit();

      Serial.println(
        "[IR] BEAM BLOCKED"
      );

      if (!useMpu) {

        if (counting && confirmBall(seenGeneration)) {

          lastBallAt = now;

          Serial.println(
            "[BALL] COUNTED BY IR"
          );
        }

      } else {

        waitingForImpact = true;
        pendingSince = now;

        Serial.println(
          "[IR] Waiting for MPU impact..."
        );
      }
    }

    // Vibration alone counts when IR is switched off.
    if (useMpu && !useIr && newImpact) {

      markVibrationHit();

      if (counting && confirmBall(seenGeneration)) {

        lastBallAt = now;

        Serial.printf(
          "[MPU] IMPACT: %.2f m/s2\n",
          impact
        );

        Serial.println(
          "[BALL] COUNTED BY VIBRATION"
        );
      }
    }

    // ===================================
    // VERIFY BALL USING MPU6050
    // ===================================

    if (waitingForImpact) {

      // IR occurred but MPU did not confirm
      if (
        (uint32_t)(now - pendingSince)
          > IMPACT_WINDOW_MS
      ) {

        waitingForImpact = false;

        Serial.println(
          "[BALL] REJECTED - NO MPU IMPACT"
        );

      } else if (newImpact) {

        markVibrationHit();

        // Both sensors confirmed
        if (counting && confirmBall(seenGeneration)) {

          lastBallAt = now;

          Serial.printf(
            "[MPU] IMPACT: %.2f m/s2\n",
            impact
          );

          Serial.println(
            "[BALL] COUNTED SUCCESSFULLY"
          );
        }

        waitingForImpact = false;
      }
    }

    // ===================================
    // SENSOR SERIAL MONITOR
    // ===================================

    if (
      (uint32_t)(now - lastStatus) >= 1000
    ) {

      lastStatus = now;

      CounterSnapshot live =
        snapshotCounter();

      Serial.printf(
        "[SENSOR] IR=%s | MPU=%.2f | "
        "Threshold=%.2f | Balls=%lu/%lu | "
        "Pending=%s\n",
        blocked ? "BLOCKED" : "CLEAR",
        impact,
        IMPACT_THRESHOLD,
        (unsigned long)live.count,
        (unsigned long)BALL_TARGET,
        waitingForImpact ? "YES" : "NO"
      );
    }

    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

// =======================================
// WEBSITE API TASK
// =======================================

void APITask(void* parameter) {

  enroll();

  uint32_t lastBeat = 0;

  uint32_t lastCountPost = 0;

  uint32_t lastEnroll = 0;

  APIEvent event;

  while (true) {

    // Button events
    if (
      xQueueReceive(
        apiQueue,
        &event,
        pdMS_TO_TICKS(40)
      ) == pdTRUE
    ) {

      if (event.eventType == 1) {
        reportButton();
      }
    }

    uint32_t now = millis();

    // ===================================
    // DEVICE ENROLLMENT RETRY
    // ===================================

    if (
      WiFi.status() == WL_CONNECTED &&
      deviceSecret.length() == 0 &&
      (uint32_t)(now - lastEnroll) >= 10000
    ) {

      enroll();

      lastEnroll = millis();
    }

    // ===================================
    // SEND BALL COUNT
    // ===================================

    CounterSnapshot s =
      snapshotCounter();

    if (
      deviceSecret.length() &&
      s.dirty &&
      (uint32_t)(now - lastCountPost) >= 250
    ) {

      reportLatestCount();

      lastCountPost = millis();
    }

    // ===================================
    // HEARTBEAT
    // ===================================

    // Poll faster while the door is open so CLOSE_BOX is not
    // stuck behind the idle 4 second heartbeat.
    uint32_t heartbeatInterval =
      (s.active || snapshotDoorOpen() || irSensorEnabled() || vibrationSensorEnabled())
        ? 1000UL
        : 4000UL;

    if (
      deviceSecret.length() &&
      (uint32_t)(millis() - lastBeat)
        >= heartbeatInterval
    ) {

      heartbeat();

      lastBeat = millis();
    }
  }
}

// =======================================
// WIFI CONFIGURATION (without WiFiManager)
// =======================================

// Use ESP32 Preferences instead of calling WiFiManager::autoConnect().
// The portal is reachable at http://192.168.4.1 on Billiard-Setup.
bool getSavedWiFi(String& ssid, String& password) {
  Preferences p;
  if (!p.begin("sbwifi", true)) return false;
  ssid = p.getString("ssid", "");
  password = p.getString("password", "");
  p.end();
  return !ssid.isEmpty();
}

bool hasSavedWiFi() {
  String ssid, password;
  return getSavedWiFi(ssid, password);
}

void startSavedWiFi() {
  String ssid, password;
  if (!getSavedWiFi(ssid, password)) {
    Serial.println("[WIFI] No saved network. Use Billiard-Setup portal.");
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Disconnecting old network to apply settings");
    WiFi.disconnect(false, false);
    delay(80);
  }

  Serial.printf("[WIFI] Connecting to saved SSID: %s\n", ssid.c_str());
  WiFi.begin(ssid.c_str(), password.c_str());
  // No reboot and no blocking wait here; WiFiTask observes connection.
}

const char* portalHtml = R"HTML(
<!DOCTYPE html><html lang="mn"><head><meta name="viewport" content="width=device-width,initial-scale=1">
<meta charset="utf-8"><title>Smart Billiard Wi-Fi</title>
<style>body{font-family:system-ui,sans-serif;background:#101822;color:white;max-width:450px;margin:5vh auto;padding:20px}
main{background:#1c2838;padding:25px;border-radius:16px}label{display:block;margin:15px 0 5px}
input,select{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:0;font-size:16px}
button{background:#1c9bff;color:white;border:0;padding:13px 20px;border-radius:8px;margin-top:12px;font-weight:bold}
button.ghost{background:#2a3a4e;width:100%}
small{color:#b1becd}</style></head><body><main><h2>Smart Billiard</h2>
<p>Ойрхон 2.4 GHz сүлжээнээс сонгоно.</p>
<form method="POST" action="/save" id="form">
<label>Ойрхон Wi-Fi</label>
<select id="nets" required></select>
<button class="ghost" type="button" id="refresh">Сүлжээ шинэчлэх</button>
<label>Нууц үг</label>
<input name="password" type="password" maxlength="63" placeholder="Wi-Fi нууц үг">
<input type="hidden" name="ssid" id="ssid">
<button type="submit">Хадгалаад холбох</button></form>
<p><small>Setup AP: Billiard-Setup / 12345678<br>
Setup address: http://192.168.4.1</small></p></main>
<script>
const nets=document.getElementById('nets');
const ssid=document.getElementById('ssid');
function fill(list){
  nets.innerHTML='';
  if(!list.length){
    const o=document.createElement('option');
    o.value='';
    o.textContent='Сүлжээ олдсонгүй';
    nets.appendChild(o);
    return;
  }
  list.forEach(function(n){
    const o=document.createElement('option');
    o.value=n.ssid;
    o.textContent=n.ssid+'  '+n.rssi+' dBm'+(n.secure?'  түгжээтэй':'');
    nets.appendChild(o);
  });
}
async function loadNets(){
  nets.innerHTML='';
  const wait=document.createElement('option');
  wait.textContent='Хайж байна...';
  nets.appendChild(wait);
  try{
    const res=await fetch('/scan');
    fill(await res.json());
  }catch(e){
    fill([]);
  }
}
document.getElementById('refresh').onclick=loadNets;
document.getElementById('form').onsubmit=function(){
  ssid.value=nets.value;
  if(!ssid.value){return false;}
};
loadNets();
</script>
</body></html>
)HTML";

String jsonEscape(const String& in) {
  String out;
  out.reserve(in.length() + 4);
  for (unsigned i = 0; i < in.length(); i++) {
    char c = in[i];
    if (c == '"' || c == '\\') out += '\\';
    if (c >= 32) out += c;
  }
  return out;
}

void handleWifiScan() {
  if (wifiScanActive) {
    configServer.send(200, "application/json", "[]");
    return;
  }

  wifiScanActive = true;
  Serial.println("[WIFI] Scanning nearby networks");
  int found = WiFi.scanNetworks(false, false, false, 120);
  String json = "[";
  int shown = 0;

  if (found > 0) {
    for (int i = 0; i < found && shown < 15; i++) {
      String ssid = WiFi.SSID(i);
      ssid.trim();
      if (!ssid.length()) continue;

      bool duplicate = false;
      for (int j = 0; j < i; j++) {
        if (WiFi.SSID(j) == ssid) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) continue;

      if (shown) json += ",";
      bool open = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
      json += "{\"ssid\":\"" + jsonEscape(ssid) +
        "\",\"rssi\":" + String(WiFi.RSSI(i)) +
        ",\"secure\":" + (open ? "false" : "true") + "}";
      shown++;
    }
  }

  json += "]";
  WiFi.scanDelete();
  wifiScanActive = false;
  Serial.printf("[WIFI] Scan found %d networks\n", shown);
  configServer.send(200, "application/json", json);
}

void initConfigPortal() {
  configServer.on("/", HTTP_GET, []() {
    configServer.send(200, "text/html; charset=utf-8", portalHtml);
  });

  configServer.on("/scan", HTTP_GET, []() {
    handleWifiScan();
  });

  configServer.on("/save", HTTP_POST, []() {
    String ssid = configServer.arg("ssid");
    String password = configServer.arg("password");
    ssid.trim();
    if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 63 ||
        (password.length() != 0 && password.length() < 8)) {
      configServer.send(400, "text/plain", "Invalid Wi-Fi name or password length");
      return;
    }

    Preferences p;
    if (!p.begin("sbwifi", false)) {
      configServer.send(500, "text/plain", "Cannot save Wi-Fi settings");
      return;
    }
    p.putString("ssid", ssid);
    p.putString("password", password);
    p.end();

    // A worker initiates STA connection after this HTTP response, not here.
    newCredentialsPending = true;
    configServer.send(200, "text/html; charset=utf-8",
       "<html><meta name='viewport' content='width=device-width'><body>"
       "<h2>Saved!</h2><p>ESP32 is attempting to connect to Wi-Fi. "
       "Keep the setup portal open for changes. See Serial Monitor for the result.</p>"
       "<a href='/'>Back</a></body></html>");
    Serial.printf("[WIFI] Credentials saved for SSID %s\n", ssid.c_str());
  });

  configServer.on("/status", HTTP_GET, []() {
    String body = String("{\"connected\":") +
         (WiFi.status() == WL_CONNECTED ? "true" : "false") +
         ",\"ip\":\"" + WiFi.localIP().toString() +
         "\",\"channel\":" + String(WiFi.channel()) + "}";
    configServer.send(200, "application/json", body);
  });
  configServer.onNotFound([]() {
    configServer.sendHeader("Location", "http://192.168.4.1/");
    configServer.send(302, "text/plain", "Redirecting to setup portal");
  });

  configServer.begin();
  captiveDns.start(53, "*", WiFi.softAPIP());
  configPortalActive = true;
  Serial.println("[SETUP] Portal running at http://192.168.4.1");
}

void initWiFi() {
  Serial.println("[BOOT 1/4] Starting native Wi-Fi (no WiFiManager)...");
  // Wi-Fi AP+STA allows setup and router connection on the same radio.
  // Connected STA determines the ESP-NOW channel; do not force a channel.
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(false); // manual, bounded 15-second retries

  bool apOK = WiFi.softAP(SETUP_AP_SSID, SETUP_AP_PASSWORD);
  Serial.printf("[SETUP] Hotspot: %s / %s | %s\n",
                SETUP_AP_SSID, SETUP_AP_PASSWORD,
                apOK ? "ACTIVE" : "FAILED");
  if (apOK) {
    Serial.printf("[SETUP] Connect phone then open http://%s\n",
                  WiFi.softAPIP().toString().c_str());
    initConfigPortal();
  }

  startSavedWiFi();
  // No blocking Wi-Fi autoConnect: setup must reach ESP-NOW and sensors.
  Serial.printf("[WIFI] STA MAC=%s\n", WiFi.macAddress().c_str());
}

// =======================================
// WIFI STATUS TASK
// =======================================

void WiFiTask(void* parameter) {
  bool previous = WiFi.status() == WL_CONNECTED;
  uint32_t lastReport = 0;
  uint32_t lastAttempt = millis();

  while (true) {
    uint32_t now = millis();
    bool connected = WiFi.status() == WL_CONNECTED;
    updateWiFiLED();

    if (wifiScanActive) {
      // Leave the radio alone while the portal lists nearby networks.
    } else if (forgetCredentialsPending) {
      forgetCredentialsPending = false;
      Preferences p;
      if (p.begin("sbwifi", false)) {
        p.clear();
        p.end();
      }
      WiFi.disconnect(false, true);
      Serial.println("[WIFI] Saved Wi-Fi erased (portal still active). No restart.");
      lastAttempt = now;
    } else if (newCredentialsPending) {
      newCredentialsPending = false;
      startSavedWiFi();
      lastAttempt = millis();
    } else if (!connected && hasSavedWiFi() &&
               (uint32_t)(now - lastAttempt) >= 15000UL) {
      Serial.println("[WIFI] Offline; retrying saved Wi-Fi without reboot...");
      startSavedWiFi();
      lastAttempt = millis();
    }

    connected = WiFi.status() == WL_CONNECTED;
    if (connected != previous) {
      Serial.printf("[WIFI] %s\n", connected ? "CONNECTED" : "DISCONNECTED");
      if (connected) {
        Serial.printf("[WIFI] Router IP=%s | channel=%d\n",
                      WiFi.localIP().toString().c_str(), WiFi.channel());
        Serial.println("[ESP-NOW] Receiver must be on router's channel");
      }
      lastReport = 0;
    }
    if (connected && (lastReport == 0 || (uint32_t)(now - lastReport) >= 60000UL)) {
      Serial.printf("[WIFI] ONLINE | IP=%s | RSSI=%d dBm | channel=%d\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.channel());
      lastReport = now;
    }

    previous = connected;
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

// =======================================
// MPU6050: optional and fault-tolerant
// =======================================

bool initializeMPU() {
  Serial.println("[MPU] Checking I2C on SDA=21 SCL=22...");

  if (!Wire.begin(MPU_SDA, MPU_SCL)) {
    Serial.println("[MPU] Wire.begin failed; verify ESP32 and GPIO wiring");
    return false;
  }

  Wire.setClock(100000);  // Prefer 100 kHz over 400 kHz for long test wires
  Wire.setTimeOut(25);    // Do not block boot on an unresponsive I2C bus

  // A healthy I2C bus should idle HIGH on both lines.
  if (digitalRead(MPU_SDA) == LOW || digitalRead(MPU_SCL) == LOW) {
    Serial.printf("[MPU] I2C BUS STUCK LOW: SDA=%d SCL=%d\n",
                  digitalRead(MPU_SDA), digitalRead(MPU_SCL));
    Serial.println("[MPU] Check swapped wires, 3.3V power and SDA/SCL pull-ups");
    Wire.end();
    return false;
  }

  uint8_t address = 0;
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) {
    address = 0x68;
  } else {
    Wire.beginTransmission(0x69);
    if (Wire.endTransmission() == 0) address = 0x69;
  }

  if (address == 0) {
    Serial.println("[MPU] No response at I2C 0x68 or 0x69");
    Serial.println("[MPU] WiFi + ESP-NOW will CONTINUE; ball counting disabled");
    Wire.end();
    return false;
  }

  Serial.printf("[MPU] Found I2C device at 0x%02X; initializing...\n", address);
  if (!mpu.begin(address, &Wire)) {
    Serial.println("[MPU] Device ACKed but MPU6050 initialization failed");
    Serial.println("[MPU] Confirm sensor type (WHO_AM_I), power and wiring");
    Wire.end();
    return false;
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);

  Serial.printf("[MPU] CONNECTED on 0x%02X\n", address);
  return true;
}

// =======================================
// SETUP (WiFi -> ESP-NOW -> MPU -> Tasks)
// =======================================

void setup() {
  Serial.begin(115200);
  delay(350);
  ++bootCount;
  Serial.printf("[BOOT] Restart count=%lu | previous phase=%lu | reset reason=%d\n",
                (unsigned long)bootCount, (unsigned long)lastBootStage,
                (int)esp_reset_reason());
  lastBootStage = 0;

  Serial.println();
  Serial.println("================================");
  Serial.println(" SMART BILLIARD ESP32 SENDER");
  Serial.println(" IR + MPU6050 + BUZZER");
  Serial.println(" Firmware 1.4.3 (WiFiManager-free)");
  Serial.println("================================");

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(IR_RX, INPUT_PULLUP);
  pinMode(WIFI_LED, OUTPUT);
  digitalWrite(WIFI_LED, WIFI_LED_OFF);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  if (!ledcAttach(IR_TX, 38000, 8)) {
    Serial.println("[IR] PWM initialization FAILED");
  }
  ledcWrite(IR_TX, 0);

  loadSecret();

  // 1) Start Wi-Fi AP+STA (without WiFiManager and without reboot-on-failure).
  lastBootStage = 1;
  initWiFi();
  updateWiFiLED();

  // 2) Initialize ESP-NOW on the current Wi-Fi channel.
  lastBootStage = 2;
  Serial.println("[BOOT 2/4] Starting ESP-NOW...");
  if (esp_now_init() == ESP_OK) {
    esp_now_register_send_cb(OnDataSent);
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, receiverAddress, 6);
    peerInfo.channel = 0; // use the sender's current WiFi channel
    peerInfo.ifidx = WIFI_IF_STA;
    peerInfo.encrypt = false;

    esp_err_t addResult = esp_now_add_peer(&peerInfo);
    if (addResult == ESP_OK || addResult == ESP_ERR_ESPNOW_EXIST) {
      espNowReady = true;
      Serial.printf("[ESP-NOW] READY | receiver=%02X:%02X:%02X:%02X:%02X:%02X | channel=%d\n",
                    receiverAddress[0], receiverAddress[1], receiverAddress[2],
                    receiverAddress[3], receiverAddress[4], receiverAddress[5],
                    WiFi.channel());
      Serial.println("[ESP-NOW] Receiver MUST listen on this same channel");
    } else {
      Serial.printf("[ESP-NOW] PEER FAILED: %s\n", esp_err_to_name(addResult));
    }
  } else {
    Serial.println("[ESP-NOW] initialization FAILED");
  }

  // 3) Check the MPU only AFTER network setup. Never halt in a fatal loop.
  lastBootStage = 3;
  Serial.println("[BOOT 3/4] Checking optional MPU6050...");
  mpuReady = initializeMPU();
  if (!mpuReady) {
    Serial.println("[MPU] SENSOR OFFLINE. IR can still be tested on its own.");
  }

  // 4) Create workers. Network and button still work when MPU is missing.
  lastBootStage = 4;
  Serial.println("[BOOT 4/4] Starting workers...");
  radioMutex = xSemaphoreCreateMutex();
  apiQueue = xQueueCreate(20, sizeof(APIEvent));
  if (!radioMutex || !apiQueue) {
    Serial.println("[FATAL] FreeRTOS allocation failed");
    return;
  }

  xTaskCreatePinnedToCore(ButtonTask, "ButtonTask", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(SensorTask, "SensorTask", 6144, NULL, 4, NULL, 1);
  xTaskCreatePinnedToCore(AlarmTask, "AlarmTask", 3072, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(APITask, "APITask", 16384, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(WiFiTask, "WiFiTask", 4096, NULL, 1, NULL, 0);

  lastBootStage = 5;
  Serial.println("================================");
  Serial.println(" SMART BILLIARD SYSTEM READY");
  Serial.printf(" WiFi: %s | ESP-NOW: %s | MPU6050: %s\n",
                WiFi.status() == WL_CONNECTED ? "CONNECTED" : "OFFLINE",
                espNowReady ? "READY" : "FAILED",
                mpuReady ? "READY" : "DISCONNECTED");
  Serial.println(" Button=27 IR_TX=26 IR_RX=25 SDA=21 SCL=22 Buzzer=33 LED=2");
  Serial.printf(" Ball target=%lu | threshold=%.2f m/s2 | alarm=%lu ms\n",
                (unsigned long)BALL_TARGET, IMPACT_THRESHOLD,
                (unsigned long)ALARM_IDLE_TIMEOUT_MS);
  Serial.println(" [SERIAL] S=start R=reset X=stop A=alarm M=mute P=status W=forgetWiFi");
  Serial.println("================================");
}

// =======================================
// MAIN LOOP
// =======================================

void loop() {

  // Keep the setup portal available, including without internet.
  if (configPortalActive) {
    captiveDns.processNextRequest();
    configServer.handleClient();
  }

  // Serial testing commands
  if (Serial.available()) {

    char c = Serial.read();

    // Start counting
    if (c == 'S' || c == 's') {

      startBallCounter(true);
    }

    // Reset count
    if (c == 'R' || c == 'r') {

      resetBallCounter();
    }

    // Stop counting
    if (c == 'X' || c == 'x') {

      stopBallCounter(false);
    }

    // Force alarm
    if (c == 'A' || c == 'a') {

      startBallCounter(false);

      setAlarmForced(true);
    }

    // Mute alarm
    if (c == 'M' || c == 'm') {

      setAlarmForced(false);
    }

    // Print status
    if (c == 'P' || c == 'p') {
      CounterSnapshot s = snapshotCounter();
      Serial.printf("[STATUS] WiFi=%s IP=%s CH=%d ESP-NOW=%s MPU=%s Active=%s Balls=%lu/%lu\n",
                    WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE",
                    WiFi.localIP().toString().c_str(), WiFi.channel(),
                    espNowReady ? "READY" : "OFFLINE",
                    mpuReady ? "READY" : "DISCONNECTED",
                    s.active ? "YES" : "NO",
                    (unsigned long)s.count, (unsigned long)BALL_TARGET);
    }

    // Erase settings WITHOUT software-restarting the ESP32.
    if (c == 'W' || c == 'w') {
      Serial.println("[WIFI] Forget requested. Wi-Fi credentials will be erased.");
      forgetCredentialsPending = true;
    }
  }

  vTaskDelay(pdMS_TO_TICKS(20));
}
