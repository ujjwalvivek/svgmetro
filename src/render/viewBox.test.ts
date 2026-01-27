import { describe, expect, it } from "vitest";
import { createWorld } from "../sim/world";
import { fullViewBox, stationFitViewBox } from "./viewBox";

describe("stationFitViewBox", () => {
    it("frames clustered stations while preserving the map aspect ratio", () => {
        const world = createWorld(110);
        const stations = [...world.stations.values()];

        stations.forEach((station, index) => {
            station.x = 610 + (index % 3) * 24;
            station.y = 310 + Math.floor(index / 3) * 18;
        });

        const viewBox = stationFitViewBox(world);

        expect(viewBox.width).toBeLessThan(world.config.mapWidth);
        expect(viewBox.height).toBeLessThan(world.config.mapHeight);
        expect(viewBox.x).toBeGreaterThanOrEqual(0);
        expect(viewBox.y).toBeGreaterThanOrEqual(0);
        expect(viewBox.width / viewBox.height).toBeCloseTo(
            world.config.mapWidth / world.config.mapHeight,
            3,
        );
    });

    it("uses the full map when stations already fill the play area", () => {
        const world = createWorld(111);
        const stations = [...world.stations.values()];

        stations[0]!.x = world.config.margin;
        stations[0]!.y = world.config.margin;
        stations[1]!.x = world.config.mapWidth - world.config.margin;
        stations[1]!.y = world.config.mapHeight - world.config.margin;

        expect(stationFitViewBox(world)).toEqual(fullViewBox(world.config));
    });
});
