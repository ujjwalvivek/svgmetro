import type { World } from "./types";

export function lineLimit(world: World): number {
    const earned = Math.floor(
        Math.max(0, world.stations.size - world.config.initialStations) /
            Math.max(1, world.config.lineRewardEveryStations),
    );
    return Math.min(world.config.maxLines, world.config.startingLines + earned);
}

export function nextLineUnlockAt(world: World): number | undefined {
    const currentLimit = lineLimit(world);
    if (currentLimit >= world.config.maxLines) return undefined;

    const earned = currentLimit - world.config.startingLines;
    return (earned + 1) * world.config.lineRewardEveryStations +
        world.config.initialStations;
}

export function hasLineSlot(world: World): boolean {
    return world.routes.size < lineLimit(world);
}
