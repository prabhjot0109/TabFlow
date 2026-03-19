import { EXTENSION_PANEL } from "../../shared/panel";

type PanelDensity = "standard" | "compact";

function isListLikeLayout(grid: HTMLElement | null): boolean {
  if (!grid) return false;

  return (
    grid.classList.contains("list-view") ||
    grid.classList.contains("search-mode") ||
    grid.classList.contains("recent-mode")
  );
}

function getPanelDensity(
  grid: HTMLElement | null,
  itemCount: number,
  forceCompact = false,
): PanelDensity {
  if (forceCompact || itemCount <= 0) {
    return "compact";
  }

  if (isListLikeLayout(grid)) {
    return itemCount <= EXTENSION_PANEL.compactListItems
      ? "compact"
      : "standard";
  }

  return itemCount <= EXTENSION_PANEL.compactGridItems
    ? "compact"
    : "standard";
}

export function applyPanelStyleContract(
  overlay: HTMLElement | null,
  container: HTMLElement | null,
): void {
  if (overlay) {
    overlay.style.setProperty(
      "--tab-flow-panel-width",
      `${EXTENSION_PANEL.width}px`,
    );
    overlay.style.setProperty(
      "--tab-flow-panel-height",
      `${EXTENSION_PANEL.height}px`,
    );
    overlay.style.setProperty(
      "--tab-flow-panel-min-height",
      `${EXTENSION_PANEL.minHeight}px`,
    );
    overlay.style.setProperty(
      "--tab-flow-viewport-gap",
      `${EXTENSION_PANEL.viewportMargin}px`,
    );
  }

  if (container && !container.dataset.panelDensity) {
    container.dataset.panelDensity = "standard";
  }
}

export function syncPanelDensity(
  container: HTMLElement | null,
  grid: HTMLElement | null,
  itemCount: number,
  forceCompact = false,
): void {
  if (!container) return;

  container.dataset.panelDensity = getPanelDensity(
    grid,
    itemCount,
    forceCompact,
  );
}

export function applyPopupShellLayout(
  overlay: HTMLElement | null,
  container: HTMLElement | null,
): void {
  if (!overlay || !container) return;

  applyPanelStyleContract(overlay, container);
  overlay.classList.add("popup-shell");
  container.classList.add("popup-shell");
  container.dataset.panelDensity = "standard";
}
