import {
  hasBroadHostAccess,
  requestBroadHostAccess,
  revokeBroadHostAccess,
} from "../shared/host-access";

type ViewMode = "grid" | "list";
type QualityTier = "PERFORMANCE" | "NORMAL" | "HIGH";

interface Settings {
  qualityTier: QualityTier;
  cacheMaxTabs: number;
  cacheMaxMB: number;
  tabFlowView: ViewMode;
  quickSwitchView: ViewMode;
}

const DEFAULTS: Settings = {
  qualityTier: "NORMAL",
  cacheMaxTabs: 100,
  cacheMaxMB: 50,
  tabFlowView: "grid",
  quickSwitchView: "grid",
};

const ELEMENTS = {
  qualityTier: document.getElementById("qualityTier") as HTMLSelectElement,
  cacheMaxTabs: document.getElementById("cacheMaxTabs") as HTMLInputElement,
  cacheMaxMB: document.getElementById("cacheMaxMB") as HTMLInputElement,
  tabFlowView: document.getElementById("tabFlowView") as HTMLSelectElement,
  quickSwitchView: document.getElementById(
    "quickSwitchView"
  ) as HTMLSelectElement,
  saveBtn: document.getElementById("saveBtn") as HTMLButtonElement,
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  hostAccess: document.getElementById("hostAccess") as HTMLInputElement,
  status: document.getElementById("status") as HTMLElement,
  configureShortcutsBtn: document.getElementById(
    "configureShortcutsBtn"
  ) as HTMLButtonElement,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function setStatus(message: string, isError = false) {
  ELEMENTS.status.textContent = message;
  ELEMENTS.status.style.color = isError ? "#ff5d5d" : "";
}

function readFormValues(): Settings {
  const cacheMaxTabs = clamp(
    Number.parseInt(ELEMENTS.cacheMaxTabs.value, 10) || DEFAULTS.cacheMaxTabs,
    20,
    300
  );
  const cacheMaxMB = clamp(
    Number.parseInt(ELEMENTS.cacheMaxMB.value, 10) || DEFAULTS.cacheMaxMB,
    10,
    200
  );

  return {
    qualityTier: ELEMENTS.qualityTier.value as QualityTier,
    cacheMaxTabs,
    cacheMaxMB,
    tabFlowView: ELEMENTS.tabFlowView.value as ViewMode,
    quickSwitchView: ELEMENTS.quickSwitchView.value as ViewMode,
  };
}

function writeFormValues(settings: Settings) {
  ELEMENTS.qualityTier.value = settings.qualityTier;
  ELEMENTS.cacheMaxTabs.value = String(settings.cacheMaxTabs);
  ELEMENTS.cacheMaxMB.value = String(settings.cacheMaxMB);
  ELEMENTS.tabFlowView.value = settings.tabFlowView;
  ELEMENTS.quickSwitchView.value = settings.quickSwitchView;
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get([
    "qualityTier",
    "cacheMaxTabs",
    "cacheMaxMB",
    "TabFlowViewMode",
    "QuickSwitchViewMode",
  ]);

  return {
    qualityTier: (result.qualityTier as QualityTier) || DEFAULTS.qualityTier,
    cacheMaxTabs:
      typeof result.cacheMaxTabs === "number"
        ? result.cacheMaxTabs
        : DEFAULTS.cacheMaxTabs,
    cacheMaxMB:
      typeof result.cacheMaxMB === "number"
        ? result.cacheMaxMB
        : DEFAULTS.cacheMaxMB,
    tabFlowView:
      (result.TabFlowViewMode as ViewMode) || DEFAULTS.tabFlowView,
    quickSwitchView:
      (result.QuickSwitchViewMode as ViewMode) || DEFAULTS.quickSwitchView,
  };
}

async function saveSettings(settings: Settings) {
  await chrome.storage.local.set({
    qualityTier: settings.qualityTier,
    cacheMaxTabs: settings.cacheMaxTabs,
    cacheMaxMB: settings.cacheMaxMB,
    TabFlowViewMode: settings.tabFlowView,
    QuickSwitchViewMode: settings.quickSwitchView,
  });

  chrome.runtime.sendMessage({
    action: "setQualityTier",
    tier: settings.qualityTier,
  });

  chrome.runtime.sendMessage({
    action: "updateCacheSettings",
    maxTabs: settings.cacheMaxTabs,
    maxMB: settings.cacheMaxMB,
  });
}

async function handleSave() {
  try {
    const settings = readFormValues();
    writeFormValues(settings);
    await saveSettings(settings);
    setStatus("Settings saved.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save settings.";
    setStatus(message, true);
  }
}

async function handleReset() {
  try {
    writeFormValues(DEFAULTS);
    await saveSettings(DEFAULTS);
    setStatus("Defaults restored.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset settings.";
    setStatus(message, true);
  }
}

async function displayShortcuts() {
  if (typeof chrome !== "undefined" && chrome.commands) {
    try {
      const commands = await chrome.commands.getAll();
      const listContainer = document.getElementById("shortcutsList");
      if (listContainer && commands && commands.length > 0) {
        listContainer.innerHTML = "";
        for (const cmd of commands) {
          if (!cmd.name) continue;

          const item = document.createElement("div");
          item.className = "shortcut-item";

          const desc = document.createElement("span");
          desc.className = "shortcut-desc";
          desc.textContent = cmd.description || cmd.name;

          const key = document.createElement("kbd");
          key.className = "shortcut-key";
          key.textContent = cmd.shortcut || "Not set";

          item.appendChild(desc);
          item.appendChild(key);
          listContainer.appendChild(item);
        }
      }
    } catch (error) {
      console.warn("Failed to get commands:", error);
    }
  }
}

// Host access is a permission, not a stored setting — it is applied the moment
// the box is toggled rather than on Save, because chrome.permissions.request
// must run inside the user gesture that triggered it.
function handleHostAccessToggle() {
  const wantsAccess = ELEMENTS.hostAccess.checked;
  const apply = wantsAccess ? requestBroadHostAccess() : revokeBroadHostAccess();

  apply
    .then(async (succeeded) => {
      // The user can dismiss Chrome's prompt, so trust the permission itself
      // rather than the checkbox we just read.
      const granted = await hasBroadHostAccess();
      ELEMENTS.hostAccess.checked = granted;

      if (granted) {
        setStatus("Full previews and media control enabled.");
      } else if (wantsAccess && !succeeded) {
        setStatus("Site access was declined. Tab Flow will keep working with previews for the current tab only.");
      } else {
        setStatus("Site access removed.");
      }
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to update site access.";
      setStatus(message, true);
    });
}

async function initialize() {
  const settings = await loadSettings();
  writeFormValues(settings);
  ELEMENTS.hostAccess.checked = await hasBroadHostAccess();
  ELEMENTS.hostAccess.addEventListener("change", handleHostAccessToggle);
  ELEMENTS.saveBtn.addEventListener("click", handleSave);
  ELEMENTS.resetBtn.addEventListener("click", handleReset);
  ELEMENTS.configureShortcutsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
  displayShortcuts().catch(console.error);
}

initialize().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(message, true);
});

export {};
