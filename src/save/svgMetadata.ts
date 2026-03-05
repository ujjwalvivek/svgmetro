import type { World } from "../sim/types";
import { createWorld } from "../sim/world";
import { decodeWorld } from "./worldState";

export const SVG_STATE_METADATA_ID = "svg-metro-state";
export const SVG_STATE_METADATA_TYPE = "application/json";
export const SVG_BOOT_VERSION = 1;

export interface SvgBootMetadata {
    version: typeof SVG_BOOT_VERSION;
    seed: number;
}

export function encodeBootMetadata(seed: number): string {
    return JSON.stringify({
        version: SVG_BOOT_VERSION,
        seed,
    } satisfies SvgBootMetadata);
}

export function loadWorldFromMetadataText(text: string | undefined): World {
    if (!text) return createWorld();

    try {
        return decodeWorld(text);
    } catch {
        const boot = JSON.parse(text) as Partial<SvgBootMetadata>;
        return createWorld(boot.seed);
    }
}
