import { WasmReader } from "./reader";

// These functions ported from the SpiderMonkey codebase.

export async function readVarU(reader: WasmReader, size: 32 | 64): Promise<number> {
    const numBits = size;
    const remainderBits = numBits % 7;
    const numBitsInSevens = numBits - remainderBits;

    let u = 0;
    let byte = NaN;
    let shift = 0;
    do {
        byte = await reader.getByte("a LEB128 number");
        if (!(byte & 0x80)) {
            return u | (byte << shift);
        }
        u |= (byte & 0x7F) << shift;
        shift += 7;
    } while (shift != numBitsInSevens);

    byte = await reader.getByte("a LEB128 number");
    if (byte & ((~0) << remainderBits)) {
        throw new Error("malformed LEB128");
    }

    return u | (byte << numBitsInSevens);
}

export async function readVarS(reader: WasmReader, size: 32 | 64): Promise<number> {
    const numBits = size;
    const remainderBits = numBits % 7;
    const numBitsInSevens = numBits - remainderBits;
    
    let s = 0;
    let byte = NaN;
    let shift = 0;
    do {
        byte = await reader.getByte("a LEB128 number");
        s |= (byte & 0x7f) << shift;
        shift += 7;
        if (!(byte & 0x80)) {
            if (byte & 0x40) {
                s |= (~0) << shift;
            }
            return s;
        }
    } while (shift < numBitsInSevens);

    if (!remainderBits) {
        throw new Error("malformed LEB128");
    }

    byte = await reader.getByte("a LEB128 number");
    if (byte & 0x80) {
        throw new Error("malformed LEB128");
    }

    const mask = 0x7f & ((~0) << remainderBits);
    if ((byte & mask) !== ((byte & (1 << (remainderBits - 1))) ? mask : 0)) {
        throw new Error("malformed LEB128");
    }

    return s | (byte << shift);
}
