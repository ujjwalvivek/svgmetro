import { describe, expect, it } from "vitest";
import { applyRouteCommand, createRouteEditor } from "../input/routeEditor";
import { tick } from "../sim/tick";
import { createWorld } from "../sim/world";
import {
    encodeBootMetadata,
    loadWorldFromMetadataText,
    SVG_BOOT_VERSION,
} from "./svgMetadata";
import { encodeWorld } from "./worldState";

describe("SVG metadata", () => {
    it("boots a deterministic world from seed metadata", () => {
        const world = loadWorldFromMetadataText(encodeBootMetadata(1234));

        expect(world.seed).toBe(1234);
        expect(world.tick).toBe(0);
        expect(world.stations.size).toBe(world.config.initialStations);
    });

    it("resumes an encoded world instead of starting over", () => {
        const world = createWorld(5678);
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
        tick(world, 1 / 60);

        const restored = loadWorldFromMetadataText(encodeWorld(world));

        expect(restored.seed).toBe(5678);
        expect(restored.tick).toBe(world.tick);
        expect(restored.routes.size).toBe(1);
        expect(restored.trains.size).toBe(1);
    });

    it("keeps boot metadata small and explicit", () => {
        const boot = JSON.parse(encodeBootMetadata(90)) as {
            version: number;
            seed: number;
            world?: unknown;
        };

        expect(boot).toEqual({ version: SVG_BOOT_VERSION, seed: 90 });
        expect(boot.world).toBeUndefined();
    });
});
