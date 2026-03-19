import { ensureShadowRoot } from "../content/ui/overlay";
import { applyPopupShellLayout } from "../content/ui/panel-layout";

type CycleActionConfig = {
  action: string;
  onCycle: () => void;
};

type ProtectedPopupConfig<TPayload> = {
  storageKey: string;
  errorLabel: string;
  overlayId: string;
  containerSelector: string;
  parseStored: (stored: unknown) => TPayload | null;
  fallbackLoader: () => Promise<TPayload | null>;
  isEmpty: (payload: TPayload) => boolean;
  setupLifecycle: (closePopup: () => void) => void;
  render: (payload: TPayload) => void | Promise<void>;
  cycleAction?: CycleActionConfig;
};

export function closePopupWindowSoon(): void {
  setTimeout(() => {
    try {
      window.close();
    } catch {
      // Ignore close errors.
    }
  }, 0);
}

export function getActiveTabId<T extends { active?: boolean; id?: number | null }>(
  tabs: T[],
): number | null {
  const activeTab = tabs.find((tab) => tab.active && typeof tab.id === "number");
  return typeof activeTab?.id === "number" ? activeTab.id : null;
}

function setupPopupCycleListener(config: CycleActionConfig): void {
  if (!chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === config.action) {
      config.onCycle();
      sendResponse?.({ success: true });
      return true;
    }
    return false;
  });
}

function applyProtectedPopupShell(
  overlayId: string,
  containerSelector: string,
): void {
  const shadowRoot = ensureShadowRoot();
  if (!shadowRoot) return;

  const overlay = shadowRoot.getElementById(overlayId) as HTMLElement | null;
  const container = shadowRoot.querySelector(
    containerSelector,
  ) as HTMLElement | null;

  applyPopupShellLayout(overlay, container);
}

async function loadProtectedPopupPayload<TPayload>(
  config: Pick<
    ProtectedPopupConfig<TPayload>,
    "storageKey" | "errorLabel" | "parseStored" | "fallbackLoader"
  >,
): Promise<TPayload | null> {
  try {
    const result = await chrome.storage.session.get([config.storageKey]);
    const payload = config.parseStored(
      (result as Record<string, unknown>)[config.storageKey],
    );
    if (payload) {
      return payload;
    }
  } catch (error) {
    console.error(`${config.errorLabel} Failed to load session tab data:`, error);
  }

  return config.fallbackLoader();
}

export async function initializeProtectedPopup<TPayload>(
  config: ProtectedPopupConfig<TPayload>,
): Promise<void> {
  const payload = await loadProtectedPopupPayload(config);
  if (!payload || config.isEmpty(payload)) {
    closePopupWindowSoon();
    return;
  }

  if (config.cycleAction) {
    setupPopupCycleListener(config.cycleAction);
  }

  config.setupLifecycle(closePopupWindowSoon);
  await config.render(payload);
  applyProtectedPopupShell(config.overlayId, config.containerSelector);
}
