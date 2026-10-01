/*
  Smart Billiard sender ESP32
  - WiFiManager portal: Billiard-Setup / 12345678
  - On boot, enrolls with the server and shows up in Admin → Төхөөрөмжүүд
  - Heartbeat every 15s (uptime, IP, RSSI, door state)
  - Polls door commands and forwards them over ESP-NOW
  - GPIO 27 button still toggles the receiver relay

  Libraries: WiFiManager, ArduinoJson 7
  Flash this board, then flash firmware/esp32_receiver on the relay board.
*/

#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <Preferences.h>
#include <ArduinoJson.h>

const char* API_BASE = "https://smart-billiard.vercel.app";
const char* DEVICE_ID = "billiard_01";
const char* DEVICE_NAME = "Billiard 01";
// Paste a rotated admin secret here only if NVS was erased. Otherwise leave empty.
const char* DEVICE_SECRET_OVERRIDE = "";

#define BUTTON_PIN 27

uint8_t receiverAddress[] = {0x58, 0x2A, 0xBD, 0xD8, 0x9C, 0x00};

typedef struct __attribute__((packed)) {
  uint8_t command;  // 1 toggle, 2 open, 3 close
} RadioMessage;

RadioMessage radioMsg;
esp_now_peer_info_t peerInfo;
Preferences prefs;
String deviceSecret;
bool doorOpen = false;
SemaphoreHandle_t radioMutex;
QueueHandle_t apiQueue;

struct APIEvent {
  int eventType;
  int value;
};

void saveSecret(const String& secret) {
  deviceSecret = secret;
  prefs.begin("smartbilliard", false);
  prefs.putString("secret", secret);
  prefs.end();
  Serial.println("[AUTH] Secret stored");
}

void loadSecret() {
  if (strlen(DEVICE_SECRET_OVERRIDE) > 0) {
    deviceSecret = DEVICE_SECRET_OVERRIDE;
    return;
  }
  prefs.begin("smartbilliard", true);
  deviceSecret = prefs.getString("secret", "");
  prefs.end();
}

