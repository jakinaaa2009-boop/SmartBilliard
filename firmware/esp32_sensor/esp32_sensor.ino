/*
  Smart Billiard ESP32 #2 — Ball return sensor
  Sends detected ball count to ESP32 #1 via ESP-NOW.
  Optionally can POST directly to the backend if Wi-Fi is available.
*/

#include <esp_now.h>
#include <WiFi.h>

typedef struct {
  uint8_t ballCount;
  uint8_t expected;
} SensorPacket;

uint8_t mainControllerMac[] = {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0xCC};

void onSent(const uint8_t *mac, esp_now_send_status_t status) {
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "sent" : "fail");
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) return;
  esp_now_register_send_cb(onSent);
  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, mainControllerMac, 6);
  peer.channel = 0;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

int readBallCount() {
  // Replace with IR / weight / limit-switch matrix reading.
  return 8;
}

void loop() {
  SensorPacket packet;
  packet.ballCount = readBallCount();
  packet.expected = 8;
  esp_now_send(mainControllerMac, (uint8_t *)&packet, sizeof(packet));
  delay(1000);
}
