/*
  Smart Billiard sender
  BUTTON GPIO 27, IR TX GPIO 26, IR RX GPIO 25
  IR: 38 kHz, 600 us on, 600 us off, 10 bursts
  Server commands:
    OPEN_BOX / CLOSE_BOX
    START_BALL_COUNT or TIME_EXPIRED  -> IR on, count reset
    START_ALARM                       -> IR stays on, count kept
    STOP_BALL_COUNT / STOP_ALARM      -> IR off
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
const char* DEVICE_SECRET_OVERRIDE = "";

#define BUTTON_PIN 27
#define IR_TX 26
#define IR_RX 25

uint8_t receiverAddress[] = {0x58, 0x2A, 0xBD, 0xD8, 0x9C, 0x00};

typedef struct __attribute__((packed)) {
  uint8_t command;  // 1 toggle, 2 open, 3 close
} RadioMessage;

RadioMessage radioMsg;
esp_now_peer_info_t peerInfo;
Preferences prefs;
String deviceSecret;
volatile bool doorOpen = false;
volatile bool ballCounterActive = false;
volatile uint32_t ballCount = 0;
SemaphoreHandle_t radioMutex;
QueueHandle_t apiQueue;

struct APIEvent {
  int eventType;  // 1 button, 2 ball
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
  Serial.printf("[ESP-NOW] Delivery: %s\n", status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}

void sendRadio(uint8_t command) {
  if (!radioMutex || xSemaphoreTake(radioMutex, pdMS_TO_TICKS(200)) != pdTRUE) return;
  radioMsg.command = command;
  esp_err_t result = esp_now_send(receiverAddress, (uint8_t*)&radioMsg, sizeof(radioMsg));
  xSemaphoreGive(radioMutex);
  if (result == ESP_OK) Serial.printf("[ESP-NOW] command %u queued\n", command);
  else Serial.printf("[ESP-NOW] send error %d\n", result);
}

void startBallCounter(bool resetCounter) {
  if (resetCounter) ballCount = 0;
  ballCounterActive = true;
  Serial.printf("[IR] BALL COUNTER STARTED count=%u\n", (unsigned)ballCount);
}

void stopBallCounter(bool resetCounter) {
  ballCounterActive = false;
  ledcWrite(IR_TX, 0);
  if (resetCounter) ballCount = 0;
  Serial.printf("[IR] BALL COUNTER STOPPED count=%u\n", (unsigned)ballCount);
}

bool readBeamBlocked() {
  bool irDetected = false;
  for (int j = 0; j < 10; j++) {
    ledcWrite(IR_TX, 128);
    delayMicroseconds(600);
    if (digitalRead(IR_RX) == LOW) irDetected = true;
    ledcWrite(IR_TX, 0);
    delayMicroseconds(600);
  }
  return irDetected;
}

bool postJson(const String& path, const String& body, String& response, bool auth) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(client, String(API_BASE) + path)) return false;
  http.addHeader("Content-Type", "application/json");
  if (auth && deviceSecret.length()) http.addHeader("Authorization", String("Bearer ") + deviceSecret);
  int code = http.POST(body);
  response = http.getString();
  http.end();
  Serial.printf("[API] POST %s -> %d\n", path.c_str(), code);
  if (code == 401) Serial.println("[API] Unauthorized");
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
    stopBallCounter(true);
    Serial.println("[COMMAND] OPEN BOX");
  } else if (strcmp(command, "CLOSE_BOX") == 0) {
    doorOpen = false;
    sendRadio(3);
    Serial.println("[COMMAND] CLOSE BOX");
  } else if (strcmp(command, "START_BALL_COUNT") == 0 || strcmp(command, "TIME_EXPIRED") == 0) {
    startBallCounter(true);
    Serial.println("[COMMAND] TIMER FINISHED");
  } else if (strcmp(command, "START_ALARM") == 0) {
    startBallCounter(false);
    Serial.println("[COMMAND] ALARM, count kept");
  } else if (strcmp(command, "STOP_BALL_COUNT") == 0 || strcmp(command, "STOP_ALARM") == 0) {
    stopBallCounter(false);
  } else if (strcmp(command, "RESET_BALL_COUNT") == 0) {
    ballCount = 0;
  } else if (strcmp(command, "RESET") == 0) {
    doorOpen = false;
    sendRadio(3);
    stopBallCounter(true);
  } else {
    ok = false;
  }

  String resultBody = String("{\"commandId\":\"") + commandId + "\",\"success\":" + (ok ? "true" : "false") + "}";
  String ignored;
  postJson(String("/api/iot/devices/") + DEVICE_ID + "/command-result", resultBody, ignored, true);
}

void enroll() {
  if (deviceSecret.length()) return;
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"name\":\"" + String(DEVICE_NAME) + "\",";
  body += "\"firmwareVersion\":\"1.2.0\",";
  body += "\"uptime\":" + String(millis() / 1000) + ",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\"";
  body += "}";
  String response;
  if (postJson("/api/iot/announce", body, response, false)) {
    handleApiJson(response);
    Serial.println("[AUTH] Enrolled");
  } else {
    Serial.println(response);
  }
}

void heartbeat() {
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"name\":\"" + String(DEVICE_NAME) + "\",";
  body += "\"firmwareVersion\":\"1.2.0\",";
  body += "\"uptime\":" + String(millis() / 1000) + ",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  body += "\"boxStatus\":\"" + String(doorOpen ? "UNLOCKED" : "LOCKED") + "\",";
  body += "\"ballCounterActive\":" + String(ballCounterActive ? "true" : "false") + ",";
  body += "\"ballCount\":" + String((uint32_t)ballCount);
  body += "}";
  String response;
  if (postJson("/api/iot/announce", body, response, true)) handleApiJson(response);
}

void reportButton() {
  String body = "{\"device\":\"" + String(DEVICE_ID) + "\",\"action\":\"button_pressed\",\"eventType\":1,\"value\":1}";
  String response;
  if (postJson("/api/button", body, response, true)) handleApiJson(response);
}

void reportBall(int count) {
  String body = "{\"device\":\"" + String(DEVICE_ID) + "\",\"action\":\"ball_detected\",\"eventType\":2,\"value\":" + String(count) + "}";
  String response;
  postJson("/api/button", body, response, true);
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

void BeamTask(void* parameter) {
  bool armed = true;
  int clearSamples = 0;
  unsigned long lastBallTime = 0;
  while (true) {
    if (!ballCounterActive) {
      ledcWrite(IR_TX, 0);
      armed = true;
      clearSamples = 0;
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
    bool blocked = readBeamBlocked();
    if (blocked) {
      clearSamples = 0;
      if (armed && millis() - lastBallTime > 70) {
        lastBallTime = millis();
        ballCount++;
        armed = false;
        Serial.printf("[BALL] DETECTED -> %u\n", (unsigned)ballCount);
        APIEvent event{2, (int)ballCount};
        xQueueSend(apiQueue, &event, 0);
      }
    } else if (!armed) {
      clearSamples++;
      if (clearSamples >= 3) {
        armed = true;
        clearSamples = 0;
        Serial.println("[IR] READY FOR NEXT BALL");
      }
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

void APITask(void* parameter) {
  enroll();
  unsigned long lastBeat = 0;
  APIEvent event;
  while (true) {
    if (xQueueReceive(apiQueue, &event, pdMS_TO_TICKS(300)) == pdTRUE) {
      if (event.eventType == 1) reportButton();
      else if (event.eventType == 2) reportBall(event.value);
    }
    if (deviceSecret.length() && millis() - lastBeat > 2000) {
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
  pinMode(IR_RX, INPUT_PULLUP);
  ledcAttach(IR_TX, 38000, 8);
  ledcWrite(IR_TX, 0);
  loadSecret();

  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  if (!wm.autoConnect("Billiard-Setup", "12345678")) {
    Serial.println("[WIFI] No Wi-Fi. ESP-NOW still starts.");
  } else {
    Serial.print("[WIFI] Connected: ");
    Serial.println(WiFi.localIP());
  }
  Serial.print("[SYSTEM] MAC: ");
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
  apiQueue = xQueueCreate(20, sizeof(APIEvent));
  xTaskCreatePinnedToCore(ButtonTask, "ButtonTask", 4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(BeamTask, "BeamTask", 4096, NULL, 4, NULL, 1);
  xTaskCreatePinnedToCore(APITask, "APITask", 16384, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(WiFiTask, "WiFiTask", 4096, NULL, 1, NULL, 0);
  Serial.println("[SYSTEM] READY");
  Serial.println("[IR] Waiting for website timer...");
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
