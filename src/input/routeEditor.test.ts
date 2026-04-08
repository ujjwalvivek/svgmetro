import { describe, expect, it } from "vitest";
import { boardAt, spawnPassengerAt } from "../sim/passengers";
import { createWorld } from "../sim/world";
import { applyRouteCommand, createRouteEditor } from "./routeEditor";

describe("route editor", () => {
    it("builds and commits a route from clicked stations", () => {
        const world = createWorld(1);
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
        const committed = applyRouteCommand(world, editor, {
            type: "commit-route",
        });

        expect(committed).toBe(true);
        expect(world.routes.size).toBe(1);
        expect([...world.routes.values()][0]?.stationIds).toEqual([
            ids[0],
            ids[1],
        ]);
        expect(world.trains.size).toBe(1);
        expect(editor.draftStationIds).toEqual([]);
    });

    it("rejects duplicate stations in the MVP route", () => {
        const world = createWorld(2);
        const editor = createRouteEditor();
        const stationId = [...world.stations.keys()][0]!;

        expect(
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId,
            }),
        ).toBe(true);
        expect(
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId,
            }),
        ).toBe(false);
        expect(editor.draftStationIds).toEqual([stationId]);
        expect(editor.invalidStationId).toBe(stationId);
    });

    it("clears invalid target feedback after a valid station is appended", () => {
        const world = createWorld(43);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[0]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[0]!,
        });
        expect(editor.invalidStationId).toBe(ids[0]);

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[1]!,
        });
        expect(editor.invalidStationId).toBeUndefined();
        expect(editor.draftStationIds).toEqual([ids[0], ids[1]]);
    });

    it("starts a new draft line after a route is committed", () => {
        const world = createWorld(33);
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

        expect(
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId: ids[2]!,
            }),
        ).toBe(true);
        expect(editor.draftStationIds).toEqual([ids[2]]);
        expect([...world.routes.values()][0]?.stationIds).toEqual([
            ids[0],
            ids[1],
        ]);
    });

    it("commits multiple independent routes", () => {
        const world = createWorld(36);
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
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[2]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[3]!,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        expect(world.routes.size).toBe(2);
        expect(world.trains.size).toBe(2);
        expect(
            [...world.routes.values()].map((route) => route.stationIds),
        ).toEqual([
            [ids[0], ids[1]],
            [ids[2], ids[3]],
        ]);
    });

    it("selects an existing route without mutating drafts", () => {
        const world = createWorld(37);
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
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[2]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[3]!,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        expect(
            applyRouteCommand(world, editor, {
                type: "select-route",
                routeId: 1,
            }),
        ).toBe(true);
        expect(editor.activeRouteId).toBe(1);
        expect(editor.hoverRouteId).toBe(1);
        expect(editor.draftStationIds).toEqual([]);
    });

    it("deletes the selected route", () => {
        const world = createWorld(38);
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
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[2]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[3]!,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });
        applyRouteCommand(world, editor, { type: "select-route", routeId: 1 });

        expect(applyRouteCommand(world, editor, { type: "reset-route" })).toBe(
            true,
        );
        expect(world.routes.has(1)).toBe(false);
        expect(world.routes.has(2)).toBe(true);
        expect(world.routes.size).toBe(1);
        expect(world.trains.size).toBe(1);
    });

    it("cancels a draft instead of deleting the selected route", () => {
        const world = createWorld(39);
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
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: ids[2]!,
        });

        expect(applyRouteCommand(world, editor, { type: "reset-route" })).toBe(
            true,
        );
        expect(world.routes.size).toBe(1);
        expect(world.trains.size).toBe(1);
        expect(world.stations.has(ids[0]!)).toBe(true);
        expect(world.stations.has(ids[1]!)).toBe(true);
        expect(world.stations.has(ids[2]!)).toBe(true);
        expect(editor.draftStationIds).toEqual([]);
        expect(editor.activeRouteId).toBe(1);
    });

    it("deleting a selected route does not delete its stations", () => {
        const world = createWorld(42);
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
        applyRouteCommand(world, editor, { type: "reset-route" });

        expect(world.routes.size).toBe(0);
        expect(world.trains.size).toBe(0);
        expect(world.stations.has(ids[0]!)).toBe(true);
        expect(world.stations.has(ids[1]!)).toBe(true);
    });

    it("resets the active route and draft", () => {
        const world = createWorld(3);
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

        expect(applyRouteCommand(world, editor, { type: "reset-route" })).toBe(
            true,
        );
        expect(world.routes.size).toBe(0);
        expect(world.trains.size).toBe(0);
        expect(editor.draftStationIds).toEqual([]);
        expect(editor.activeRouteId).toBeUndefined();
    });

    it("returns riding passengers to queues when a route resets", () => {
        const world = createWorld(4);
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

        expect(train.passengers).toEqual([passenger.id]);

        applyRouteCommand(world, editor, { type: "reset-route" });

        expect(world.trains.size).toBe(0);
        expect(world.passengers.get(passenger.id)?.state).toBe("waiting");
        expect(start.queue).toEqual([passenger.id]);
    });

    it("boards waiting passengers at route start when committed", () => {
        const world = createWorld(35);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const start = world.stations.get(ids[0]!)!;
        const target = world.stations.get(ids[1]!)!;
        const passenger = spawnPassengerAt(world, start, target.type);

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
        expect(train.passengers).toEqual([passenger.id]);
        expect(start.queue).toEqual([]);
    });
    it("blocks commits when no line budget remains", () => {
        const base = createWorld(61).config;
        const world = createWorld(61, {
            ...base,
            startingLines: 1,
            maxLines: 1,
        });
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];

        for (const pair of [[ids[0]!, ids[1]!], [ids[2]!, ids[3]!]] as const) {
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId: pair[0],
            });
            applyRouteCommand(world, editor, {
                type: "append-station",
                stationId: pair[1],
            });
            applyRouteCommand(world, editor, { type: "commit-route" });
        }

        expect(world.routes.size).toBe(1);
        expect(world.trains.size).toBe(1);
        expect(editor.lastCommand).toBe("no-lines");
    });

    it("blocks duplicate route commits without spending a line", () => {
        const world = createWorld(62);
        const editor = createRouteEditor();
        const ids = [...world.stations.keys()];
        const a = ids[0]!;
        const b = ids[1]!;

        applyRouteCommand(world, editor, { type: "append-station", stationId: a });
        applyRouteCommand(world, editor, { type: "append-station", stationId: b });
        applyRouteCommand(world, editor, { type: "commit-route" });

        applyRouteCommand(world, editor, { type: "append-station", stationId: b });
        applyRouteCommand(world, editor, { type: "append-station", stationId: a });
        applyRouteCommand(world, editor, { type: "commit-route" });

        expect(world.routes.size).toBe(1);
        expect(world.trains.size).toBe(1);
        expect(editor.lastCommand).toBe("duplicate-route");
    });

});
