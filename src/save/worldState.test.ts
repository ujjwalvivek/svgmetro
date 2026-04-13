import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import { boardAt, spawnPassengerAt } from "../sim/passengers";
import { createWorld } from "../sim/world";
import { decodeWorld, encodeWorld, serializeWorld } from "./worldState";

describe("world save state", () => {
    it("round-trips world state through JSON", () => {
        const world = createWorld(70);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const target = world.stations.get(ids[1]!)!;

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });
        spawnPassengerAt(world, start, target.type);
        world.debug!.renderAllPassengers = true;
        world.time = 123.45;
        world.tick = 7407;

        const restored = decodeWorld(encodeWorld(world));

        expect(restored.seed).toBe(world.seed);
        expect(restored.time).toBe(world.time);
        expect(restored.tick).toBe(world.tick);
        expect(restored.stations.size).toBe(world.stations.size);
        expect(restored.routes.size).toBe(world.routes.size);
        expect(restored.trains.size).toBe(world.trains.size);
        expect(restored.passengers.size).toBe(world.passengers.size);
        expect(restored.debug!.renderAllPassengers).toBe(true);
        expect(
            [...restored.stations.values()].every(
                (station) => station.dirtyQueue && station.dirtyVisual,
            ),
        ).toBe(true);
        expect(
            [...restored.routes.values()].every((route) => route.dirtyPath),
        ).toBe(true);
    });

    it("saves active routes, train positions, and passenger ownership", () => {
        const world = createWorld(72);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const target = world.stations.get(ids[1]!)!;

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const route = [...world.routes.values()][0]!;
        const train = world.trains.get(route.trainIds[0]!)!;
        train.segmentIndex = 0;
        train.direction = 1;
        train.t = 0.42;

        const passenger = spawnPassengerAt(world, start, target.type);
        boardAt(world, train, start);

        const restored = decodeWorld(encodeWorld(world));
        const restoredRoute = restored.routes.get(route.id)!;
        const restoredTrain = restored.trains.get(train.id)!;
        const restoredPassenger = restored.passengers.get(passenger.id)!;

        expect(restoredRoute.stationIds).toEqual(route.stationIds);
        expect(restoredRoute.trainIds).toEqual([train.id]);
        expect(restoredTrain.routeId).toBe(route.id);
        expect(restoredTrain.segmentIndex).toBe(0);
        expect(restoredTrain.direction).toBe(1);
        expect(restoredTrain.t).toBe(0.42);
        expect(restoredTrain.passengers).toEqual([passenger.id]);
        expect(restoredPassenger.state).toBe("riding");
        expect(restoredPassenger.trainId).toBe(train.id);
    });

    it("does not serialize transient dirty render flags", () => {
        const world = createWorld(73);
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

        for (const station of world.stations.values()) {
            station.dirtyQueue = true;
            station.dirtyVisual = true;
        }
        for (const route of world.routes.values()) {
            route.dirtyPath = true;
        }

        const saved = serializeWorld(world);

        expect(
            saved.world.stations.every(
                (station) => !station.dirtyQueue && !station.dirtyVisual,
            ),
        ).toBe(true);
        expect(saved.world.routes.every((route) => !route.dirtyPath)).toBe(
            true,
        );
    });

    it("rejects unsupported save versions", () => {
        const encoded = encodeWorld(createWorld(71));
        const data = JSON.parse(encoded) as { version: number };
        data.version = 999;

        expect(() => decodeWorld(JSON.stringify(data))).toThrow(
            "Unsupported save version",
        );
    });
});
