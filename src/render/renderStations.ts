import { setAttrs, svgEl } from "./svgElements";
import type { Station, StationId, StationType, World } from "../sim/types";

export interface StationRenderCache {
    stationNodes: Map<StationId, SVGGElement>;
}

export interface StationRenderMetrics {
    dirtyStationUpdates: number;
    queueRenderCount: number;
    passengerIconNodes: number;
}

export function createStationRenderCache(): StationRenderCache {
    return {
        stationNodes: new Map(),
    };
}

export function renderStations(
    layer: SVGGElement,
    world: World,
    cache: StationRenderCache,
    selectedStationId?: StationId,
    previewStationId?: StationId,
    invalidStationId?: StationId,
    draftStationIds: StationId[] = [],
    previewColor?: string,
): StationRenderMetrics {
    const seen = new Set<StationId>();
    const draftStations = new Set(draftStationIds);
    const metrics: StationRenderMetrics = {
        dirtyStationUpdates: 0,
        queueRenderCount: 0,
        passengerIconNodes: 0,
    };

    for (const station of world.stations.values()) {
        seen.add(station.id);
        let node = cache.stationNodes.get(station.id);

        if (!node) {
            node = createStationNode(station);
            cache.stationNodes.set(station.id, node);
            layer.append(node);
            station.dirtyVisual = false;
        }

        setAttrs(node, {
            transform: `translate(${station.x.toFixed(2)} ${station.y.toFixed(2)})`,
            "data-type": station.type,
        });
        node.classList.toggle("is-selected", station.id === selectedStationId);
        node.classList.toggle(
            "is-preview-target",
            station.id === previewStationId,
        );
        node.classList.toggle(
            "is-invalid-target",
            station.id === invalidStationId,
        );
        node.classList.toggle(
            "is-draft-station",
            draftStations.has(station.id),
        );
        node.classList.toggle(
            "is-warning",
            station.queue.length > world.config.queueWarning,
        );
        node.classList.toggle(
            "is-critical",
            station.overcrowd > world.config.overcrowdLimit * 0.5,
        );
        node.classList.toggle(
            "is-failed",
            world.failedStationId === station.id,
        );
        node.style.setProperty(
            "--overcrowd",
            String(station.overcrowd / world.config.overcrowdLimit),
        );
        if (previewColor)
            node.style.setProperty("--preview-color", previewColor);

        if (station.dirtyQueue || !world.debug.dirtyRendering) {
            const passengerLayer = node.querySelector<SVGGElement>(
                ".station-passengers",
            );
            if (passengerLayer) {
                const queueMetrics = renderStationQueue(
                    passengerLayer,
                    world,
                    station,
                );
                metrics.queueRenderCount += 1;
                metrics.passengerIconNodes += queueMetrics.passengerIconNodes;
            }
            metrics.dirtyStationUpdates += 1;
            station.dirtyQueue = false;
        }
    }

    for (const [id, node] of cache.stationNodes) {
        if (seen.has(id)) continue;
        node.remove();
        cache.stationNodes.delete(id);
    }

    return metrics;
}

function createStationNode(station: Station): SVGGElement {
    const group = svgEl("g", {
        class: "station",
        "data-station-id": station.id,
        "data-type": station.type,
    });

    const hitArea = svgEl("circle", {
        class: "station-hit-area",
        r: 28,
        "data-station-id": station.id,
    });

    const glyph = createGlyph(station.type);
    glyph.classList.add("station-glyph");
    glyph.setAttribute("data-station-id", String(station.id));

    const hoverBorder = createGlyph(station.type);
    hoverBorder.classList.add("station-hover-border");
    hoverBorder.setAttribute("data-station-id", String(station.id));

    const hoverBand = createGlyph(station.type);
    hoverBand.classList.add("station-hover-band");
    hoverBand.setAttribute("data-station-id", String(station.id));

    const passengers = svgEl("g", {
        class: "station-passengers",
        "data-station-id": station.id,
    });

    const ring = svgEl("circle", {
        class: "overcrowd-ring",
        r: 25,
        "data-station-id": station.id,
    });

    group.append(hitArea, hoverBorder, hoverBand, glyph, passengers, ring);
    return group;
}

