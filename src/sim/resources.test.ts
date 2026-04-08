import { describe, expect, it } from "vitest";
import { lineLimit, nextLineUnlockAt } from "./resources";
import { createWorld, spawnStation } from "./world";

describe("resources", () => {
    it("starts with a finite line limit and next unlock target", () => {
        const world = createWorld(90);

        expect(lineLimit(world)).toBe(world.config.startingLines);
        expect(nextLineUnlockAt(world)).toBe(
            world.config.initialStations + world.config.lineRewardEveryStations,
        );
    });

    it("earns line slots from station growth", () => {
        const base = createWorld(91).config;
        const world = createWorld(91, {
            ...base,
            lineRewardEveryStations: 1,
        });

        const startingLines = lineLimit(world);
        spawnStation(world);

        expect(lineLimit(world)).toBe(startingLines + 1);
    });

    it("stops advertising a next unlock at max lines", () => {
        const base = createWorld(92).config;
        const world = createWorld(92, {
            ...base,
            startingLines: 1,
            maxLines: 1,
        });

        expect(lineLimit(world)).toBe(1);
        expect(nextLineUnlockAt(world)).toBeUndefined();
    });
});
