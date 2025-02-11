import { networkInterfaces } from "os";

export function getLanIP(): string {
  const nets = networkInterfaces();
  let lanIP = "";
  const en0 = nets["en0"];
  if (en0) {
    for (const net of en0) {
      if (net.family === "IPv4" && !net.internal) {
        lanIP = net.address;
        break;
      }
    }
  }
  return lanIP;
}
