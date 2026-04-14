export function stringifyDirectPayload(value: unknown) {
  if (value == null) {
    return "尚无结果";
  }
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
