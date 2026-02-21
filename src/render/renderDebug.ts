import { svgEl } from "./svgElements";
import { fullViewBox, viewBoxScale, type SvgViewBox } from "./viewBox";
import type { RenderMetrics } from "./renderWorld";
import type { World } from "../sim/types";
import { routeReachabilityCounts } from "../sim/routing";

export interface DebugStats {
    fps: number;
    frameMs: number;
    p95FrameMs: number;
    nodeCount: number;
    selectedStationId?: number;
    lastCommand: string;
    draftStations: number;
    renderMetrics?: RenderMetrics;
}

export interface DebugRenderCache {
    group?: SVGGElement;
    lines?: SVGTextElement[];
}

export function createDebugRenderCache(): DebugRenderCache {
    return {};
}

export function renderDebug(
    layer: SVGGElement,
    world: World,
    stats: DebugStats,
    cache: DebugRenderCache,
    viewport: SvgViewBox = fullViewBox(world.config),
): void {
    const scale = viewBoxScale(world.config, viewport);

    if (!cache.group) {
        cache.group = svgEl("g", {
            class: "debug-window",
            transform: debugTransform(viewport, scale),
        });
        const panel = svgEl("rect", {
            class: "debug-panel",
            width: 410,
            height: 138,
        });
        cache.lines = Array.from({ length: 8 }, (_, index) =>
            svgEl("text", {
                class: index === 0 ? "debug-title" : "debug-text",
                x: 14,
                y: 24 + index * 15,
            }),
        );
        cache.lines[0]!.textContent = "DEBUG";
        cache.group.append(panel, ...cache.lines);
        layer.append(cache.group);
    }

    cache.group.setAttribute("transform", debugTransform(viewport, scale));

    const reachability = routeReachabilityCounts(world);
    const metrics = stats.renderMetrics;
    const lines = [
        "DEBUG",
        `perf   fps ${stats.fps.toFixed(0)}  frame ${stats.frameMs.toFixed(2)}ms  p95 ${stats.p95FrameMs.toFixed(2)}ms  nodes ${stats.nodeCount}`,
        `world  hash ${stateHash(world)}  seed ${world.seed}  tick ${world.tick}  state ${world.gameOver ? "over" : "run"}`,
        `net    stations ${world.stations.size}  lines ${world.routes.size}  trains ${world.trains.size}  next station ${Math.ceil(world.stationSpawnCooldown)}s`,
        `load   waiting ${waitingPassengers(world)}  riding ${ridingPassengers(world)}  reachable ${reachability.reachable}  blocked ${reachability.unreachable}`,
        `draw   queues ${metrics?.queueRenderCount ?? 0}  station dirty ${metrics?.dirtyStationUpdates ?? 0}  routes ${metrics?.routePathUpdates ?? 0}  trains ${metrics?.trainTransformUpdates ?? 0}`,
        `dom    passenger icons ${metrics?.passengerIconNodes ?? 0}  allpax ${world.debug.renderAllPassengers ? "on" : "off"}  dirty ${world.debug.dirtyRendering ? "on" : "off"}`,
        `edit   draft ${stats.draftStations}  selected ${stats.selectedStationId ?? "-"}  geom ${world.debug.useSvgGeometry ? "svg" : "sim"}  last ${stats.lastCommand}`,
    ];

    cache.lines?.forEach((line, index) => {
        line.textContent = lines[index] ?? "";
    });
}

function debugTransform(viewport: SvgViewBox, scale: number): string {
    return `translate(${viewport.x + 24 * scale} ${viewport.y + viewport.height - 184 * scale}) scale(${scale})`;
}

function waitingPassengers(world: World): number {
    let count = 0;

    for (const passenger of world.passengers.values()) {
        if (passenger.state === "waiting") count += 1;
    }

    return count;
}

function ridingPassengers(world: World): number {
    let count = 0;

    for (const passenger of world.passengers.values()) {
        if (passenger.state === "riding") count += 1;
    }

    return count;
}

function stateHash(world: World): string {
    let hash = 2166136261;
    const parts = [
        world.seed,
        world.tick,
        world.score,
        world.stations.size,
        world.routes.size,
        world.trains.size,
        world.passengers.size,
        world.nextStationId,
        world.nextRouteId,
    ];

    for (const value of parts) {
        hash ^= value >>> 0;
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36).slice(0, 6);
}
