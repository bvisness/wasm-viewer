import { readVarU } from "./leb128";
import { WasmReader } from "./reader";

function el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`no element exists with id '${id}'`);
    }
    return element;
}

const filePicker = el("file-picker") as HTMLInputElement & { files: FileList };
const doButton = el("doeet");

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

    const wasmFile = filePicker.files[0];
    await parse(wasmFile.stream());
});

async function parse(stream: ReadableStream<Uint8Array>) {
    const reader = new WasmReader(stream);

    async function expect(bytes: number[]) {
        for (const [i, expected] of bytes.entries()) {
            const actual = await reader.getByte(`byte ${expected} (at index ${i} in ${JSON.stringify(bytes)})`);
            if (actual !== expected) {
                throw new Error(`expected byte ${expected} but got ${actual} (at index ${i} in ${JSON.stringify(bytes)})`);
            }
        }
    }

    await expect([0x00, 0x61, 0x73, 0x6D]); // magic: 0asm
    await expect([0x01, 0x00, 0x00, 0x00]); // version: 1
    console.log("it sure is wasm");

    // This is designed to be a very forgiving parser, free of the shackles of real-life engines.
    // This means we don't care about section order, we are generous with opcodes, etc.

    // Parse sections
    while (true) {
        const sectionID = await reader.getByte("a section id");
        switch (sectionID) {
            case 0: {
                // Custom section
                console.log("Custom section");
                const n = await readVarU(reader, 32);
                console.log("Advancing by", n);
                await reader.advanceBy(n);
            } break;
            default: {
                console.log(`Unknown section type ${sectionID}`);
                const n = await readVarU(reader, 32);
                console.log("Advancing by", n, "to skip over it");
                await reader.advanceBy(n);
            } break;
        }

        await reader.getChunkIfDoneWithThisOne();
        if (reader.done) {
            break;
        }
    }
}

export {};
