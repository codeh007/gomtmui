type ManagedLinuxStartupCommandInput = {
  configUrl: string;
  bootstrapCredential: string;
  deviceNameExpression: string;
};

function escapeDoubleQuotedShellValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("$", "\\$")
    .replaceAll("`", "\\`")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

function formatDeviceNameValue(deviceNameExpression: string) {
  if (deviceNameExpression === "$(hostname)") {
    return deviceNameExpression;
  }

  return escapeDoubleQuotedShellValue(deviceNameExpression);
}

export function buildManagedLinuxStartupCommand(input: ManagedLinuxStartupCommandInput) {
  return [
    "gomtm server",
    `--config="${escapeDoubleQuotedShellValue(input.configUrl)}"`,
    `--bootstrap-credential="${escapeDoubleQuotedShellValue(input.bootstrapCredential)}"`,
    `--device-name="${formatDeviceNameValue(input.deviceNameExpression)}"`,
  ].join(" ");
}
