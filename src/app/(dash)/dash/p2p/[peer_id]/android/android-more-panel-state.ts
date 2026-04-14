export type AndroidMorePanelSurface = "sessionInfo" | "textComposer" | null;

export function resolveMorePanelSurfaceState(
  current: AndroidMorePanelSurface,
  surface: Exclude<AndroidMorePanelSurface, null>,
  nextOpen: boolean,
): AndroidMorePanelSurface {
  if (nextOpen) {
    return surface;
  }
  return current === surface ? null : current;
}
