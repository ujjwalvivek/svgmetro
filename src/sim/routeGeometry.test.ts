import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import {
    routeSegmentLength,
    routeSegmentPosition,
    routeToPolyline,
} from "./routeGeometry";
import { createWorld } from "./world";

describe("route geometry", () => {
    it("projects diagonal station pairs onto metro-map doglegs", () => {
        const world = createWorld(90);
        const stations = [...world.stations.values()];
        const a = stations[0]!;
        const b = stations[1]!;

        a.x = 100;
        a.y = 100;
        b.x = 300;
        b.y = 220;

        const route = {
            id: 1,
            color: "#e8442e",
            stationIds: [a.id, b.id],
            trainIds: [],
            closed: false,
            dirtyPath: true,
        };

        const points = routeToPolyline(world, route.stationIds);

        expect(points).toEqual([
            { x: 100, y: 100 },
            { x: 220, y: 220 },
            { x: 300, y: 220 },
        ]);
        expect(routeSegmentLength(world, route, 0)).toBeCloseTo(
            Math.hypot(120, 120) + 80,
        );
    });

    it("positions trains on the same dogleg used by the route path", () => {
        const world = createWorld(91);
        const editor = createRouteEditor();
        const stations = [...world.stations.values()];
        const a = stations[0]!;
        const b = stations[1]!;

        a.x = 100;
        a.y = 100;
        b.x = 300;
        b.y = 220;

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: a.id,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: b.id,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const route = [...world.routes.values()][0]!;
        const tAtBend =
            Math.hypot(120, 120) / routeSegmentLength(world, route, 0);
        const position = routeSegmentPosition(world, route, 0, 1, tAtBend)!;

        expect(position.x).toBeCloseTo(220);
        expect(position.y).toBeCloseTo(220);
        expect(position.angle).toBeCloseTo(45);
    });
});
