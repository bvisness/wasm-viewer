import { E, WVNode, WVNodes } from "./components";

// Nested pane containers will always have the opposite direction of their
// parent. This avoids confusing problems with sizing.

export type PaneDirection = "horizontal" | "vertical";

export interface PaneContainer {
  direction: PaneDirection;
  panes: Pane[];
  el: HTMLElement;
}

export interface Pane {
  tabs: Tab[];
  active: Tab | undefined;
  el: HTMLElement;
}

export interface Tab {
  name: WVNode;
  content: HTMLElement;
  onClose: (() => void)[];
}

export function newTab(name: HTMLElement, opts: {
  content?: WVNodes;
  onClose?: () => void;
}): Tab {
  return {
    name: name,
    content: E("div", [], opts.content),
    onClose: opts.onClose ? [opts.onClose] : [],
  };
}

const tabClasses = ["pa2", "f--small", "br", "b--dimmer"];

function tabEl(tab: Tab) {
  return E("div", ["wv-tab", ...tabClasses], tab.name); // TODO: nice tabs with event listeners and close buttons and whatnot
}

function dummyTab() {
  return E("div", ["wv-tab-dummy", ...tabClasses], "dummy");
}

export function newPane(tabs: Tab[], size = 1): Pane {
  const tabEls = tabs.length === 0 ? [dummyTab()] : tabs.map(tab => tabEl(tab));
  const el = E("div", ["wv-pane"], [
    E("div", ["wv-tabs", "bg--toolbar", "bb", "b--dimmer", "shadow"], tabEls),
    E("div", ["wv-pane-content"], tabs.map(tab => tab.content)),
  ]);

  el.style.flexGrow = `${size}`;

  return {
    tabs: tabs,
    active: tabs.length > 0 ? tabs[0] : undefined,
    el: el,
  };
}

export function newPaneContainer(direction: PaneDirection, panes: Pane[]): PaneContainer {
  if (panes.length === 0) {
    throw new Error("cannot create pane container with no panes");
  }

  const directionClass = direction === "horizontal" ? "wv-horizontal" : "wv-vertical";

  return {
    direction: direction,
    panes: panes,
    el: E("div", ["wv-pane-container", directionClass], panes.map(pane => pane.el)),
  };
}

export function addTabToPane(tab: Tab, pane: Pane) {
  pane.tabs.push(tab);
  for (const dummy of pane.el.querySelectorAll(".wv-tab-dummy")) {
    dummy.remove();
  }
  pane.el.querySelector(".wv-tabs")?.appendChild(tabEl(tab));
  pane.el.querySelector(".wv-pane-content")?.appendChild(tab.content);
}

export function activateTab(pane: Pane, tab: Tab) {
  const tabIndex = pane.tabs.indexOf(tab);
  if (tabIndex === -1) {
    throw new Error("wrong pane for tab");
  }

  pane.active = tab;

  for (const [i, tabEl] of pane.el.querySelectorAll(".wv-tab").entries()) {
    tabEl.classList.toggle("active", i === tabIndex);
  }
  for (const paneTab of pane.tabs) {
    paneTab.content.style.display = paneTab === tab ? "block" : "none";
  }
}
