import { parse } from "./parse";

function el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`no element exists with id '${id}'`);
    }
    return element;
}

const filePicker = el("file-picker") as HTMLInputElement & { files: FileList };
const doButton = el("doeet");
const sections = el("sections");

function updatePickerUI() {
    if (filePicker.files.length === 0) {
        doButton.setAttribute("disabled", "disabled");
    } else {
        doButton.removeAttribute("disabled");
    }
}
filePicker.addEventListener("change", () => updatePickerUI());
updatePickerUI();

doButton.addEventListener("click", async () => {
    if (filePicker.files.length === 0) {
        return;
    }

    function p(msg: string) {
        const el = document.createElement("p");
        el.innerText = msg;
        return el;
    }

    const wasmFile = filePicker.files[0];
    const module = await parse(wasmFile.stream());

    for (const section of module.sections) {
        const sectionEl = document.createElement("div");
        sectionEl.classList.add("section");
        {
            const headerEl = document.createElement("h2");
            headerEl.innerText = `${section.type} Section`;
            sectionEl.appendChild(headerEl);

            switch (section.type) {
                case "Custom": {
                    sectionEl.appendChild(p(`Size: ${section.size} bytes`));
                } break;
                case "Code": {
                    sectionEl.appendChild(p(`Number of functions: ${section.funcs.length}`));

                    let sum = 0;
                    for (const func of section.funcs) {
                        sum += func.size;
                    }
                    const avg = sum / section.funcs.length;

                    sectionEl.appendChild(p(`Average func size: ${Math.round(avg)} bytes`));
                }
            }
        }
        sections.appendChild(sectionEl);
    }
});

export {};
