export const EXTENSION_PANEL = Object.freeze({
  width: 700,
  height: 500,
  popupWidth: 800,
  popupHeight: 560,
  minHeight: 220,
  viewportMargin: 20,
  compactGridItems: 3,
  compactListItems: 1,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getCenteredPopupBounds(currentWindow: chrome.windows.Window): {
  width: number;
  height: number;
  left: number;
  top: number;
} {
  const width = EXTENSION_PANEL.popupWidth;
  const height = EXTENSION_PANEL.popupHeight;

  const windowWidth = currentWindow.width ?? width;
  const windowHeight = currentWindow.height ?? height;
  const windowLeft = currentWindow.left ?? 100;
  const windowTop = currentWindow.top ?? 100;

  const centeredLeft = Math.round(windowLeft + (windowWidth - width) / 2);
  const centeredTop = Math.round(windowTop + (windowHeight - height) / 2);

  return {
    width,
    height,
    left: clamp(
      centeredLeft,
      windowLeft,
      windowLeft + Math.max(windowWidth - width, 0),
    ),
    top: clamp(
      centeredTop,
      windowTop,
      windowTop + Math.max(windowHeight - height, 0),
    ),
  };
}
