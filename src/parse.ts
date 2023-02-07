import { readVarU } from "./leb128";
import { WasmReader } from "./reader";
import { FuncInfo, Module, Section } from "./types";

export async function parse(stream: ReadableStream<Uint8Array>): Promise<Module> {
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

    const sections: Section[] = [];

    // Parse sections
    while (true) {
        const sectionID = await reader.getByte("a section id");
        const sectionSize = await readVarU(reader, 32);

        switch (sectionID) {
            case 0: {
                // Custom section
                console.log("Custom section");
                console.log("Advancing by", sectionSize);
                await reader.advanceBy(sectionSize);

                sections.push({
                    type: "Custom",
                    size: sectionSize,
                });
            } break;
            case 10: {
                // Code section
                console.groupCollapsed("Code section");

                const numFuncs = await readVarU(reader, 32);
                console.log(numFuncs, "functions");

                const funcs = new Array<FuncInfo>(numFuncs);
                for (let i = 0; i < numFuncs; i++) {
                    const funcSize = await readVarU(reader, 32);
                    console.log("Function with size", funcSize);
                    funcs[i] = {
                        size: funcSize,
                    };
                    await reader.advanceBy(funcSize);
                }

                console.groupEnd();
                sections.push({
                    type: "Code",
                    funcs: funcs,
                });
            } break;
            default: {
                console.log(`Unknown section type ${sectionID}`);
                console.log("Advancing by", sectionSize, "to skip over it");
                await reader.advanceBy(sectionSize);
            } break;
        }

        await reader.getChunkIfDoneWithThisOne();
        if (reader.done) {
            break;
        }
    }

    return {
        sections: sections,
    };
}
