import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import { createWorld } from "../sim/world";
import { applyDebugAction } from "./actions";

describe("debug actions", () => {
    it("runs a lean stress setup", () => {
        const world = createWorld(60);
        const initialStationCount = world.stations.size;

        applyDebugAction(world, "stress-test");

        expect(world.stations.size).toBe(initialStationCount + 10);
        expect(world.passengers.size).toBe(250);
        expect(
            [...world.stations.values()].some(
                (station) => station.queue.length > 0,
            ),
        ).toBe(true);
    });

    it("respects the station cap during stress setup", () => {
        const world = createWorld(61, {
            ...createWorld(61).config,
            initialStations: 3,
            maxStations: 12,
        });

        applyDebugAction(world, "stress-test");

        expect(world.stations.size).toBe(12);
    });

    it("spawns extra route paths instead of stacking trains on one path", () => {
        const world = createWorld(62);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[0]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[1]!,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const originalRoute = [...world.routes.values()][0]!;
        applyDebugAction(world, "stress-test");

        expect(world.trains.size).toBe(21);
        expect(world.routes.size).toBe(21);
        expect(
            [...world.routes.values()].every(
                (route) => route.stationIds.length >= 2,
            ),
        ).toBe(true);
        expect(
            [...world.routes.values()].every(
                (route) => route.trainIds.length === 1,
            ),
        ).toBe(true);
        expect(originalRoute.trainIds).toHaveLength(1);
    });

    it("runs individual controlled stress modes", () => {
        const world = createWorld(64);
        const initialStations = world.stations.size;

        applyDebugAction(world, "stress-passengers");
        expect(world.passengers.size).toBe(250);

        applyDebugAction(world, "stress-stations");
        expect(world.stations.size).toBe(initialStations + 10);

        applyDebugAction(world, "stress-routes");
        expect(world.routes.size).toBe(20);
        expect(world.trains.size).toBe(20);
    });

    it("resets expensive debug modes and marks queues dirty", () => {
        const world = createWorld(63);
        world.debug.renderAllPassengers = true;
        world.debug.dirtyRendering = false;
        world.debug.useSvgGeometry = true;
        world.gameOver = true;
        for (const station of world.stations.values()) {
            station.overcrowd = 5;
            station.dirtyQueue = false;
            station.dirtyVisual = false;
        }

        applyDebugAction(world, "stress-test");

        expect(world.debug.renderAllPassengers).toBe(false);
        expect(world.debug.dirtyRendering).toBe(true);
        expect(world.debug.useSvgGeometry).toBe(false);
        expect(world.gameOver).toBe(false);
        expect(
            [...world.stations.values()].every((station) => station.dirtyQueue),
        ).toBe(true);
        expect(
            [...world.stations.values()].every(
                (station) => station.dirtyVisual,
            ),
        ).toBe(true);
        expect(
            [...world.stations.values()].every(
                (station) => station.overcrowd === 0,
            ),
        ).toBe(true);
    });
});
