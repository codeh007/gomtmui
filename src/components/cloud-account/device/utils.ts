import { randomUUID } from "mtxuilib/lib/utils";

export const generateNewFingerprint = () => {
  return {
    machine_id: randomUUID(),
    mac_machine_id: randomUUID(),
    dev_device_id: randomUUID(),
    os: "linux",
    browser: "chrome",
    created_at: Math.floor(Date.now() / 1000),
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
};
