export function runAfterClosingMorePanel(action: () => void, setPanelOpen: (open: boolean) => void) {
  setPanelOpen(false);
  action();
}
