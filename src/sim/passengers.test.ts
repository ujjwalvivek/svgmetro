import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import {
    boardAt,
    disembarkAt,
    handleTrainArrivals,
    passengerInterval,
    spawnPassengerAt,
} from "./passengers";
import { createWorld } from "./world";

describe("passengers", () => {
    it("boards passengers only when the route can serve their target type", () => {
        const world = createWorld(20);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const target = world.stations.get(ids[1]!)!;
        const offRoute = world.stations.get(ids[2]!)!;

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const train = [...world.trains.values()][0]!;
        const canRide = spawnPassengerAt(world, start, target.type);
        const cannotRide = spawnPassengerAt(world, start, offRoute.type);

        boardAt(world, train, start);

        expect(train.passengers).toContain(canRide.id);
        expect(train.passengers).not.toContain(cannotRide.id);
        expect(start.queue).toEqual([cannotRide.id]);
    });

    it("respects train capacity while boarding", () => {
        const world = createWorld(21, {
            ...createWorld(21).config,
            trainCapacity: 1,
        });
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

        const train = [...world.trains.values()][0]!;
        const first = spawnPassengerAt(world, start, target.type);
        const second = spawnPassengerAt(world, start, target.type);

        boardAt(world, train, start);

        expect(train.passengers).toEqual([first.id]);
        expect(start.queue).toEqual([second.id]);
    });

    it("delivers passengers at matching station type and deletes them", () => {
        const world = createWorld(22);
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

        const train = [...world.trains.values()][0]!;
        const passenger = spawnPassengerAt(world, start, target.type);
        boardAt(world, train, start);
        disembarkAt(world, train, target);

        expect(world.passengers.has(passenger.id)).toBe(false);
        expect(train.passengers).toEqual([]);
        expect(world.score).toBe(1);
        expect(world.deliveredCount).toBe(1);
    });

    it("keeps passengers on board at non-target stations on the same route", () => {
        const world = createWorld(25);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const wrongStop = world.stations.get(ids[1]!)!;
        const target = world.stations.get(ids[2]!)!;

        start.type = "circle";
        wrongStop.type = "square";
        target.type = "triangle";

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: wrongStop.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const train = [...world.trains.values()][0]!;
        const passenger = spawnPassengerAt(world, start, target.type);

        boardAt(world, train, start);
        disembarkAt(world, train, wrongStop);

        expect(world.passengers.has(passenger.id)).toBe(true);
        expect(world.passengers.get(passenger.id)?.state).toBe("riding");
        expect(train.passengers).toEqual([passenger.id]);
        expect(wrongStop.queue).toEqual([]);
        expect(world.score).toBe(0);
        expect(world.deliveredCount).toBe(0);
    });

    it("consumes train arrival events once", () => {
        const world = createWorld(23);
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

        const train = [...world.trains.values()][0]!;
        spawnPassengerAt(world, target, start.type);
        train.arrivedStationId = target.id;

        handleTrainArrivals(world);
        handleTrainArrivals(world);

        expect(train.arrivedStationId).toBeUndefined();
        expect(train.passengers.length).toBe(1);
        expect(target.queue).toEqual([]);
    });

    it("transfers passengers between lines when the target needs another route", () => {
        const world = createWorld(24);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const transfer = world.stations.get(ids[1]!)!;
        const target = world.stations.get(ids[2]!)!;

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: transfer.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: transfer.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const route1 = world.routes.get(1)!;
        const route2 = world.routes.get(2)!;
        const train1 = world.trains.get(route1.trainIds[0]!)!;
        const train2 = world.trains.get(route2.trainIds[0]!)!;
        const passenger = spawnPassengerAt(world, start, target.type);

        boardAt(world, train1, start);
        expect(train1.passengers).toEqual([passenger.id]);
        expect(start.queue).toEqual([]);

        disembarkAt(world, train1, transfer);
        expect(train1.passengers).toEqual([]);
        expect(world.passengers.get(passenger.id)?.state).toBe("waiting");
        expect(transfer.queue).toContain(passenger.id);

        boardAt(world, train2, transfer);
        expect(train2.passengers).toEqual([passenger.id]);
        expect(transfer.queue).not.toContain(passenger.id);

        disembarkAt(world, train2, target);
        expect(world.passengers.has(passenger.id)).toBe(false);
        expect(world.score).toBe(1);
    });

    it("routes passengers through two transfers", () => {
        const world = createWorld(26);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const transferA = world.stations.get(ids[1]!)!;
        const transferB = world.stations.get(ids[2]!)!;
        const target = world.stations.get(ids[3]!)!;

        start.type = "circle";
        transferA.type = "square";
        transferB.type = "triangle";
        target.type = "diamond";

        for (const stationId of [start.id, transferA.id])
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId,
            });
        applyRouteCommand(world, editor, { type: "commit-route" });
        for (const stationId of [transferA.id, transferB.id])
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId,
            });
        applyRouteCommand(world, editor, { type: "commit-route" });
        for (const stationId of [transferB.id, target.id])
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId,
            });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const train1 = world.trains.get(world.routes.get(1)!.trainIds[0]!)!;
        const train2 = world.trains.get(world.routes.get(2)!.trainIds[0]!)!;
        const train3 = world.trains.get(world.routes.get(3)!.trainIds[0]!)!;
        const passenger = spawnPassengerAt(world, start, target.type);

        boardAt(world, train1, start);
        disembarkAt(world, train1, transferA);
        expect(transferA.queue).toContain(passenger.id);

        boardAt(world, train2, transferA);
        disembarkAt(world, train2, transferB);
        expect(transferB.queue).toContain(passenger.id);

        boardAt(world, train3, transferB);
        disembarkAt(world, train3, target);
        expect(world.passengers.has(passenger.id)).toBe(false);
        expect(world.score).toBe(1);
    });

    it("marks unreachable passengers and clears that state after route edits make them reachable", () => {
        const world = createWorld(27);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const reachable = world.stations.get(ids[1]!)!;
        const target = world.stations.get(ids[2]!)!;

        start.type = "circle";
        reachable.type = "square";
        target.type = "triangle";

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: start.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: reachable.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const route1 = world.routes.get(1)!;
        const train1 = world.trains.get(route1.trainIds[0]!)!;
        const passenger = spawnPassengerAt(world, start, target.type);

        boardAt(world, train1, start);
        expect(train1.passengers).toEqual([]);
        expect(world.passengers.get(passenger.id)?.unreachable).toBe(true);

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: reachable.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: target.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        boardAt(world, train1, start);
        expect(train1.passengers).toEqual([passenger.id]);
        expect(world.passengers.get(passenger.id)?.unreachable).toBe(false);
    });
    it("ramps passenger spawn intervals downward with pressure", () => {
        const early = createWorld(70);
        const late = createWorld(70);
        late.time = 600;

        const earlyInterval = passengerInterval(early);
        const lateInterval = passengerInterval(late);

        expect(lateInterval).toBeLessThan(earlyInterval);
    });

});
