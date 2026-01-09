import type { RngState } from "./types";

export function createRng(seed: number): RngState {
    return { state: seed >>> 0 };
}

export function rand(rng: RngState): number {
    rng.state = (rng.state + 0x6d2b79f5) >>> 0;
    let t = rng.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(rng: RngState, min: number, max: number): number {
    return min + rand(rng) * (max - min);
}

export function randInt(
    rng: RngState,
    min: number,
    maxExclusive: number,
): number {
    return Math.floor(randRange(rng, min, maxExclusive));
}
