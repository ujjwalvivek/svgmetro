import { distance } from "./geometry";
import { createRng, rand, randRange } from "./rng";
import {
    defaultConfig,
    type Station,
    type StationType,
    type World,
    type WorldConfig,
} from "./types";

const INITIAL_TYPES: StationType[] = ["circle", "square", "triangle"];
const MIN_STATION_DISTANCE = 110;
const MAX_CANDIDATES = 64;

export function createWorld(
    seed = 0x5eed1234,
    config: WorldConfig = defaultConfig,
): World {
    const world: World = {
        time: 0,
        tick: 0,
        seed,
        score: 0,
        deliveredCount: 0,
        gameOver: false,
        stationSpawnCooldown: config.stationSpawnInitial,
        stations: new Map(),
        passengers: new Map(),
        routes: new Map(),
        trains: new Map(),
        nextStationId: 1,
        nextPassengerId: 1,
        nextRouteId: 1,
        nextTrainId: 1,
        rng: createRng(seed),
        config,
        debug: {
            renderAllPassengers: false,
            dirtyRendering: true,
            useSvgGeometry: false,
        },
    };

    createInitialStations(world);
    return world;
}

export function createInitialStations(world: World): void {
    const count = Math.max(world.config.initialStations, INITIAL_TYPES.length);

    for (let index = 0; index < count; index += 1) {
        const type = INITIAL_TYPES[index] ?? chooseStationType(world);
        const station = createStation(world, type);
        world.stations.set(station.id, station);
    }
}

export function spawnStation(
    world: World,
    type = chooseStationType(world),
): Station | undefined {
    if (world.stations.size >= world.config.maxStations) return undefined;

    const station = createStation(world, type);
    world.stations.set(station.id, station);
    return station;
}

export function chooseStationType(world: World): StationType {
    const availableTypes = unlockedStationTypes(world);
    const roll = rand(world.rng);

    if (availableTypes.includes("star")) {
        if (roll < 0.42) return "circle";
        if (roll < 0.66) return "square";
        if (roll < 0.84) return "triangle";
        if (roll < 0.95) return "diamond";
        return "star";
    }

    if (availableTypes.includes("diamond")) {
        if (roll < 0.45) return "circle";
        if (roll < 0.72) return "square";
        if (roll < 0.9) return "triangle";
        return "diamond";
    }

    if (roll < 0.5) return "circle";
    if (roll < 0.8) return "square";
    return "triangle";
}

export function stationSpawnInterval(world: World): number {
    const pressure = difficultyPressure(world);
    const interval = lerp(
        world.config.stationSpawnInitial,
        world.config.stationSpawnMin,
        pressure,
    );
    return randRange(world.rng, interval * 0.8, interval * 1.2);
}

export function difficultyPressure(world: World): number {
    return Math.min(world.time / 200, 1);
}

function unlockedStationTypes(world: World): StationType[] {
    if (world.time >= world.config.starUnlockAt) {
        return ["circle", "square", "triangle", "diamond", "star"];
    }

    if (world.time >= world.config.diamondUnlockAt) {
        return ["circle", "square", "triangle", "diamond"];
    }

    return ["circle", "square", "triangle"];
}

function createStation(world: World, type: StationType): Station {
    const point = findStationPoint(world);
    const station: Station = {
        id: world.nextStationId,
        type,
        x: point.x,
        y: point.y,
        queue: [],
        overcrowd: 0,
        spawnCooldown: randRange(
            world.rng,
            world.config.passengerSpawnMin,
            world.config.passengerSpawnMax,
        ),
        discoveredAt: world.time,
        dirtyQueue: true,
        dirtyVisual: true,
    };

    world.nextStationId += 1;
    return station;
}

function findStationPoint(world: World): { x: number; y: number } {
    let minDistance = MIN_STATION_DISTANCE;

    for (let pass = 0; pass < 8; pass += 1) {
        for (let attempt = 0; attempt < MAX_CANDIDATES; attempt += 1) {
            const candidate = {
                x: randRange(
                    world.rng,
                    world.config.margin,
                    world.config.mapWidth - world.config.margin,
                ),
                y: randRange(
                    world.rng,
                    world.config.margin,
                    world.config.mapHeight - world.config.margin,
                ),
            };

            if (isValidStationPoint(world, candidate, minDistance)) {
                return candidate;
            }
        }

        minDistance *= 0.9;
    }

    return {
        x: randRange(
            world.rng,
            world.config.margin,
            world.config.mapWidth - world.config.margin,
        ),
        y: randRange(
            world.rng,
            world.config.margin,
            world.config.mapHeight - world.config.margin,
        ),
    };
}

function isValidStationPoint(
    world: World,
    candidate: { x: number; y: number },
    minDistance: number,
): boolean {
    for (const station of world.stations.values()) {
        if (distance(candidate, station) < minDistance) return false;
        if (
            Math.abs(candidate.x - station.x) < 28 &&
            Math.abs(candidate.y - station.y) < 28
        )
            return false;
    }

    return true;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
