import type { Route, RouteId, StationId, StationType, World } from "./types";

interface RouteGraphCache {
    signature: string;
    edges: Map<StationId, Array<{ stationId: StationId; routeId: RouteId }>>;
}

const routeGraphCaches = new WeakMap<World, RouteGraphCache>();

export function routeCanServe(
    world: World,
    route: Route,
    targetType: StationType,
): boolean {
    return route.stationIds.some(
        (id) => world.stations.get(id)?.type === targetType,
    );
}

export function nextRouteToTarget(
    world: World,
    fromStationId: StationId,
    targetType: StationType,
): RouteId | undefined {
    const from = world.stations.get(fromStationId);
    if (!from || from.type === targetType) return undefined;

    const visited = new Set<StationId>([fromStationId]);
    const queue: Array<{ stationId: StationId; firstRouteId?: RouteId }> = [
        { stationId: fromStationId },
    ];
    const graph = routeGraph(world);

    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index]!;

        for (const edge of graph.get(current.stationId) ?? []) {
            if (visited.has(edge.stationId)) continue;

            const firstRouteId = current.firstRouteId ?? edge.routeId;
            const station = world.stations.get(edge.stationId);
            if (!station) continue;

            if (station.type === targetType) return firstRouteId;

            visited.add(edge.stationId);
            queue.push({ stationId: edge.stationId, firstRouteId });
        }
    }

    return undefined;
}

export function routeReachabilityCounts(world: World): {
    reachable: number;
    unreachable: number;
} {
    let reachable = 0;
    let unreachable = 0;

    for (const passenger of world.passengers.values()) {
        if (
            passenger.state === "delivered" ||
            passenger.stationId === undefined
        )
            continue;

        const station = world.stations.get(passenger.stationId);
        const canReach =
            station?.type === passenger.targetType ||
            nextRouteToTarget(
                world,
                passenger.stationId,
                passenger.targetType,
            ) !== undefined;
        if (canReach) reachable += 1;
        else unreachable += 1;
    }

    return { reachable, unreachable };
}

export function invalidateRouteGraph(world: World): void {
    routeGraphCaches.delete(world);
}

function routeGraph(
    world: World,
): Map<StationId, Array<{ stationId: StationId; routeId: RouteId }>> {
    const signature = routeSignature(world);
    const cached = routeGraphCaches.get(world);
    if (cached?.signature === signature) return cached.edges;

    const edges = new Map<
        StationId,
        Array<{ stationId: StationId; routeId: RouteId }>
    >();

    for (const route of world.routes.values()) {
        route.stationIds.forEach((candidateId, index) => {
            const previous = route.stationIds[index - 1];
            const next = route.stationIds[index + 1];

            if (previous !== undefined)
                addEdge(edges, candidateId, previous, route.id);
            if (next !== undefined) addEdge(edges, candidateId, next, route.id);
        });
    }

    routeGraphCaches.set(world, { signature, edges });
    return edges;
}

function addEdge(
    edges: Map<StationId, Array<{ stationId: StationId; routeId: RouteId }>>,
    from: StationId,
    to: StationId,
    routeId: RouteId,
): void {
    const stationEdges = edges.get(from) ?? [];
    stationEdges.push({ stationId: to, routeId });
    edges.set(from, stationEdges);
}

function routeSignature(world: World): string {
    return [...world.routes.values()]
        .map((route) => `${route.id}:${route.stationIds.join(",")}`)
        .join("|");
}
