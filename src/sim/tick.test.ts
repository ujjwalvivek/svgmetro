import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import { createWorld } from "./world";
import { tick } from "./tick";

describe("tick", () => {
    it("keeps trains moving after game over", () => {
        const world = createWorld(90);
        const editor = createRouteEditor();
        const stationIds = [...world.stations.keys()];

        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: stationIds[0]!,
        });
        applyRouteCommand(world, editor, {
            type: "append-station",
            stationId: stationIds[1]!,
        });
        applyRouteCommand(world, editor, { type: "commit-route" });

        const train = [...world.trains.values()][0]!;
        const startT = train.t;

        world.gameOver = true;
        tick(world, 0.5);

        expect(train.t).not.toBe(startT);
        expect(world.tick).toBe(0);
    });
});
