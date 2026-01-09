import { describe, expect, it } from "vitest";
import { createWorld } from "./world";

describe("createWorld", () => {
    it("creates deterministic initial stations for a seed", () => {
        const a = createWorld(1234);
        const b = createWorld(1234);

        expect([...a.stations.values()]).toEqual([...b.stations.values()]);
    });

    it("includes the three MVP station types initially", () => {
        const world = createWorld(5678);
        const types = new Set(
            [...world.stations.values()].map((station) => station.type),
        );

        expect(types.has("circle")).toBe(true);
        expect(types.has("square")).toBe(true);
        expect(types.has("triangle")).toBe(true);
    });

    it("creates ten initial stations", () => {
        const world = createWorld(9876);

        expect(world.stations.size).toBe(10);
    });
});
