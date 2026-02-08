import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import { routeSegmentLength } from "./routeGeometry";
import { createWorld } from "./world";
import { moveTrain, trainDistanceAlongRoute, trainPosition } from "./trains";

describe("trains", () => {
    it("moves along a committed route", () => {
        const world = createWorld(10);
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

        const train = [...world.trains.values()][0]!;
        const before = trainPosition(world, train)!;
        moveTrain(world, train, 1);
        const after = trainPosition(world, train)!;

        expect(after.x).not.toBe(before.x);
        expect(after.y).not.toBe(before.y);
    });

    it("reverses at route ends", () => {
        const world = createWorld(11);
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

        const train = [...world.trains.values()][0]!;
        const route = [...world.routes.values()][0]!;
        moveTrain(
            world,
            train,
            routeSegmentLength(world, route, 0) / train.speed + 0.01,
        );

        expect(train.segmentIndex).toBeGreaterThanOrEqual(0);
        expect(train.segmentIndex).toBeLessThanOrEqual(1);
        expect(train.direction).toBe(-1);
        expect(train.arrivedStationId).toBe(ids[1]);
    });

    it("reports distance along route for forward and backward trains", () => {
        const world = createWorld(12);
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

        const train = [...world.trains.values()][0]!;
        train.t = 0.5;

        expect(trainDistanceAlongRoute(world, train)).toBeGreaterThan(0);

        const route = [...world.routes.values()][0]!;
        moveTrain(
            world,
            train,
            routeSegmentLength(world, route, 0) / train.speed + 0.01,
        );

        expect(train.direction).toBe(-1);
        expect(trainDistanceAlongRoute(world, train)).toBeGreaterThan(0);
    });
});