void OnDataSent(const uint8_t* mac, esp_now_send_status_t status) {
  Serial.print("[ESP-NOW] Delivery: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}

void sendRadio(uint8_t command) {
  if (!radioMutex || xSemaphoreTake(radioMutex, pdMS_TO_TICKS(200)) != pdTRUE) return;
  radioMsg.command = command;
  esp_err_t result = esp_now_send(receiverAddress, (uint8_t*)&radioMsg, sizeof(radioMsg));
  xSemaphoreGive(radioMutex);
  if (result == ESP_OK) Serial.printf("[ESP-NOW] command %u queued\n", command);
  else Serial.printf("[ESP-NOW] send error %d\n", result);
}

bool postJson(const String& path, const String& body, String& response, bool auth) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(client, String(API_BASE) + path)) {
    Serial.println("[API] begin failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  if (auth && deviceSecret.length()) {
    http.addHeader("Authorization", String("Bearer ") + deviceSecret);
  }
  int code = http.POST(body);
  response = http.getString();
  http.end();
  Serial.printf("[API] POST %s -> %d\n", path.c_str(), code);
  if (code == 401) {
    Serial.println("[API] Unauthorized. Admin → device → Нууц шинэчлэх, then paste into DEVICE_SECRET_OVERRIDE");
  }
  return code >= 200 && code < 300;
}

void handleApiJson(const String& response) {
  JsonDocument doc;
  if (deserializeJson(doc, response)) return;
  const char* secret = doc["secret"];
  if (secret && strlen(secret) > 0) saveSecret(secret);

  JsonVariant cmd = doc["command"];
  if (cmd.isNull()) return;
  const char* commandId = cmd["commandId"];
  const char* command = cmd["command"];
  if (!commandId || !command) return;

  bool ok = true;
  if (strcmp(command, "OPEN_BOX") == 0) {
    doorOpen = true;
    sendRadio(2);
  } else if (strcmp(command, "CLOSE_BOX") == 0 || strcmp(command, "RESET") == 0) {
    doorOpen = false;
    sendRadio(3);
  } else if (strcmp(command, "START_ALARM") == 0 || strcmp(command, "STOP_ALARM") == 0) {
    ok = true;
  } else {
    ok = false;
  }

  String resultBody = String("{\"commandId\":\"") + commandId + "\",\"success\":" + (ok ? "true" : "false") + "}";
  String ignored;
  String resultPath = String("/api/iot/devices/") + DEVICE_ID + "/command-result";
  postJson(resultPath, resultBody, ignored, true);
}

void enroll() {
  if (deviceSecret.length()) return;
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"name\":\"" + String(DEVICE_NAME) + "\",";
  body += "\"firmwareVersion\":\"1.1.0\",";
  body += "\"uptime\":" + String(millis() / 1000) + ",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\"";
  body += "}";
  String response;
  if (postJson("/api/iot/announce", body, response, false)) {
    handleApiJson(response);
    Serial.println("[AUTH] Enrolled. Device should appear in the admin panel.");
  } else {
    Serial.println(response);
  }
}

void heartbeat() {
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"name\":\"" + String(DEVICE_NAME) + "\",";
  body += "\"firmwareVersion\":\"1.1.0\",";
  body += "\"uptime\":" + String(millis() / 1000) + ",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  body += "\"boxStatus\":\"" + String(doorOpen ? "UNLOCKED" : "LOCKED") + "\"";
  body += "}";
  String response;
  if (postJson("/api/iot/announce", body, response, true)) handleApiJson(response);
}

void reportButton() {
  String body = "{\"device\":\"" + String(DEVICE_ID) + "\",\"action\":\"button_pressed\",\"eventType\":1,\"value\":1}";
  String response;
  if (postJson("/api/button", body, response, true)) handleApiJson(response);
}

void ButtonTask(void* parameter) {
  bool last = HIGH;
  unsigned long lastPress = 0;
  while (true) {
    bool state = digitalRead(BUTTON_PIN);
    if (last == HIGH && state == LOW && millis() - lastPress > 200) {
      lastPress = millis();
      doorOpen = !doorOpen;
      Serial.println(doorOpen ? "[BUTTON] OPEN" : "[BUTTON] CLOSE");
      sendRadio(1);
      APIEvent event{1, 1};
      xQueueSend(apiQueue, &event, 0);
    }
    last = state;
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void APITask(void* parameter) {
  enroll();
  unsigned long lastBeat = 0;
  APIEvent event;
  while (true) {
    if (xQueueReceive(apiQueue, &event, pdMS_TO_TICKS(250)) == pdTRUE) {
      reportButton();
    }
    if (deviceSecret.length() && millis() - lastBeat > 1000) {
      heartbeat();
      lastBeat = millis();
    }
  }
}

void WiFiTask(void* parameter) {
  while (true) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Reconnecting...");
      WiFi.reconnect();
    } else {
      Serial.printf("[WIFI] %s RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
    vTaskDelay(pdMS_TO_TICKS(10000));
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  loadSecret();

  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("Billiard-Setup", "12345678")) {
    Serial.println("[WIFI] No Wi-Fi. ESP-NOW still starts.");
  } else {
    Serial.print("[WIFI] Connected ");
    Serial.println(WiFi.localIP());
  }
  Serial.print("[SYSTEM] MAC ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] init failed");
    return;
  }
  esp_now_register_send_cb(OnDataSent);
  memset(&peerInfo, 0, sizeof(peerInfo));
  memcpy(peerInfo.peer_addr, receiverAddress, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("[ESP-NOW] peer failed");
    return;
  }

  radioMutex = xSemaphoreCreateMutex();
  apiQueue = xQueueCreate(10, sizeof(APIEvent));
  xTaskCreatePinnedToCore(ButtonTask, "ButtonTask", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(APITask, "APITask", 16384, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(WiFiTask, "WiFiTask", 4096, NULL, 1, NULL, 0);
  Serial.println("[SYSTEM] Ready");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
