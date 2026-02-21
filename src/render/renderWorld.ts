import {
    createDebugRenderCache,
    renderDebug,
    type DebugRenderCache,
    type DebugStats,
} from "./renderDebug";
import {
    createRouteRenderCache,
    renderRoutes,
    type RouteRenderCache,
} from "./renderRoutes";
import {
    createStationRenderCache,
    renderStations,
    type StationRenderCache,
} from "./renderStations";
import {
    createTrainRenderCache,
    renderTrains,
    type TrainRenderCache,
} from "./renderTrains";
import { fullViewBox, type SvgViewBox } from "./viewBox";
import { draftRouteColor, type RouteEditor } from "../input/routeEditor";
import type { SvgRoot } from "./svgRoot";
import type { World } from "../sim/types";

declare const __SVG_METRO_PERF__: boolean;

const PERF_BUILD =
    typeof __SVG_METRO_PERF__ === "boolean" ? __SVG_METRO_PERF__ : true;

export interface SvgCache {
    routes: RouteRenderCache;
    stations: StationRenderCache;
    trains: TrainRenderCache;
    debug: DebugRenderCache;
}

export interface RenderMetrics {
    dirtyStationUpdates: number;
    routePathUpdates: number;
    trainTransformUpdates: number;
    queueRenderCount: number;
    passengerIconNodes: number;
}

export function createSvgCache(): SvgCache {
    return {
        routes: createRouteRenderCache(),
        stations: createStationRenderCache(),
        trains: createTrainRenderCache(),
        debug: PERF_BUILD ? createDebugRenderCache() : {},
    };
}

export function renderWorld(
    root: SvgRoot,
    world: World,
    cache: SvgCache,
    stats: DebugStats,
    editor: RouteEditor,
    sampleNodeCount = false,
    viewport: SvgViewBox = fullViewBox(world.config),
): void {
    const metrics: RenderMetrics = {
        dirtyStationUpdates: 0,
        routePathUpdates: 0,
        trainTransformUpdates: 0,
        queueRenderCount: 0,
        passengerIconNodes: 0,
    };

    metrics.routePathUpdates = renderRoutes(
        root.layers.routes,
        root.layers.routePreview,
        world,
        editor,
        cache.routes,
    );
    const stationMetrics = renderStations(
        root.layers.stations,
        world,
        cache.stations,
        stats.selectedStationId,
        editor.previewStationId,
        editor.invalidStationId,
        editor.draftStationIds,
        draftRouteColor(world),
    );
    metrics.dirtyStationUpdates = stationMetrics.dirtyStationUpdates;
    metrics.queueRenderCount = stationMetrics.queueRenderCount;
    metrics.passengerIconNodes = stationMetrics.passengerIconNodes;
    metrics.trainTransformUpdates = renderTrains(
        root.layers.trains,
        world,
        cache.trains,
        cache.routes.routeNodes,
    );
    stats.renderMetrics = metrics;

    if (PERF_BUILD && sampleNodeCount) {
        stats.nodeCount = root.svg.querySelectorAll("*").length;
    }

    if (PERF_BUILD) {
        renderDebug(root.layers.debug, world, stats, cache.debug, viewport);
    }
}
