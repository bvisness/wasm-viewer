/*
The goto system stores many possibly overlapping entries each with their own
byte range. The actual structure of a wasm file is a tree, so there is a notion
of depth we can use to sort goto queries from most to least specific, to make
an offset lookup more pleasant.
*/

import { sections } from "./elements";
import { assertUnreachable } from "./util";

export type GotoEntry =
  GotoSection
  | GotoType
  | GotoImport
  | GotoFunction
  | GotoTable
  | GotoMemory
  | GotoGlobal
  | GotoCode;

export type GotoKind = GotoEntry["kind"];

export interface GotoSection {
  kind: "section";
  index: number;
}

export interface GotoType {
  kind: "type";
  index: number;
}

export interface GotoImport {
  kind: "import";
  namespace: string;
  name: string;
}

export interface GotoFunction {
  kind: "function";
  index: number;
}

export interface GotoTable {
  kind: "table";
  index: number;
}

export interface GotoMemory {
  kind: "memory";
  index: number;
}

export interface GotoGlobal {
  kind: "global";
  index: number;
}

export interface GotoCode {
  kind: "code";
  index: number;
}

export type GotoBinary = GotoEntry & {
  depth: number;
  offset: number;
  length: number;
};

/*
For now I am doing the dumbest possible thing and just storing items in a flat
list. I should still be able to stop iteration early when I start seeing
entries who begin after the desired offset. If this is too slow for larger
modules, I can switch it to use a tree or turn this whole thing into a skip
list or something.
*/

const gotos: GotoBinary[] = [];

// @ts-expect-error I am not allowed to debug my own code 🤡
window.gotos = gotos;

export function clearGotos() {
  gotos.splice(0);
}

export function addGoto(entry: GotoBinary) {
  // TODO: dumb airplane code because no docs, sad sorted insert bad time
  gotos.push(entry);
  gotos.sort((a, b) => a.offset - b.offset);
}

export function lookUpGoto(offset: number): GotoBinary[] {
  const res: GotoBinary[] = [];
  for (const entry of gotos) {
    if (entry.offset <= offset && offset < entry.offset + entry.length) {
      res.push(entry);
    }
    if (offset <= entry.offset + length) {
      break;
    }
  }
  res.sort((a, b) => b.depth - a.depth); // reverse sort by depth (most specific first)
  return res;
}

export function goto(entry: GotoEntry) {
  document.querySelector(".goto-current")?.classList.remove("goto-current");

  const kind = entry.kind;
  switch (kind) {
    case "section": {
      const sectionEl = sections.querySelector(`.section[data-index="${entry.index}"]`)!;
      sectionEl.classList.add("open", "goto-current");
      sectionEl.scrollIntoView({ behavior: "smooth" });
    } break;
    case "type": {
      const sectionEl = sections.querySelector(".section.section-type")!;
      sectionEl.classList.add("open");

      const typeEl = sectionEl.querySelector(`.item-type[data-index="${entry.index}"]`)!;
      typeEl.classList.add("goto-current");
      typeEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    case "import": {
      const sectionEl = sections.querySelector(".section.section-import")!;
      sectionEl.classList.add("open");

      const namespaceEl = sectionEl.querySelector(`[data-import-namespace="${entry.namespace}"]`)!;
      namespaceEl.classList.add("open");

      const importEl = sectionEl.querySelector(`[data-import-name="${entry.name}"]`)!;
      importEl.classList.add("goto-current");
      importEl.scrollIntoView({ behavior: "smooth" });
    } break;
    case "function": {
      const sectionEl = sections.querySelector(".section.section-function")!;
      sectionEl.classList.add("open");

      const functionEl = sectionEl.querySelector(`.item-function[data-index="${entry.index}"]`)!;
      functionEl.classList.add("goto-current");
      functionEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    case "table": {
      const sectionEl = sections.querySelector(".section.section-table")!;
      sectionEl.classList.add("open");

      const tableEl = sectionEl.querySelector(`.item-table[data-index="${entry.index}"]`)!;
      tableEl.classList.add("goto-current");
      tableEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    case "memory": {
      const sectionEl = sections.querySelector(".section.section-memory")!;
      sectionEl.classList.add("open");

      const memoryEl = sectionEl.querySelector(`.item-memory[data-index="${entry.index}"]`)!;
      memoryEl.classList.add("goto-current");
      memoryEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    case "global": {
      const sectionEl = sections.querySelector(".section.section-global")!;
      sectionEl.classList.add("open");

      const globalEl = sectionEl.querySelector(`.item-global[data-index="${entry.index}"]`)!;
      globalEl.classList.add("goto-current");
      globalEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    case "code": {
      const sectionEl = sections.querySelector(".section.section-code")!;
      sectionEl.classList.add("open");

      const codeEl = sectionEl.querySelector(`.item-code[data-index="${entry.index}"]`)!;
      codeEl.classList.add("goto-current");
      codeEl.querySelector(".scroll-padder")!.scrollIntoView({ behavior: "smooth" });
    } break;
    default:
      assertUnreachable(kind);
  }
}
