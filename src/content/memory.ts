type ReleasableTabPayloadState = {
  currentTabs: unknown[];
  activeTabs: unknown[];
  filteredTabs: unknown[];
  quickSwitchTabs: unknown[];
  recentItems: unknown[];
  groups: unknown[];
  selectedIndex: number;
  history: {
    active: boolean;
    backEls: unknown[];
    forwardEls: unknown[];
    column: "back" | "forward";
    index: number;
  };
  webSearch: {
    active: boolean;
  };
};

export function releaseTabPayloadState(state: ReleasableTabPayloadState): void {
  state.currentTabs = [];
  state.activeTabs = [];
  state.filteredTabs = [];
  state.quickSwitchTabs = [];
  state.recentItems = [];
  state.groups = [];
  state.selectedIndex = 0;

  state.history.active = false;
  state.history.backEls = [];
  state.history.forwardEls = [];
  state.history.column = "back";
  state.history.index = 0;

  state.webSearch.active = false;
}
