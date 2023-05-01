export class WasmReader {
    reader: ReadableStreamDefaultReader<Uint8Array>;

    cursor: number;
    chunk: Uint8Array;
    done: boolean;

    constructor(stream: ReadableStream<Uint8Array>) {
        this.reader = stream.getReader();
        this.cursor = 0;
        this.chunk = new Uint8Array([]);
        this.done = false;
    }

    async getChunk(): Promise<boolean> {
        this.cursor = 0;

        const { done, value } = await this.reader.read();
        if (done) {
            this.chunk = new Uint8Array([]);
            this.done = true;
            return true;
        } else {
            this.chunk = value;
            return false;
        }
    }

    async getChunkIfDoneWithThisOne(): Promise<boolean> {
        if (this.cursor >= this.chunk.length) {
            return this.getChunk();
        } else {
            return false;
        }
    }

    async mustHaveBytes(msg: string) {
        if (this.cursor >= this.chunk.length) {
            const done = await this.getChunk();
            if (done) {
                throw new Error(`got end of file: ${msg}`);
            }
        }
    }

    async getByte(thing: string): Promise<number> {
        await this.mustHaveBytes(`expecting ${thing}`);
        const result = this.chunk[this.cursor];
        this.cursor++;
        return result;
    }

    async advanceBy(n: number): Promise<void> {
        while (true) {
            const advanceThisChunk = Math.min(this.chunk.length - this.cursor, n);
            this.cursor += advanceThisChunk;
            n -= advanceThisChunk;
            if (n > 0) {
                // There are still bytes to advance by. Get another chunk.
                const done = await this.getChunk();
                if (done) {
                    throw new Error(`tried to advance by ${n} bytes, but ran out of data`);
                }
                this.cursor = 0;
                continue;
            }
            break;
        }
    }

    async getNBytes(n: number): Promise<Uint8Array> {
        let i = 0;
        const res = new Uint8Array(n);
        while (true) {
            const advanceThisChunk = Math.min(this.chunk.length - this.cursor, n);
            const sourceBytes = this.chunk.subarray(this.cursor, this.cursor + advanceThisChunk);
            console.log({ sourceBytes });
            res.set(sourceBytes, i);
            this.cursor += advanceThisChunk;
            i += advanceThisChunk;
            n -= advanceThisChunk;
            if (n > 0) {
                // There are still bytes to advance by. Get another chunk.
                const done = await this.getChunk();
                if (done) {
                    throw new Error(`tried to advance by ${n} bytes, but ran out of data`);
                }
                this.cursor = 0;
                continue;
            }
            break;
        }
        return res;
    }
}