function createGlyph(type: StationType): SVGElement {
    switch (type) {
        case "circle":
            return svgEl("circle", { r: 13 });
        case "square":
            return svgEl("rect", { x: -12, y: -12, width: 24, height: 24 });
        case "triangle":
            return svgEl("polygon", { points: "0,-15 14,11 -14,11" });
        case "diamond":
            return svgEl("rect", {
                x: -11,
                y: -11,
                width: 22,
                height: 22,
                transform: "rotate(45)",
            });
        case "star":
            return svgEl("path", {
                d: "M0 -16 L4 -5 L15 -5 L6 2 L10 14 L0 7 L-10 14 L-6 2 L-15 -5 L-4 -5 Z",
            });
    }
}

function renderStationQueue(
    layer: SVGGElement,
    world: World,
    station: Station,
): { passengerIconNodes: number } {
    const maxVisible = world.debug.renderAllPassengers
        ? Number.POSITIVE_INFINITY
        : 12;
    const visible = station.queue.slice(0, maxVisible);
    const fragment = document.createDocumentFragment();
    const anchor = queueAnchor(world, station);

    visible.forEach((passengerId, index) => {
        const passenger = world.passengers.get(passengerId);
        if (!passenger) return;

        const icon = createPassengerIcon(passenger.targetType);
        const column = index % anchor.columns;
        const row = Math.floor(index / anchor.columns);

        icon.classList.add("passenger-icon");
        icon.classList.toggle("is-unreachable", passenger.unreachable === true);
        icon.setAttribute(
            "transform",
            `translate(${anchor.x + column * 9.5} ${anchor.y + row * 9.5}) scale(0.31)`,
        );
        fragment.append(icon);
    });

    if (!world.debug.renderAllPassengers && station.queue.length > maxVisible) {
        const overflow = svgEl("text", {
            class: "passenger-overflow",
            x: anchor.x,
            y: anchor.y + Math.ceil(maxVisible / anchor.columns) * 9.5 + 7,
        });
        overflow.textContent = `+${station.queue.length - maxVisible}`;
        fragment.append(overflow);
    }

    layer.replaceChildren(fragment);
    return { passengerIconNodes: visible.length };
}

function queueAnchor(
    world: World,
    station: Station,
): { x: number; y: number; columns: number; angle: number } {
    const candidates = [
        { x: 20, y: -14, columns: 4, angle: 0 },
        { x: -48, y: -14, columns: 4, angle: Math.PI },
        { x: -18, y: -44, columns: 5, angle: -Math.PI / 2 },
        { x: -18, y: 24, columns: 5, angle: Math.PI / 2 },
    ];
    const routeAngles = connectedRouteAngles(world, station);
    if (routeAngles.length === 0) return candidates[0]!;

    return candidates
        .map((candidate) => ({
            candidate,
            score: Math.min(
                ...routeAngles.map((angle) =>
                    angularDistance(candidate.angle, angle),
                ),
            ),
        }))
        .sort((a, b) => b.score - a.score)[0]!.candidate;
}

function connectedRouteAngles(world: World, station: Station): number[] {
    const angles: number[] = [];

    for (const route of world.routes.values()) {
        route.stationIds.forEach((stationId, index) => {
            if (stationId !== station.id) return;

            for (const neighborId of [
                route.stationIds[index - 1],
                route.stationIds[index + 1],
            ]) {
                const neighbor =
                    neighborId === undefined
                        ? undefined
                        : world.stations.get(neighborId);
                if (neighbor)
                    angles.push(
                        Math.atan2(
                            neighbor.y - station.y,
                            neighbor.x - station.x,
                        ),
                    );
            }
        });
    }

    return angles;
}

function angularDistance(a: number, b: number): number {
    const diff = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    return diff;
}

function createPassengerIcon(type: StationType): SVGElement {
    const icon = createGlyph(type);
    icon.classList.add("passenger-glyph");
    return icon;
}
