import { describe, expect, it } from "vitest";
import { updateStationGrowth } from "./growth";
import {
    createWorld,
    difficultyPressure,
    spawnStation,
    stationSpawnInterval,
} from "./world";

describe("station growth", () => {
    it("spawns a station when cooldown expires", () => {
        const world = createWorld(50);
        world.stationSpawnCooldown = 0;

        updateStationGrowth(world, 1);

        expect(world.stations.size).toBe(world.config.initialStations + 1);
        expect(world.stationSpawnCooldown).toBeGreaterThan(0);
    });

    it("does not exceed maxStations", () => {
        const world = createWorld(51, {
            ...createWorld(51).config,
            initialStations: 3,
            maxStations: 4,
        });

        expect(spawnStation(world)).toBeDefined();
        expect(spawnStation(world)).toBeUndefined();
        expect(world.stations.size).toBe(4);
    });

    it("station interval trends down as pressure rises", () => {
        const early = createWorld(52);
        const late = createWorld(52);
        late.time = 600;

        const earlyInterval = stationSpawnInterval(early);
        const lateInterval = stationSpawnInterval(late);

        expect(difficultyPressure(early)).toBe(0);
        expect(difficultyPressure(late)).toBe(1);
        expect(lateInterval).toBeLessThan(earlyInterval);
    });

    it("can unlock advanced station types later", () => {
        const world = createWorld(53);
        world.time = 600;

        const seen = new Set<string>();
        for (let index = 0; index < 200; index += 1) {
            const station = spawnStation(world);
            if (!station) break;
            seen.add(station.type);
        }

        expect(
            [...seen].some((type) => type === "diamond" || type === "star"),
        ).toBe(true);
    });
});
