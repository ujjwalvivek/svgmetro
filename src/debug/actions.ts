import { spawnPassengerAt } from "../sim/passengers";
import { randInt } from "../sim/rng";
import { invalidateRouteGraph } from "../sim/routing";
import { createTrainForRoute, distributeRouteTrains } from "../sim/trains";
import type { Route, Station, StationId, World, WorldDebug } from "../sim/types";
import { spawnStation } from "../sim/world";

const ROUTE_COLORS = [
    "#e8442e",
    "#11a8d8",
    "#f4c400",
    "#08864a",
    "#cf5574",
    "#a45f37",
    "#24aaa6",
] as const;

export type DebugAction =
    | "stress-test"
    | "stress-passengers"
    | "stress-stations"
    | "stress-routes";

export function applyDebugAction(world: World, action: DebugAction): void {
    switch (action) {
        case "stress-test":
            spawnStations(world, 10);
            spawnPaths(world, 20);
            spawnPassengers(world, 250);
            const debug = ensureDebug(world);
            debug.renderAllPassengers = false;
            debug.dirtyRendering = true;
            debug.useSvgGeometry = false;
            world.gameOver = false;
            world.failedStationId = undefined;
            for (const station of world.stations.values()) {
                station.overcrowd = 0;
                station.dirtyQueue = true;
                station.dirtyVisual = true;
            }
            return;
        case "stress-passengers":
            spawnPassengers(world, 250);
            return;
        case "stress-stations":
            spawnStations(world, 10);
            return;
        case "stress-routes":
            spawnPaths(world, 20);
            return;
    }
}

function ensureDebug(world: World): WorldDebug {
    world.debug ??= {
        renderAllPassengers: false,
        dirtyRendering: true,
        useSvgGeometry: false,
    };
    return world.debug;
}

function spawnPassengers(world: World, count: number): void {
    const stations = [...world.stations.values()];
    if (stations.length === 0) return;

    for (let index = 0; index < count; index += 1) {
        const station = stations[randInt(world.rng, 0, stations.length)]!;
        spawnPassengerAt(world, station);
    }
}

function spawnStations(world: World, count: number): void {
    for (let index = 0; index < count; index += 1) {
        if (!spawnStation(world)) return;
    }
}

function spawnPaths(world: World, count: number): void {
    const stations = [...world.stations.values()];
    if (stations.length < 2) return;

    for (let index = 0; index < count; index += 1) {
        const route = createDebugRoute(
            world,
            createNearbyPath(world, stations),
        );
        createTrainForRoute(world, route);
        distributeRouteTrains(world, route);
    }
}

function createDebugRoute(world: World, stationIds: StationId[]): Route {
    const route: Route = {
        id: world.nextRouteId,
        color: ROUTE_COLORS[(world.nextRouteId - 1) % ROUTE_COLORS.length]!,
        stationIds,
        trainIds: [],
        closed: false,
        dirtyPath: true,
    };

    world.nextRouteId += 1;
    world.routes.set(route.id, route);
    invalidateRouteGraph(world);
    return route;
}

function createNearbyPath(world: World, stations: Station[]): StationId[] {
    const length = Math.min(stations.length, randInt(world.rng, 2, 5));
    const start = stations[randInt(world.rng, 0, stations.length)]!;
    const path = [start];

    while (path.length < length) {
        const current = path[path.length - 1]!;
        const used = new Set(path.map((station) => station.id));
        const candidates = stations
            .filter((station) => !used.has(station.id))
            .sort(
                (a, b) =>
                    stationDistance(current, a) - stationDistance(current, b),
            );

        if (candidates.length === 0) break;

        const nearestWindow = candidates.slice(
            0,
            Math.min(4, candidates.length),
        );
        path.push(nearestWindow[randInt(world.rng, 0, nearestWindow.length)]!);
    }

    return path.map((station) => station.id);
}

function stationDistance(a: Station, b: Station): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
