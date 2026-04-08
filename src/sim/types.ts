export type StationId = number;
export type RouteId = number;
export type TrainId = number;
export type PassengerId = number;

export type StationType = "circle" | "square" | "triangle" | "diamond" | "star";
export type DifficultyName = "normal" | "hard" | "brutal";

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
    // keeps new stations away from hard edges.
    margin: number;
    initialStations: number;
    maxStations: number;
    // SVG units per second.
    trainSpeed: number;
    trainCapacity: number;
    // Early-game passenger spawn interval range in seconds.
    passengerSpawnMin: number;
    passengerSpawnMax: number;
    // Late-game spawn interval range after pressure ramp finishes.
    passengerSpawnLateMin: number;
    passengerSpawnLateMax: number;
    // First station-growth delay in seconds.
    stationSpawnInitial: number;
    // Fastest station-growth delay once the map has ramped up.
    stationSpawnMin: number;
    // Queue length where station pressure starts to accumulate.
    queueLimit: number;
    // Queue length treated as a visible warning threshold.
    queueWarning: number;
    // Overcrowd meter value that ends the game.
    overcrowdLimit: number;
    // Per-second pressure decay when a station is under control.
    overcrowdRecoveryRate: number;
    // Multiplier for queue-driven overcrowd growth.
    overcrowdGrowthRate: number;
    // Extra pressure multiplier for passengers with no reachable route.
    unreachableCongestionRate: number;
    // Seconds before diamond stations can spawn.
    diamondUnlockAt: number;
    // Seconds before star stations can spawn.
    starUnlockAt: number;
    startingLines: number;
    lineRewardEveryStations: number;
    maxLines: number;
    difficulty: DifficultyName;
}

const baseConfig = {
    mapWidth: 1440,
    mapHeight: 810,
    margin: 88,
    initialStations: 10,
    maxStations: 48,
    trainSpeed: 110,
    trainCapacity: 6,
    passengerSpawnMin: 6,
    passengerSpawnMax: 9,
    passengerSpawnLateMin: 2.2,
    passengerSpawnLateMax: 4.2,
    stationSpawnInitial: 28,
    stationSpawnMin: 12,
    queueLimit: 7,
    queueWarning: 11,
    overcrowdLimit: 20,
    overcrowdRecoveryRate: 0.55,
    overcrowdGrowthRate: 1.2,
    unreachableCongestionRate: 1.45,
    diamondUnlockAt: 150,
    starUnlockAt: 330,
    startingLines: 3,
    lineRewardEveryStations: 2,
    maxLines: 20,
} satisfies Omit<WorldConfig, "difficulty">;

export const difficultyConfigs: Record<DifficultyName, WorldConfig> = {
    normal: {
        ...baseConfig,
        difficulty: "normal",
    },
    hard: {
        ...baseConfig,
        difficulty: "hard",
        trainSpeed: 104,
        trainCapacity: 5,
        passengerSpawnMin: 4.8,
        passengerSpawnMax: 7.2,
        passengerSpawnLateMin: 1.5,
        passengerSpawnLateMax: 3.1,
        stationSpawnInitial: 22,
        stationSpawnMin: 9,
        queueLimit: 6,
        queueWarning: 10,
        overcrowdLimit: 17,
        overcrowdRecoveryRate: 0.42,
        overcrowdGrowthRate: 1.5,
        unreachableCongestionRate: 1.9,
        diamondUnlockAt: 105,
        starUnlockAt: 240,
        startingLines: 2,
        lineRewardEveryStations: 3,
        maxLines: 15,
    },
    brutal: {
        ...baseConfig,
        difficulty: "brutal",
        trainSpeed: 96,
        trainCapacity: 4,
        passengerSpawnMin: 3.4,
        passengerSpawnMax: 5.2,
        passengerSpawnLateMin: 0.85,
        passengerSpawnLateMax: 1.9,
        stationSpawnInitial: 18,
        stationSpawnMin: 7,
        queueLimit: 5,
        queueWarning: 8,
        overcrowdLimit: 13,
        overcrowdRecoveryRate: 0.28,
        overcrowdGrowthRate: 1.95,
        unreachableCongestionRate: 2.55,
        diamondUnlockAt: 75,
        starUnlockAt: 170,
        startingLines: 1,
        lineRewardEveryStations: 5,
        maxLines: 10,
    },
};

export const defaultConfig: WorldConfig = difficultyConfigs.normal;
