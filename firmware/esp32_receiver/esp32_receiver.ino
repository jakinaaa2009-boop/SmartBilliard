/*
  Relay board. Listens for the sender over ESP-NOW.
  command 1 = toggle, 2 = open, 3 = close
  Relay GPIO 26. Change RELAY_PIN if your lock uses another pin.
  Print this board's MAC and put it in the sender's receiverAddress.
*/

#include <WiFi.h>
#include <esp_now.h>

#define RELAY_PIN 26

typedef struct __attribute__((packed)) {
  uint8_t command;
} RadioMessage;

bool doorOpen = false;

void setDoor(bool open) {
  doorOpen = open;
  digitalWrite(RELAY_PIN, open ? HIGH : LOW);
  Serial.println(open ? "[RELAY] OPEN" : "[RELAY] CLOSED");
}

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
void onReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
#else
void onReceive(const uint8_t* mac, const uint8_t* data, int len) {
#endif
  if (len < (int)sizeof(RadioMessage)) return;
  RadioMessage msg;
  memcpy(&msg, data, sizeof(msg));
  if (msg.command == 2) setDoor(true);
  else if (msg.command == 3) setDoor(false);
  else if (msg.command == 1) setDoor(!doorOpen);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  WiFi.mode(WIFI_STA);
  Serial.print("Receiver MAC: ");
  Serial.println(WiFi.macAddress());
  if (esp_now_init() != ESP_OK) return;
  esp_now_register_recv_cb(onReceive);
}

void loop() {
  delay(1000);
}
