import {
    defaultConfig,
    type Passenger,
    type Route,
    type Station,
    type Train,
    type World,
    type WorldConfig,
    type WorldDebug,
} from "../sim/types";

export const SAVE_VERSION = 1;

export interface SaveData {
    version: number;
    savedAt: string;
    world: {
        time: number;
        tick: number;
        seed: number;
        score: number;
        deliveredCount: number;
        gameOver: boolean;
        failedStationId?: number;
        stationSpawnCooldown: number;
        nextStationId: number;
        nextPassengerId: number;
        nextRouteId: number;
        nextTrainId: number;
        rngState: number;
        config: WorldConfig;
        debug: WorldDebug;
        stations: Station[];
        passengers: Passenger[];
        routes: Route[];
        trains: Train[];
    };
}

export function serializeWorld(world: World): SaveData {
    return {
        version: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        world: {
            time: world.time,
            tick: world.tick,
            seed: world.seed,
            score: world.score,
            deliveredCount: world.deliveredCount,
            gameOver: world.gameOver,
            failedStationId: world.failedStationId,
            stationSpawnCooldown: world.stationSpawnCooldown,
            nextStationId: world.nextStationId,
            nextPassengerId: world.nextPassengerId,
            nextRouteId: world.nextRouteId,
            nextTrainId: world.nextTrainId,
            rngState: world.rng.state,
            config: { ...world.config },
            debug: { ...world.debug },
            stations: [...world.stations.values()].map((station) => ({
                ...station,
                queue: [...station.queue],
                dirtyQueue: false,
                dirtyVisual: false,
            })),
            passengers: [...world.passengers.values()].map((passenger) => ({
                ...passenger,
            })),
            routes: [...world.routes.values()].map((route) => ({
                ...route,
                stationIds: [...route.stationIds],
                trainIds: [...route.trainIds],
                dirtyPath: false,
            })),
            trains: [...world.trains.values()].map((train) => ({
                ...train,
                passengers: [...train.passengers],
            })),
        },
    };
}

export function deserializeWorld(save: SaveData): World {
    if (save.version !== SAVE_VERSION) {
        throw new Error(`Unsupported save version ${save.version}`);
    }

    const config = { ...defaultConfig, ...save.world.config };
    const world: World = {
        time: save.world.time,
        tick: save.world.tick,
        seed: save.world.seed,
        score: save.world.score,
        deliveredCount: save.world.deliveredCount,
        gameOver: save.world.gameOver,
        failedStationId: save.world.failedStationId,
        stationSpawnCooldown: save.world.stationSpawnCooldown,
        stations: new Map(),
        passengers: new Map(),
        routes: new Map(),
        trains: new Map(),
        nextStationId: save.world.nextStationId,
        nextPassengerId: save.world.nextPassengerId,
        nextRouteId: save.world.nextRouteId,
        nextTrainId: save.world.nextTrainId,
        rng: { state: save.world.rngState >>> 0 },
        config,
        debug: {
            renderAllPassengers: save.world.debug.renderAllPassengers,
            dirtyRendering: save.world.debug.dirtyRendering,
            useSvgGeometry: save.world.debug.useSvgGeometry ?? false,
        },
    };

    for (const station of save.world.stations) {
        world.stations.set(station.id, {
            ...station,
            queue: [...station.queue],
            dirtyQueue: true,
            dirtyVisual: true,
        });
    }

    for (const passenger of save.world.passengers) {
        world.passengers.set(passenger.id, { ...passenger });
    }

    for (const route of save.world.routes) {
        world.routes.set(route.id, {
            ...route,
            stationIds: [...route.stationIds],
            trainIds: [...route.trainIds],
            dirtyPath: true,
        });
    }

    for (const train of save.world.trains) {
        world.trains.set(train.id, {
            ...train,
            passengers: [...train.passengers],
        });
    }

    return world;
}

export function encodeWorld(world: World): string {
    return JSON.stringify(serializeWorld(world));
}

export function decodeWorld(json: string): World {
    return deserializeWorld(JSON.parse(json) as SaveData);
}
