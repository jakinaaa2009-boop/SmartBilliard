import { Device } from "@/models/Device";
import { Table } from "@/models/Table";

export async function ensureDeviceReady(deviceId: string) {
  const id = deviceId.trim().toUpperCase();
  const device = await Device.findOne({ deviceId: id });
  if (!device) return null;

  if (device.tableId) {
    const linked = await Table.findById(device.tableId);
    if (linked) return device;
  }

  let table = await Table.findOne({ deviceId: id });
  if (!table) {
    const used = await Table.find().select("number").lean();
    const numbers = new Set(used.map((row) => row.number));
    let number = 1;
    while (numbers.has(number)) number += 1;
    table = await Table.create({
      number,
      name: device.name || `Ширээ №${number}`,
      deviceId: id,
      expectedBallCount: device.expectedBallCount || 8,
      status: "AVAILABLE",
      enabled: true,
    });
  }

  device.tableId = table._id;
  table.deviceId = id;
  if (!device.expectedBallCount) device.expectedBallCount = 8;
  await table.save();
  await device.save();
  return device;
}
