// lib/engine/dedupe.d.ts — exact surface of dedupe.mjs
export declare function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T>;
export declare function inFlightCount(): number;
