export function getVncReconnectDelayMs(attempt: number) {
  if (attempt <= 1) {
    return 1000;
  }
  if (attempt === 2) {
    return 2000;
  }
  return 5000;
}
