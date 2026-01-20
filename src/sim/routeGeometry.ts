import type { Route, Station, StationId, World } from "./types";

export interface RoutePoint {
    x: number;
    y: number;
}

export interface RoutePointWithAngle extends RoutePoint {
    angle: number;
}

export function routeToPolyline(
    world: World,
    stationIds: StationId[],
): RoutePoint[] {
    const points: RoutePoint[] = [];

    for (let index = 0; index < stationIds.length - 1; index += 1) {
        const a = world.stations.get(stationIds[index]!);
        const b = world.stations.get(stationIds[index + 1]!);
        if (!a || !b) continue;

        const segment = metroSegmentPoints(a, b);
        if (points.length > 0) segment.shift();
        points.push(...segment);
    }

    if (points.length === 0 && stationIds.length > 0) {
        const station = world.stations.get(stationIds[0]!);
        if (station) points.push({ x: station.x, y: station.y });
    }

    return points;
}

export function metroSegmentPoints(a: Station, b: Station): RoutePoint[] {
    const start = { x: a.x, y: a.y };
    const end = { x: b.x, y: b.y };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const signX = Math.sign(dx) || 1;
    const signY = Math.sign(dy) || 1;

    if (absX === 0 || absY === 0) return [start, end];

    if (absX >= absY) {
        return [start, { x: a.x + signX * absY, y: b.y }, end];
    }

    return [start, { x: a.x, y: b.y - signY * absX }, end];
}

export function routeSegmentLength(
    world: World,
    route: Route,
    segmentIndex: number,
): number {
    const a = world.stations.get(route.stationIds[segmentIndex]!);
    const b = world.stations.get(route.stationIds[segmentIndex + 1]!);
    if (!a || !b) return 0;

    return polylineLength(metroSegmentPoints(a, b));
}

export function routeSegmentPosition(
    world: World,
    route: Route,
    segmentIndex: number,
    direction: 1 | -1,
    t: number,
): RoutePointWithAngle | undefined {
    const orderedSegmentIndex =
        direction === 1 ? segmentIndex : segmentIndex - 1;
    const a = world.stations.get(route.stationIds[orderedSegmentIndex]!);
    const b = world.stations.get(route.stationIds[orderedSegmentIndex + 1]!);
    if (!a || !b) return undefined;

    const points = metroSegmentPoints(a, b);
    return pointAtPolyline(direction === 1 ? points : [...points].reverse(), t);
}

export function pointAtPolyline(
    points: RoutePoint[],
    t: number,
): RoutePointWithAngle | undefined {
    if (points.length === 0) return undefined;
    if (points.length === 1)
        return { x: points[0]!.x, y: points[0]!.y, angle: 0 };

    const length = Math.max(polylineLength(points), 1);
    let remaining = Math.max(0, Math.min(t, 1)) * length;

    for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index]!;
        const b = points[index + 1]!;
        const segmentLength = Math.max(pointDistance(a, b), 1);

        if (remaining <= segmentLength) {
            const local = remaining / segmentLength;
            const dx = b.x - a.x;
            const dy = b.y - a.y;

            return {
                x: a.x + dx * local,
                y: a.y + dy * local,
                angle: (Math.atan2(dy, dx) * 180) / Math.PI,
            };
        }

        remaining -= segmentLength;
    }

    const previous = points[points.length - 2]!;
    const last = points[points.length - 1]!;
    return {
        x: last.x,
        y: last.y,
        angle:
            (Math.atan2(last.y - previous.y, last.x - previous.x) * 180) /
            Math.PI,
    };
}

function polylineLength(points: RoutePoint[]): number {
    let length = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        length += pointDistance(points[index]!, points[index + 1]!);
    }

    return length;
}

function pointDistance(a: RoutePoint, b: RoutePoint): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}
