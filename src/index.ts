import { parse } from "./parse";
import wasmUrl from "../wasm-tools/pkg/wasm_viewer_bg.wasm";
import wasmInit, { BinaryError, Export, Import, IndirectNamingResultArray, Name } from "../wasm-tools/pkg";
import { Module, Section, WASM_PAGE_SIZE, bytesToString, funcTypeToString, memoryTypeToString } from "./types";
import { DataSegmentRef, E, ElementSegmentRef, F, FunctionRef, GlobalRef, ItemCount, Items, KindChip, MemoryRef, N, NameSection, RefTypeRef, Reference, ScrollPadder, TableRef, Tip, Toggle, TypeRef, ValTypeRef, WVNode, WasmError, addToggleEvents } from "./components";
import { assertUnreachable } from "./util";
import { activateTab, addTabToPane, newPane, newPaneContainer, newTab } from "./panes";
import { GotoEntry, addGoto, clearGotos, goto, lookUpGoto as lookUpGotos } from "./goto";
import {
  filePicker,
  doButton,
  sections,
  panes,
  gotoContainer,
  gotoInput,
  gotoHint,
  gotoResults,
  gotoBackground,
  gotoDialog,
} from "./elements";

async function init() {
  const url = wasmUrl as unknown as string;
  await wasmInit(fetch(url));
  // TODO: disable UI until this completes
}
init().catch(e => {
  throw e;
});

function updatePickerUI() {
  if (filePicker.files.length === 0) {
    doButton.setAttribute("disabled", "disabled");
  } else {
    doButton.removeAttribute("disabled");
  }
}
filePicker.addEventListener("change", () => updatePickerUI());
updatePickerUI();

let module: Module;

doButton.addEventListener("click", async () => {
  if (filePicker.files.length === 0) {
    return;
  }
  const wasmFile = filePicker.files[0];
  await loadModuleFromFile(wasmFile);
});

const scratchPane = newPane([], 1);
const functionsPane = newPane([], 2);
const allPanes = newPaneContainer("vertical", [
  scratchPane,
  functionsPane,
]);
panes.appendChild(allPanes.el);

