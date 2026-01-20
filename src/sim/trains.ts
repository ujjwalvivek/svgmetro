import { routeSegmentLength, routeSegmentPosition } from "./routeGeometry";
import type { Route, Station, Train, World } from "./types";

export interface TrainPosition {
    x: number;
    y: number;
    angle: number;
}

export function createTrainForRoute(world: World, route: Route): Train {
    const train: Train = {
        id: world.nextTrainId,
        routeId: route.id,
        segmentIndex: 0,
        direction: 1,
        t: 0,
        speed: world.config.trainSpeed,
        capacity: world.config.trainCapacity,
        passengers: [],
    };

    world.nextTrainId += 1;
    world.trains.set(train.id, train);
    route.trainIds.push(train.id);
    return train;
}

export function distributeRouteTrains(world: World, route: Route): void {
    const trains = route.trainIds
        .map((trainId) => world.trains.get(trainId))
        .filter((train): train is Train => train !== undefined);
    if (trains.length === 0 || route.stationIds.length < 2) return;

    const routeLength = routeDistance(world, route);
    if (routeLength <= 0) return;

    const cycleLength = routeLength * 2;

    trains.forEach((train, index) => {
        placeTrainAtDistance(
            world,
            route,
            train,
            (cycleLength * index) / trains.length,
        );
    });
}

export function resetTrainForRoute(world: World, route: Route): Train {
    for (const trainId of route.trainIds) {
        removeTrain(world, trainId);
    }

    route.trainIds = [];
    const train = createTrainForRoute(world, route);
    distributeRouteTrains(world, route);
    return train;
}

export function removeRouteTrains(world: World, route: Route): void {
    for (const trainId of route.trainIds) {
        removeTrain(world, trainId);
    }

    route.trainIds = [];
}

function removeTrain(world: World, trainId: number): void {
    const train = world.trains.get(trainId);
    if (!train) return;

    for (const passengerId of train.passengers) {
        const passenger = world.passengers.get(passengerId);
        if (!passenger) continue;

        const station = world.stations.get(passenger.from);
        if (!station) continue;

        passenger.state = "waiting";
        passenger.trainId = undefined;
        passenger.stationId = station.id;
        station.queue.push(passenger.id);
        station.dirtyQueue = true;
    }

    world.trains.delete(trainId);
}

export function moveTrains(world: World, dt: number): void {
    for (const train of world.trains.values()) {
        moveTrain(world, train, dt);
    }
}

export function moveTrain(world: World, train: Train, dt: number): void {
    train.arrivedStationId = undefined;

    const route = world.routes.get(train.routeId);
    if (!route || route.stationIds.length < 2) return;

    if (
        !currentStation(world, route, train) ||
        !nextStation(world, route, train)
    )
        return;

    const dist = Math.max(currentSegmentDistance(world, route, train), 1);
    train.t += (train.speed * dt) / dist;

    while (train.t >= 1) {
        const arrivedStation = nextStation(world, route, train);
        if (!arrivedStation) return;

        train.t -= 1;
        train.arrivedStationId = arrivedStation.id;
        train.segmentIndex += train.direction;

        if (train.segmentIndex <= 0) {
            train.segmentIndex = 0;
            train.direction = 1;
        }

        if (train.segmentIndex >= route.stationIds.length - 1) {
            train.segmentIndex = route.stationIds.length - 1;
            train.direction = -1;
        }
    }
}

export function trainPosition(
    world: World,
    train: Train,
): TrainPosition | undefined {
    const route = world.routes.get(train.routeId);
    if (!route || route.stationIds.length === 0) return undefined;

    const a = currentStation(world, route, train);
    const b = nextStation(world, route, train);

    if (!a) return undefined;
    if (!b) return { x: a.x, y: a.y, angle: 0 };

    return (
        routeSegmentPosition(
            world,
            route,
            train.segmentIndex,
            train.direction,
            train.t,
        ) ?? {
            x: a.x,
            y: a.y,
            angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
        }
    );
}

export function trainDistanceAlongRoute(
    world: World,
    train: Train,
): number | undefined {
    const route = world.routes.get(train.routeId);
    if (!route || route.stationIds.length < 2) return undefined;

    let total = 0;

    if (train.direction === 1) {
        for (let index = 0; index < train.segmentIndex; index += 1) {
            total += segmentDistance(world, route, index);
        }

        return (
            total + segmentDistance(world, route, train.segmentIndex) * train.t
        );
    }

    for (let index = 0; index < train.segmentIndex; index += 1) {
        total += segmentDistance(world, route, index);
    }

    return (
        total - segmentDistance(world, route, train.segmentIndex - 1) * train.t
    );
}

function placeTrainAtDistance(
    world: World,
    route: Route,
    train: Train,
    distanceAlongCycle: number,
): void {
    const routeLength = routeDistance(world, route);
    if (routeLength <= 0) return;

    let remaining =
        ((distanceAlongCycle % (routeLength * 2)) + routeLength * 2) %
        (routeLength * 2);

    if (remaining <= routeLength) {
        train.direction = 1;
        placeForward(world, route, train, remaining);
        return;
    }

    train.direction = -1;
    placeBackward(world, route, train, remaining - routeLength);
}

function placeForward(
    world: World,
    route: Route,
    train: Train,
    distanceAlongRoute: number,
): void {
    let remaining = distanceAlongRoute;

    for (let index = 0; index < route.stationIds.length - 1; index += 1) {
        const segmentLength = segmentDistance(world, route, index);
        if (segmentLength <= 0) continue;

        if (remaining <= segmentLength) {
            train.segmentIndex = index;
            train.t = remaining / segmentLength;
            return;
        }

        remaining -= segmentLength;
    }

    train.segmentIndex = Math.max(0, route.stationIds.length - 2);
    train.t = 1;
}

function placeBackward(
    world: World,
    route: Route,
    train: Train,
    distanceFromEnd: number,
): void {
    let remaining = distanceFromEnd;

    for (let index = route.stationIds.length - 1; index > 0; index -= 1) {
        const segmentLength = segmentDistance(world, route, index - 1);
        if (segmentLength <= 0) continue;

        if (remaining <= segmentLength) {
            train.segmentIndex = index;
            train.t = remaining / segmentLength;
            return;
        }

        remaining -= segmentLength;
    }

    train.segmentIndex = 1;
    train.t = 1;
}

export function routeDistance(world: World, route: Route): number {
    let total = 0;

    for (let index = 0; index < route.stationIds.length - 1; index += 1) {
        total += segmentDistance(world, route, index);
    }

    return total;
}

function segmentDistance(
    world: World,
    route: Route,
    segmentIndex: number,
): number {
    return routeSegmentLength(world, route, segmentIndex);
}

function currentSegmentDistance(
    world: World,
    route: Route,
    train: Train,
): number {
    return segmentDistance(
        world,
        route,
        train.direction === 1 ? train.segmentIndex : train.segmentIndex - 1,
    );
}

function currentStation(
    world: World,
    route: Route,
    train: Train,
): Station | undefined {
    return world.stations.get(route.stationIds[train.segmentIndex]!);
}

function nextStation(
    world: World,
    route: Route,
    train: Train,
): Station | undefined {
    return world.stations.get(
        route.stationIds[train.segmentIndex + train.direction]!,
    );
}
