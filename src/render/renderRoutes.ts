import { setAttrs, svgEl } from "./svgElements";
import { draftRouteColor, type RouteEditor } from "../input/routeEditor";
import { routeToPolyline, type RoutePoint } from "../sim/routeGeometry";
import type { RouteId, StationId, World } from "../sim/types";

export interface RouteRenderCache {
    routeNodes: Map<RouteId, SVGPathElement>;
    draftRails?: [SVGPathElement, SVGPathElement];
}

export function createRouteRenderCache(): RouteRenderCache {
    return {
        routeNodes: new Map(),
    };
}

export function renderRoutes(
    routesLayer: SVGGElement,
    previewLayer: SVGGElement,
    world: World,
    editor: RouteEditor,
    cache: RouteRenderCache,
): number {
    const seen = new Set<RouteId>();
    let pathUpdates = 0;

    for (const route of world.routes.values()) {
        seen.add(route.id);
        let node = cache.routeNodes.get(route.id);
        const isNew = !node;

        if (!node) {
            node = svgEl("path", {
                class: "route-path",
                "data-route-id": route.id,
            });
            cache.routeNodes.set(route.id, node);
            routesLayer.append(node);
        }

        if (isNew || route.dirtyPath) {
            setAttrs(node, {
                d: routeToPath(world, route.stationIds),
                stroke: route.color,
            });
            route.dirtyPath = false;
            pathUpdates += 1;
        }

        node.classList.toggle("is-active", route.id === editor.activeRouteId);
        node.classList.toggle("is-hovered", route.id === editor.hoverRouteId);
    }

    for (const [id, node] of cache.routeNodes) {
        if (seen.has(id)) continue;
        node.remove();
        cache.routeNodes.delete(id);
    }

    renderDraftRoute(previewLayer, world, editor, cache);
    return pathUpdates;
}

export function routeToPath(world: World, stationIds: StationId[]): string {
    return pointsToPath(routeToPolyline(world, stationIds));
}

function pointsToPath(points: RoutePoint[]): string {
    return points
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" ");
}

function renderDraftRoute(
    previewLayer: SVGGElement,
    world: World,
    editor: RouteEditor,
    cache: RouteRenderCache,
): void {
    if (!cache.draftRails) {
        cache.draftRails = [
            svgEl("path", { class: "route-preview-rail" }),
            svgEl("path", { class: "route-preview-rail" }),
        ];
        previewLayer.append(...cache.draftRails);
    }

    const stationIds = [...editor.draftStationIds];
    if (
        editor.previewStationId !== undefined &&
        stationIds.length > 0 &&
        !stationIds.includes(editor.previewStationId) &&
        world.stations.has(editor.previewStationId)
    ) {
        stationIds.push(editor.previewStationId);
    }

    const visible = stationIds.length >= 2;
    const points = visible ? routeToPolyline(world, stationIds) : [];
    const color = draftRouteColor(world);
    const rails = visible
        ? [offsetPolyline(points, -3.25), offsetPolyline(points, 3.25)]
        : [[], []];

    cache.draftRails.forEach((rail, index) => {
        setAttrs(rail, {
            d: pointsToPath(rails[index]!),
            stroke: color,
        });
    });
}

function offsetPolyline(points: RoutePoint[], offset: number): RoutePoint[] {
    return points.map((point, index) => {
        const previous = points[index - 1];
        const next = points[index + 1];
        const normalA = previous ? segmentNormal(previous, point) : undefined;
        const normalB = next ? segmentNormal(point, next) : undefined;
        const normal = averageNormal(normalA, normalB);

        return {
            x: point.x + normal.x * offset,
            y: point.y + normal.y * offset,
        };
    });
}

function segmentNormal(a: RoutePoint, b: RoutePoint): RoutePoint {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));

    return {
        x: -dy / length,
        y: dx / length,
    };
}

function averageNormal(
    a: RoutePoint | undefined,
    b: RoutePoint | undefined,
): RoutePoint {
    if (!a && !b) return { x: 0, y: 0 };
    if (!a) return b!;
    if (!b) return a;

    const x = a.x + b.x;
    const y = a.y + b.y;
    const length = Math.hypot(x, y);
    if (length < 0.001) return b;

    return {
        x: x / length,
        y: y / length,
    };
}