async function loadModuleFromFile(wasmFile: File) {
  // TODO: get rid of these
  function p(msg: string) {
    const el = document.createElement("p");
    el.innerText = msg;
    return el;
  }
  function indirectNameMap(name: string, map: IndirectNamingResultArray) {
    return Toggle({
      title: name,
      children: map.map(outer => {
        if (outer.is_error) {
          return WasmError(`ERROR (offset ${outer.offset}): ${outer.message}`);
        } else {
          return Toggle({
            title: `${outer.index}`,
            children: outer.names.map(inner => {
              if (inner.is_error) {
                return WasmError(`ERROR (offset ${inner.offset}): ${inner.message}`);
              } else {
                return p(`${name} ${outer.index}.${inner.index}: "${inner.name}"`);
              }
            }),
          });
        }
      }),
    });
  }

  try {
    module = await parse(wasmFile.stream());
  } catch (err) {
    if (err instanceof BinaryError) {
      throw new Error(`at offset ${err.offset}: ${err.message}`, { cause: err });
    }
    throw err;
  }

  // @ts-expect-error I am not allowed to debug my own code 🤡
  window.currentModule = module;

  // TODO: Inspect each section for correct handling of indices.
  // Functions, tables, memories, and globals can all be imported, and therefore can have their
  // indices shifted.

  clearGotos();

  sections.innerHTML = "";
  for (const [sectionIndex, section] of module.sections.entries()) {
    const sectionEnd = section.offset + section.length;

    const sectionContents = E("div", ["toggle-contents"], []);

    const headerEl = E("div", ["toggle-title", "ma0", "mt2", "flex", "g2"], [
      E("b", [], sectionName(section)),
    ]);
    const sectionEl = E("div", ["section", "toggle", "flex", "items-start", "overflow-hidden"], [
      E("div", ["toggle-toggler", "pa2"], ">"),
      E("div", ["flex-grow-1", "mw-100", "flex", "flex-column", "g2", "overflow-hidden"], [
        headerEl,
        sectionContents,
      ]),
    ]);
    sectionEl.setAttribute("data-index", `${sectionIndex}`);

    addGoto({
      kind: "section",
      index: sectionIndex,
      depth: 0,
      offset: section.offset,
      length: section.length,
    });

    switch (section.type) {
      case "Custom": {
        sectionEl.classList.add("section-custom");

        const customItem = E("div", ["item", "pa2", "flex", "flex-column"]);

        if (section.names) {
          customItem.classList.remove("pa2");
          customItem.classList.add("ph2");
          for (const name of section.names) {
            if (name.is_error) {
              customItem.appendChild(p(`ERROR (offset ${name.offset}): ${name.message}`));
            } else {
              switch (name.kind) {
                case "module": {
                  customItem.appendChild(p(`Module: "${name.module}"`));
                } break;
                case "function": {
                  customItem.appendChild(NameSection({
                    title: "Functions",
                    names: name.function,
                    ref: n => FunctionRef({ module: module, index: n.index }),
                  }));
                } break;
                case "local": {
                  customItem.appendChild(indirectNameMap("Local", name.local));
                } break;
                case "label": {
                  customItem.appendChild(indirectNameMap("Label", name.label));
                } break;
                case "type_": {
                  customItem.appendChild(NameSection({
                    title: "Types",
                    names: name.type_,
                    ref: n => TypeRef({ module: module, index: n.index }),
                  }));
                } break;
                case "table": {
                  customItem.appendChild(NameSection({
                    title: "Tables",
                    names: name.table,
                    ref: n => TableRef({ index: n.index }),
                  }));
                } break;
                case "memory": {
                  customItem.appendChild(NameSection({
                    title: "Memories",
                    names: name.memory,
                    ref: n => MemoryRef({ index: n.index }),
                  }));
                } break;
                case "global": {
                  customItem.appendChild(NameSection({
                    title: "Globals",
                    names: name.global,
                    ref: n => GlobalRef({ module: module, index: n.index }),
                  }));
                } break;
                case "element": {
                  customItem.appendChild(NameSection({
                    title: "Element Segments",
                    names: name.element,
                    ref: n => ElementSegmentRef({ index: n.index }),
                  }));
                } break;
                case "data": {
                  customItem.appendChild(NameSection({
                    title: "Data Segments",
                    names: name.data,
                    ref: n => DataSegmentRef({ index: n.index }),
                  }));
                } break;
                case "unknown": {
                  customItem.appendChild(p(`Unknown name type ${name.unknown.ty}: ${name.unknown.data.length} bytes`));
                } break;
              }
            }
          }
        } else {
          customItem.appendChild(E("div", [], bytesToString(section.custom.data.byteLength)));
          // TODO: hex viewer for custom section data
        }
        sectionContents.appendChild(customItem);
      } break;
      case "Type": {
        headerEl.appendChild(ItemCount(section.types.length));
        sectionEl.classList.add("section-type");

        const items: Node[] = [];
        for (const [i, type] of section.types.entries()) {
          if (type.is_error) {
            items.push(WasmError(`ERROR (offset ${type.offset}): ${type.message}`));
          } else {
            let details: string;
            switch (type.t.kind) {
              case "func": {
                details = funcTypeToString(type.t.func);
              } break;
            }
            const nextOffset = section.types[i + 1]?.offset ?? sectionEnd;
            const item = E("div", ["item", "item-type", "pa2", "flex", "flex-column", "g2", "relative"], [
              E("div", ["b"], `Type ${i}`),
              E("div", [], details),
              ScrollPadder(),
            ]);
            item.setAttribute("data-index", `${i}`);
            items.push(item);

            addGoto({
              kind: "type",
              depth: 1,
              offset: type.offset,
              length: nextOffset - type.offset,
              index: i,
            });
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Import": {
        headerEl.appendChild(ItemCount(section.imports.imports.length));
        sectionEl.classList.add("section-import");

        const items: Node[] = [];

        const importModules: { name: string; imports: Import[] }[] = [];
        for (const [i, imp] of section.imports.imports.entries()) {
          if (imp.is_error) {
            items.push(WasmError(`ERROR (offset ${imp.offset}): ${imp.message}`));
            continue;
          }
          const existingMod = importModules.find(m => m.name === imp.module);
          if (existingMod) {
            existingMod.imports.push(imp);
          } else {
            importModules.push({
              name: imp.module,
              imports: [imp],
            });
          }

          const nextOffset = section.imports.imports[i + 1]?.offset ?? sectionEnd;
          addGoto({
            kind: "import",
            depth: 1,
            offset: imp.offset,
            length: nextOffset - imp.offset,
            namespace: imp.module,
            name: imp.name,
          });
        }

        for (const importModule of importModules) {
          const toggleEl = Toggle({
            item: true,
            title: E("div", ["flex", "g2"], [
              E("b", [], importModule.name),
              ItemCount(importModule.imports.length),
            ]),
            children: E("div", ["import-export-grid"], importModule.imports.map(imp => {
              let details: WVNode;
              switch (imp.ty.kind) {
                case "func": {
                  details = TypeRef({ module: module, index: imp.ty.func });
                } break;
                case "global": {
                  details = `${imp.ty.global.mutable ? "mutable " : ""}global`;
                  // TODO: calculate the global index and mark it in the goto system
                } break;
                case "memory": {
                  details = E("span", [], memoryTypeToString(imp.ty.memory));
                  // TODO: calculate the mem index and mark it in the goto system
                } break;
                case "table": {
                  details = "table";
                  // TODO: all the table info
                  // TODO: calculate the table index and mark it in the goto system
                } break;
                case "tag": {
                  details = "tag";
                  // TODO: all the tag info
                  // TODO: calculate the tag index and mark it in the goto system
                } break;
                default: {
                  details = "???";
                } break;
              }
              const chip = E("div", ["tr", "goto-import"], [
                KindChip({ kind: imp.ty.kind }),
              ]);
              chip.setAttribute("data-import-name", imp.name);
              return F([
                chip,
                E("div", ["flex", "items-start", "g2"], [
                  E("div", ["flex", "flex-column", "g1"], [
                    imp.name,
                    E("div", ["f--small"], details),
                  ]),
                ]),
              ]);
            })),
          });
          toggleEl.setAttribute("data-import-namespace", importModule.name);
          items.push(toggleEl);
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Function": {
        headerEl.appendChild(ItemCount(section.functions.length));
        sectionEl.classList.add("section-function");

        const items: Node[] = [];
        if (module.imported.funcs.length > 0) {
          items.push(E("div", ["i", "f--small"], `Functions 0 through ${module.imported.funcs.length - 1} are imported from the host.`));
        }
        for (const [i, func] of section.functions.entries()) {
          if (func.is_error) {
            items.push(WasmError(`ERROR (offset ${func.offset}): ${func.message}`));
          } else {
            const funcIndex = module.imported.funcs.length + i;
            const name = module.names.funcs[funcIndex];
            const item = E("div", ["item", "item-function", "relative", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], name ? `Function ${funcIndex}: ${name}` : `Function ${funcIndex}`),
              E("div", [], TypeRef({ module: module, index: func.type_idx })),
              ScrollPadder(),
            ]);
            item.setAttribute("data-index", `${funcIndex}`);
            items.push(item);

            const nextOffset = section.functions[i + 1]?.offset ?? sectionEnd;
            addGoto({
              kind: "function",
              depth: 1,
              offset: func.offset,
              length: nextOffset - func.offset,
              index: funcIndex,
            });
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Table": {
        headerEl.appendChild(ItemCount(section.tables.length));
        sectionEl.classList.add("section-table");

        const items: Node[] = [];
        for (const [i, table] of section.tables.entries()) {
          if (table.is_error) {
            items.push(WasmError(`ERROR (offset ${table.offset}): ${table.message}`));
          } else {
            const tableIndex = module.imported.tables.length + i;
            // TODO: table names?

            // TODO: Notice of table imports

            const initStr = `${table.ty.initial} elements`;
            const maxStr = table.ty.maximum ? `, max ${table.ty.maximum} elements` : ", no max";
            const item = E("div", ["item", "item-table", "relative", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Table ${i}`),
              E("div", [], ["of ", RefTypeRef({ module: module, type: table.ty.element_type })]),
              E("div", [], `${initStr}${maxStr}`),
              // TODO: "initialized by" for active segments
              ScrollPadder(),
            ]);
            item.setAttribute("data-index", `${tableIndex}`);
            items.push(item);

            const nextOffset = section.tables[i + 1]?.offset ?? sectionEnd;
            addGoto({
              kind: "table",
              depth: 1,
              offset: table.offset,
              length: nextOffset - table.offset,
              index: tableIndex,
            });
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Memory": {
        headerEl.appendChild(ItemCount(section.mems.length));
        sectionEl.classList.add("section-memory");

        const items: Node[] = [];
        for (const [i, mem] of section.mems.entries()) {
          if (mem.is_error) {
            items.push(WasmError(`ERROR (offset ${mem.offset}): ${mem.message}`));
          } else {
            const memIndex = module.imported.memories.length + i;
            // TODO: memory names?

            // TODO: notice of memory imports

            const details = E("div", []);
            const memEl = E("div", ["item", "item-memory", "relative", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Memory ${i}`),
              details,
              ScrollPadder(),
            ]);
            memEl.setAttribute("data-index", `${memIndex}`);

            if (mem.t.initial === mem.t.maximum) {
              details.appendChild(Tip({
                text: `exactly ${mem.t.initial} pages`,
                tooltip: `${bytesToString(mem.t.initial * BigInt(WASM_PAGE_SIZE))} (initial = max)`,
              }));
            } else {
              details.appendChild(Tip({
                text: `${mem.t.initial} pages`,
                tooltip: bytesToString(mem.t.initial * BigInt(WASM_PAGE_SIZE)),
              }));
              if (mem.t.maximum) {
                details.appendChild(N(", max "));
                details.appendChild(Tip({
                  text: `${mem.t.maximum} pages`,
                  tooltip: bytesToString(mem.t.maximum * BigInt(WASM_PAGE_SIZE)),
                }));
              } else {
                details.appendChild(N(", no max"));
              }
            }
            details.appendChild(N(mem.t.memory64 ? ", 64-bit" : ", 32-bit"));
            details.appendChild(N(mem.t.shared ? ", shared" : ", not shared"));
            // TODO: list relevant data segments (WARNING! there can be a lot of them!)
            items.push(memEl);

            const nextOffset = section.mems[i + 1]?.offset ?? sectionEnd;
            addGoto({
              kind: "memory",
              depth: 1,
              offset: mem.offset,
              length: nextOffset - mem.offset,
              index: memIndex,
            });
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Global": {
        headerEl.appendChild(ItemCount(section.globals.length));
        sectionEl.classList.add("section-global");

        const items: Node[] = [];
        for (const [i, global] of section.globals.entries()) {
          if (global.is_error) {
            items.push(WasmError(`ERROR (offset ${global.offset}): ${global.message}`));
          } else {
            const globalIndex = module.imported.globals.length + i;
            // TODO: global names
            // TODO: global init expr

            const item = E("div", ["item", "item-global", "relative", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Global ${i}`),
              E("div", [], [
                global.ty.mutable ? "mutable " : "immutable ",
                ValTypeRef({ module: module, type: global.ty.content_type }),
              ]),
              ScrollPadder(),
            ]);
            item.setAttribute("data-index", `${globalIndex}`);
            items.push(item);

            const nextOffset = section.globals[i + 1]?.offset ?? sectionEnd;
            addGoto({
              kind: "global",
              depth: 1,
              offset: global.offset,
              length: nextOffset - global.offset,
              index: globalIndex,
            });
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Export": {
        headerEl.appendChild(ItemCount(section.exports.length));
        sectionEl.classList.add("section-export");

        const goodExports: Export[] = [];
        for (const exp of section.exports) {
          if (exp.is_error) {
            sectionContents.appendChild(WasmError(`ERROR (offset ${exp.offset}): ${exp.message}`));
          } else {
            goodExports.push(exp);
          }
        }

        const exports: Node[] = [];
        for (const exp of goodExports) {
          let details: WVNode;
          switch (exp.kind.kind) {
            // TODO: names of things
            // TODO: references to each thing
            case "func": {
              details = FunctionRef({ module: module, index: exp.index, hideName: true });
            } break;
            case "global": {
              details = GlobalRef({ module: module, index: exp.index });
            } break;
            case "memory": {
              details = MemoryRef({ index: exp.index });
            } break;
            case "table": {
              details = TableRef({ index: exp.index });
            } break;
            case "tag": {
              details = `tag ${exp.index}`;
            } break;
            default: {
              details = "???";
            } break;
          }
          exports.push(
            E("div", ["tr"], [
              KindChip({ kind: exp.kind.kind }),
            ]),
            E("div", ["flex", "items-start", "g2"], [
              E("div", ["flex", "flex-column", "g1"], [
                exp.name,
                E("div", ["f--small"], details),
              ]),
            ]),
          );
        }
        sectionContents.appendChild(E("div", ["item", "pv2", "ph3", "import-export-grid"], exports));
      } break;
      case "Start": {
        sectionEl.classList.add("section-start");
        sectionContents.appendChild(p(`Start func: ${section.func}`));
      } break;
      case "Element": {
        headerEl.appendChild(ItemCount(section.elements.length));
        sectionEl.classList.add("section-element");

        const items: Node[] = [];
        for (const [i, element] of section.elements.entries()) {
          if (element.is_error) {
            items.push(WasmError(`ERROR (offset ${element.offset}): ${element.message}`));
          } else {
            // TODO: element segment items
            const segmentItem = E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Element Segment ${i}`),
              E("div", [], [`${element.kind.kind}, of `, RefTypeRef({ module: module, type: element.ty })]),
            ]);
            if (element.kind.kind === "active") {
              const active = element.kind.active;
              segmentItem.appendChild(E("div", [], [
                "initializes ", TableRef({ index: active.table_index }),
                // TODO: offset expr (possibly specializing to i32.const)
              ]));
            }
            const itemNodes: Node[] = [];
            switch (element.items.kind) {
              case "functions": {
                for (const funcIdx of element.items.functions) {
                  itemNodes.push(E("div", [], FunctionRef({ module: module, index: funcIdx })));
                }
              } break;
              case "expressions": {
                // TODO
              } break;
              default:
                assertUnreachable(element.items);
            }
            segmentItem.appendChild(Toggle({
              title: E("div", [], [
                E("b", ["mr2"], "Items"),
                E("span", [], `(${itemNodes.length} total)`),
              ]),
              children: E("div", ["flex", "flex-column", "g2"], itemNodes),
            }));
            items.push(segmentItem);
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Code": {
        headerEl.appendChild(ItemCount(section.funcs.length));
        sectionEl.classList.add("section-code");

        const items: Node[] = [];

        if (module.imported.funcs.length > 0) {
          items.push(E("div", ["i", "f--small"], `Functions 0 through ${module.imported.funcs.length - 1} are imported from the host.`));
        }

        for (const [i, func] of section.funcs.entries()) {
          if (func.is_error) {
            items.push(WasmError(`ERROR (offset ${func.offset}): ${func.message}`));
          } else {
            // for (const op of func.ops) {
            //   if (op.is_error) {
            //     sectionEl.appendChild(p(`ERROR (offset ${op.offset}): ${op.message}`));
            //   } else {
            //     sectionEl.appendChild(p(op.name));
            //   }
            // }
            const funcIndex = module.imported.funcs.length + i;
            const name = module.names.funcs[funcIndex];
            const funcTypeIndex = module.functionType(funcIndex);
            const item = E("div", ["item", "item-code", "relative", "pa2", "flex", "flex-column", "g1"], [
              E("b", [], name ? `Function ${funcIndex}: ${name}` : `Function ${funcIndex}`),
              E("div", ["f--small"], [
                funcTypeIndex !== undefined
                  ? TypeRef({ module: module, index: funcTypeIndex })
                  : Reference({ text: "unknown type" }),
              ]),
              ScrollPadder(),
            ]);
            item.setAttribute("data-index", `${funcIndex}`);
            item.addEventListener("click", () => openFunction(funcIndex));
            items.push(item);

            addGoto({
              kind: "code",
              depth: 1,
              offset: func.range.start,
              length: func.range.end - func.range.start, // TODO: Verify that this isn't off by one
              index: funcIndex,
            });
          }
          sectionContents.appendChild(Items(items));
        }
      } break;
      case "Data": {
        headerEl.appendChild(ItemCount(section.datas.length));
        sectionEl.classList.add("section-data");

        const items: Node[] = [];
        for (const [i, data] of section.datas.entries()) {
          if (data.is_error) {
            items.push(WasmError(`ERROR (offset ${data.offset}): ${data.message}`));
          } else {
            // TODO: data names
            // TODO: active data offset expr
            // TODO: locations of referencing memory.init instructions
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Data Segment ${i}`),
              E("div", [], data.kind.kind === "active"
                ? ["active, initializes ", MemoryRef({ index: data.kind.active.memory_index })]
                : ["passive"]
              ),
              // TODO: hex viewer for data
              // Toggle({
              //   title: E("div", [], [
              //     E("b", ["mr2"], "Data"),
              //     E("span", [], `(${bytesToString(data.data.byteLength)})`),
              //   ]),
              //   children: E("div", ["flex", "flex-column", "g2"], itemNodes),
              // }),
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "DataCount": {
        sectionEl.classList.add("section-data-count");
        sectionContents.appendChild(p(`Num data segments: ${section.numDataSegments}`));
      } break;
    }

    addToggleEvents(sectionEl);
    sections.appendChild(sectionEl);
  }
}

function sectionName(section: Section): string {
  switch (section.type) {
    case "Custom":
      return `Custom Section "${section.custom.name}"`;
    case "DataCount":
      return "Data Count Section";
    default:
      return `${section.type} Section`;
  }
}

interface NameSubscriptions {
  function: NameMapSubscriptions;
}

type NameUpdateCallback = (module: Module) => void;

interface NameMapSubscriptions {
  [index: number]: NameUpdateCallback[] | undefined;
}

interface SubscriptionResult {
  unsubscribe: () => void;
}

const nameSubscriptions: NameSubscriptions = {
  "function": {},
};

function subscribeToNameChanges(kind: Name["kind"], index: number, update: NameUpdateCallback): SubscriptionResult {
  let unsubscribe: () => void;
  switch (kind) {
    case "function": {
      const subscriptions = nameSubscriptions.function[index] ?? [];
      subscriptions.push(update);
      unsubscribe = () => subscriptions.splice(subscriptions.indexOf(update), 1);
      nameSubscriptions.function[index] = subscriptions;
    } break;
    default: {
      // TODO: Subscribe to all kinds of name changes
      // assertUnreachable(kind);
      unsubscribe = () => {};
    } break;
  }
  update(module);

  return {
    unsubscribe,
  };
}

function openFunction(index: number) {
  const nameEl = E("span", []);
  const { unsubscribe } = subscribeToNameChanges("function", index, module => {
    const name = module.names.funcs[index];
    nameEl.innerText = name ? `Function ${name}` : `Function ${index}`;
  });
  const tab = newTab(nameEl, {
    onClose: unsubscribe,
    content: E("div", ["pa3"], nameEl.innerText),
  });
  addTabToPane(tab, functionsPane);
  activateTab(functionsPane, tab);
}

function gotoVisible(): boolean {
  return !gotoContainer.classList.contains("dn");
}

function toggleGoto(show: boolean) {
  gotoContainer.classList.toggle("dn", !show);
}

gotoInput.addEventListener("input", () => {
  gotoResults.innerHTML = "";
  const results: Node[] = [];

  const str = gotoInput.value;
  if (/^\d+$/.test(str)) {
    // number only, treat as byte offset
    const offset = parseInt(str, 10);
    const gotos = lookUpGotos(offset);
    for (const gotoEntry of gotos) {
      const resultClasses = ["flex", "g1", "items-center"];
      let result: Node;
      const kind = gotoEntry.kind;
      switch (kind) {
        case "section": {
          const section = module.sections[gotoEntry.index];
          let name: string;
          switch (section.type) {
            case "Custom": name = `Custom Section "${section.custom.name}"`; break;
            case "DataCount": name = "Data Count Section"; break;
            default: name = `${section.type} Section`; break;
          }

          result = E("div", resultClasses, [
            KindChip({ kind: "section" }),
            name,
          ]);
        } break;
        case "type": {
          result = E("div", resultClasses, [
            KindChip({ kind: "type" }),
            module.names.types[gotoEntry.index] ?? `Type ${gotoEntry.index}`,
          ]);
        } break;
        case "import": {
          result = E("div", resultClasses, [
            KindChip({ kind: "import" }),
            `Import "${gotoEntry.namespace}" "${gotoEntry.name}"`,
          ]);
        } break;
        case "function": {
          result = E("div", resultClasses, [
            KindChip({ kind: "function header" }),
            module.names.funcs[gotoEntry.index] ?? `Function ${gotoEntry.index}`,
          ]);
        } break;
        case "table": {
          result = E("div", resultClasses, [
            KindChip({ kind: "table" }),
            module.names.tables[gotoEntry.index] ?? `Table ${gotoEntry.index}`,
          ]);
        } break;
        case "memory": {
          result = E("div", resultClasses, [
            KindChip({ kind: "memory" }),
            module.names.memories[gotoEntry.index] ?? `Memory ${gotoEntry.index}`,
          ]);
        } break;
        case "global": {
          result = E("div", resultClasses, [
            KindChip({ kind: "global" }),
            module.names.globals[gotoEntry.index] ?? `Global ${gotoEntry.index}`,
          ]);
        } break;
        case "code": {
          result = E("div", resultClasses, [
            KindChip({ kind: "func" }),
            module.names.funcs[gotoEntry.index] ?? `Function ${gotoEntry.index}`,
          ]);
        } break;
        default:
          assertUnreachable(kind);
      }
      result.addEventListener("click", () => {
        goto(gotoEntry);
        toggleGoto(false);
      });
      results.push(result);
    }
  }

  // TODO:
  // "quotes" to force a name search
  // index shortcuts: t0, m0, etc.

  gotoHint.classList.toggle("flex", str === ""); // it already has dn
  gotoResults.classList.toggle("dn", results.length === 0);
  for (const result of results) {
    gotoResults.appendChild(result);
  }
});

document.addEventListener("keydown", ev => {
  // toggle goto
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "k") {
    ev.preventDefault();
    if (ev.repeat) {
      return;
    }

    const appearing = !gotoVisible();
    toggleGoto(appearing);
    if (appearing) {
      gotoInput.focus();
      gotoInput.select();
    }

    return;
  }

  if (ev.key === "Escape") {
    if (gotoVisible()) {
      toggleGoto(false);
      return;
    }
  }

  // console.log("unknown key", ev.key);
});

gotoBackground.addEventListener("click", () => toggleGoto(false));
gotoDialog.addEventListener("click", e => e.stopPropagation());

export {};
