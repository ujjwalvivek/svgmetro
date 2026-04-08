import { describe, expect, it } from "vitest";
import { updateCongestion } from "./congestion";
import { spawnPassengerAt } from "./passengers";
import { createWorld } from "./world";

describe("congestion", () => {
    it("starts game over when a station stays overcrowded", () => {
        const world = createWorld(40);
        const station = [...world.stations.values()][0]!;

        for (let index = 0; index < world.config.queueWarning + 6; index += 1) {
            spawnPassengerAt(world, station, "square");
        }

        updateCongestion(world, world.config.overcrowdLimit + 1);

        expect(world.gameOver).toBe(true);
        expect(world.failedStationId).toBe(station.id);
    });

    it("recovers overcrowd time when the queue is safe", () => {
        const world = createWorld(41);
        const station = [...world.stations.values()][0]!;

        for (let index = 0; index < world.config.queueLimit + 1; index += 1) {
            spawnPassengerAt(world, station, "square");
        }

        updateCongestion(world, 5);
        const previous = station.overcrowd;
        station.queue = [];
        updateCongestion(world, 1);

        expect(station.overcrowd).toBeLessThan(previous);
        expect(world.gameOver).toBe(false);
    });

    it("scales overcrowding by queue severity", () => {
        const world = createWorld(42);
        const station = [...world.stations.values()][0]!;

        for (let index = 0; index < world.config.queueLimit + 1; index += 1) {
            spawnPassengerAt(world, station, "square");
        }

        updateCongestion(world, 6);

        const expected =
            6 *
            Math.pow(
                1 / (world.config.queueWarning - world.config.queueLimit),
                1.25,
            ) *
            world.config.overcrowdGrowthRate;
        expect(station.overcrowd).toBeCloseTo(expected);
        expect(world.gameOver).toBe(false);
    });
    it("treats unreachable passengers as congestion pressure", () => {
        const world = createWorld(43);
        const station = [...world.stations.values()][0]!;
        const passenger = spawnPassengerAt(world, station, "star");
        passenger.unreachable = true;

        updateCongestion(world, 1);

        expect(station.overcrowd).toBeGreaterThan(0);
    });

});
