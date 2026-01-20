import { randRange } from "./rng";
import { nextRouteToTarget } from "./routing";
import type {
    Passenger,
    PassengerId,
    Station,
    StationType,
    Train,
    World,
} from "./types";

export function spawnPassengers(world: World, dt: number): void {
    for (const station of world.stations.values()) {
        station.spawnCooldown -= dt;

        if (station.spawnCooldown > 0) continue;

        spawnPassengerAt(world, station);
        station.spawnCooldown = passengerInterval(world);
    }
}

export function spawnPassengerAt(
    world: World,
    station: Station,
    targetType = chooseTargetType(world, station),
): Passenger {
    const passenger: Passenger = {
        id: world.nextPassengerId,
        from: station.id,
        targetType,
        state: "waiting",
        stationId: station.id,
        unreachable: false,
        spawnedAt: world.time,
    };

    world.nextPassengerId += 1;
    world.passengers.set(passenger.id, passenger);
    station.queue.push(passenger.id);
    station.dirtyQueue = true;
    return passenger;
}

export function handleTrainArrivals(world: World): void {
    for (const train of world.trains.values()) {
        if (train.arrivedStationId === undefined) continue;

        const station = world.stations.get(train.arrivedStationId);
        if (station) {
            disembarkAt(world, train, station);
            boardAt(world, train, station);
        }

        train.arrivedStationId = undefined;
    }
}

export function disembarkAt(
    world: World,
    train: Train,
    station: Station,
): void {
    const kept: PassengerId[] = [];

    for (const passengerId of train.passengers) {
        const passenger = world.passengers.get(passengerId);
        if (!passenger) continue;

        if (passenger.targetType === station.type) {
            passenger.state = "delivered";
            passenger.trainId = undefined;
            world.passengers.delete(passenger.id);
            world.deliveredCount += 1;
            world.score = world.deliveredCount;
        } else if (
            shouldTransfer(world, train, station, passenger.targetType)
        ) {
            passenger.state = "waiting";
            passenger.trainId = undefined;
            passenger.stationId = station.id;
            station.queue.push(passenger.id);
            station.dirtyQueue = true;
        } else {
            kept.push(passengerId);
        }
    }

    train.passengers = kept;
}

export function boardAt(world: World, train: Train, station: Station): void {
    const route = world.routes.get(train.routeId);
    if (!route) return;

    const remaining: PassengerId[] = [];

    for (const passengerId of station.queue) {
        const passenger = world.passengers.get(passengerId);
        if (!passenger) continue;

        const hasSpace = train.passengers.length < train.capacity;
        const nextRouteId = nextRouteToTarget(
            world,
            station.id,
            passenger.targetType,
        );
        const canServe = nextRouteId === route.id;

        if (hasSpace && canServe) {
            passenger.state = "riding";
            passenger.stationId = undefined;
            passenger.trainId = train.id;
            passenger.unreachable = false;
            train.passengers.push(passenger.id);
            station.dirtyQueue = true;
        } else {
            passenger.unreachable = nextRouteId === undefined;
            remaining.push(passenger.id);
        }
    }

    station.queue = remaining;
}

function shouldTransfer(
    world: World,
    train: Train,
    station: Station,
    targetType: StationType,
): boolean {
    const nextRouteId = nextRouteToTarget(world, station.id, targetType);
    return nextRouteId !== undefined && nextRouteId !== train.routeId;
}

export function passengerInterval(world: World): number {
    const pressure = Math.min(world.time / 600, 1);
    const min = lerp(world.config.passengerSpawnMin, 8, pressure);
    const max = lerp(world.config.passengerSpawnMax, 14, pressure);
    return randRange(world.rng, min, max);
}

function chooseTargetType(world: World, station: Station): StationType {
    const types = [
        ...new Set(
            [...world.stations.values()].map((candidate) => candidate.type),
        ),
    ];
    const candidates = types.filter((type) => type !== station.type);
    const pool = candidates.length > 0 ? candidates : types;
    const index = Math.floor(randRange(world.rng, 0, pool.length));
    return pool[index] ?? station.type;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
