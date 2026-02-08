import type { RouteId, StationId } from "../sim/types";

export function findStationId(node: Element | null): StationId | undefined {
    while (node && node instanceof SVGElement) {
        const id = node.dataset.stationId;
        if (id) return Number(id);
        node = node.parentElement;
    }

    return undefined;
}

export function findRouteId(node: Element | null): RouteId | undefined {
    while (node && node instanceof SVGElement) {
        const id = node.dataset.routeId;
        if (id) return Number(id);
        node = node.parentElement;
    }

    return undefined;
}
