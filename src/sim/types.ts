export type StationId = number;
export type RouteId = number;
export type TrainId = number;
export type PassengerId = number;

export type StationType = "circle" | "square" | "triangle" | "diamond" | "star";

export interface Station {
    id: StationId;
    type: StationType;
    x: number;
    y: number;
    queue: PassengerId[];
    overcrowd: number;
    spawnCooldown: number;
    discoveredAt: number;
    dirtyQueue: boolean;
    dirtyVisual: boolean;
}

export interface Passenger {
    id: PassengerId;
    from: StationId;
    targetType: StationType;
    state: "waiting" | "riding" | "delivered";
    stationId?: StationId;
    trainId?: TrainId;
    unreachable?: boolean;
    spawnedAt: number;
}

export interface Route {
    id: RouteId;
    color: string;
    stationIds: StationId[];
    trainIds: TrainId[];
    closed: boolean;
    dirtyPath: boolean;
}

export interface Train {
    id: TrainId;
    routeId: RouteId;
    segmentIndex: number;
    direction: 1 | -1;
    t: number;
    speed: number;
    capacity: number;
    passengers: PassengerId[];
    arrivedStationId?: StationId;
}

export interface RngState {
    state: number;
}

export interface World {
    time: number;
    tick: number;
    seed: number;
    score: number;
    deliveredCount: number;
    gameOver: boolean;
    failedStationId?: StationId;
    stationSpawnCooldown: number;
    stations: Map<StationId, Station>;
    passengers: Map<PassengerId, Passenger>;
    routes: Map<RouteId, Route>;
    trains: Map<TrainId, Train>;
    nextStationId: number;
    nextPassengerId: number;
    nextRouteId: number;
    nextTrainId: number;
    rng: RngState;
    config: WorldConfig;
    debug: WorldDebug;
}

export interface WorldDebug {
    renderAllPassengers: boolean;
    dirtyRendering: boolean;
    useSvgGeometry: boolean;
}

export interface WorldConfig {
    mapWidth: number;
    mapHeight: number;
    margin: number;
    initialStations: number;
    maxStations: number;
    trainSpeed: number;
    trainCapacity: number;
    passengerSpawnMin: number;
    passengerSpawnMax: number;
    stationSpawnInitial: number;
    stationSpawnMin: number;
    queueLimit: number;
    queueWarning: number;
    overcrowdLimit: number;
    overcrowdRecoveryRate: number;
}

export const defaultConfig: WorldConfig = {
    mapWidth: 1440,
    mapHeight: 810,
    margin: 88,
    initialStations: 10,
    maxStations: 40,
    trainSpeed: 120,
    trainCapacity: 8,
    passengerSpawnMin: 14,
    passengerSpawnMax: 24,
    stationSpawnInitial: 55,
    stationSpawnMin: 28,
    queueLimit: 18,
    queueWarning: 24,
    overcrowdLimit: 54,
    overcrowdRecoveryRate: 4,
};
