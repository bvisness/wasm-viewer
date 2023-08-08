function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`no element exists with id '${id}'`);
  }
  return element;
}

export const filePicker = el("file-picker") as HTMLInputElement & { files: FileList };
export const doButton = el("doeet");
export const sections = el("sections");
export const panes = el("panes");
export const gotoContainer = el("goto");
export const gotoBackground = el("goto-background");
export const gotoDialog = el("goto-dialog");
export const gotoInput = el("goto-input") as HTMLInputElement;
export const gotoHint = el("goto-hint");
export const gotoResults = el("goto-results");
