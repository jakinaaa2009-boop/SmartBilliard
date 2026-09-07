/*
  Smart Billiard ESP32 #1 — Main controller
  - Wi-Fi + HTTP polling of backend command queue
  - Relay lock: ON = box open, OFF = box closed
  - Buzzer alarm
  - Heartbeat every 15 seconds
  Configure secrets via firmware/config.h (not committed with real tokens)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* API_BASE = "http://192.168.1.10:3000";
const char* DEVICE_ID = "DEVICE-001";
const char* DEVICE_SECRET = "dev-secret-device-001";

const int RELAY_PIN = 26;
const int BUZZER_PIN = 27;
const int BALL_SENSOR_PIN = 34;

unsigned long lastHeartbeat = 0;
unsigned long relayOffAt = 0;
bool relayOn = false;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void setRelay(bool on, int durationMs = 0) {
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  relayOn = on;
  if (on && durationMs > 0) {
    relayOffAt = millis() + durationMs;
  }
}

void heartbeat() {
  HTTPClient http;
  http.begin(String(API_BASE) + "/api/iot/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_SECRET);
  int balls = analogRead(BALL_SENSOR_PIN) > 500 ? 8 : 7;
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"boxStatus\":\"" + String(relayOn ? "UNLOCKED" : "LOCKED") + "\",";
  body += "\"detectedBallCount\":" + String(balls) + ",";
  body += "\"alarmStatus\":" + String(digitalRead(BUZZER_PIN) ? "true" : "false") + ",";
  body += "\"firmwareVersion\":\"1.0.2\",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"uptime\":" + String(millis() / 1000) + ",";
  body += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\"";
  body += "}";
  http.POST(body);
  http.end();
}

void pollCommand() {
  HTTPClient http;
  http.begin(String(API_BASE) + "/api/iot/devices/" + String(DEVICE_ID) + "/command");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_SECRET);
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(2048);
    deserializeJson(doc, payload);
    JsonVariant cmd = doc["command"];
    if (!cmd.isNull() && !cmd["commandId"].isNull()) {
      String commandId = cmd["commandId"].as<String>();
      String command = cmd["command"].as<String>();
      int duration = cmd["duration"] | 7000;
      bool ok = true;
      if (command == "OPEN_BOX") setRelay(true, duration);
      else if (command == "CLOSE_BOX") setRelay(false);
      else if (command == "START_ALARM") digitalWrite(BUZZER_PIN, HIGH);
      else if (command == "STOP_ALARM") digitalWrite(BUZZER_PIN, LOW);
      else if (command == "RESET") {
        setRelay(false);
        digitalWrite(BUZZER_PIN, LOW);
      }
      HTTPClient result;
      result.begin(String(API_BASE) + "/api/iot/devices/" + String(DEVICE_ID) + "/command-result");
      result.addHeader("Content-Type", "application/json");
      result.addHeader("Authorization", String("Bearer ") + DEVICE_SECRET);
      String body = "{\"commandId\":\"" + commandId + "\",\"success\":" + String(ok ? "true" : "false") + "}";
      result.POST(body);
      result.end();
    }
  }
  http.end();
}

void loop() {
  if (relayOn && relayOffAt > 0 && millis() > relayOffAt) {
    setRelay(false);
    relayOffAt = 0;
  }
  if (millis() - lastHeartbeat > 15000) {
    heartbeat();
    pollCommand();
    lastHeartbeat = millis();
  }
}
