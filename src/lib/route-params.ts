export function getSingleRouteParam(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}
