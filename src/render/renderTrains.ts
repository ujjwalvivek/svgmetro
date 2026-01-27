import { setAttrs, svgEl } from "./svgElements";
import { trainDistanceAlongRoute, trainPosition } from "../sim/trains";
import type { RouteId, Train, TrainId, World } from "../sim/types";

export interface TrainRenderCache {
    trainNodes: Map<TrainId, SVGGElement>;
}

export function createTrainRenderCache(): TrainRenderCache {
    return {
        trainNodes: new Map(),
    };
}

export function renderTrains(
    layer: SVGGElement,
    world: World,
    cache: TrainRenderCache,
    routeNodes: Map<RouteId, SVGPathElement>,
): number {
    const seen = new Set<TrainId>();
    let transformUpdates = 0;

    for (const train of world.trains.values()) {
        const position = world.debug.useSvgGeometry
            ? (svgTrainPosition(world, train, routeNodes) ??
              trainPosition(world, train))
            : trainPosition(world, train);
        if (!position) continue;

        seen.add(train.id);
        let node = cache.trainNodes.get(train.id);

        if (!node) {
            node = createTrainNode(train.id);
            cache.trainNodes.set(train.id, node);
            layer.append(node);
        }

        setAttrs(node, {
            transform: `translate(${position.x.toFixed(2)} ${position.y.toFixed(2)}) rotate(${position.angle.toFixed(2)})`,
        });
        transformUpdates += 1;
        const load = node.querySelector<SVGRectElement>(".train-load");
        if (load)
            load.setAttribute(
                "width",
                (
                    26 *
                    Math.min(
                        1,
                        train.capacity > 0
                            ? train.passengers.length / train.capacity
                            : 0,
                    )
                ).toFixed(2),
            );
    }

    for (const [id, node] of cache.trainNodes) {
        if (seen.has(id)) continue;
        node.remove();
        cache.trainNodes.delete(id);
    }

    return transformUpdates;
}

function svgTrainPosition(
    world: World,
    train: Train,
    routeNodes: Map<RouteId, SVGPathElement>,
): ReturnType<typeof trainPosition> {
    const path = routeNodes.get(train.routeId);
    const routeDistance = trainDistanceAlongRoute(world, train);
    if (!path || routeDistance === undefined)
        return trainPosition(world, train);

    const totalLength = path.getTotalLength();
    if (totalLength <= 0) return trainPosition(world, train);

    const clampedDistance = Math.max(0, Math.min(routeDistance, totalLength));
    const point = path.getPointAtLength(clampedDistance);
    const ahead = path.getPointAtLength(
        Math.min(totalLength, clampedDistance + 1),
    );
    const behind = path.getPointAtLength(Math.max(0, clampedDistance - 1));

    return {
        x: point.x,
        y: point.y,
        angle:
            (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) /
            Math.PI,
    };
}

function createTrainNode(trainId: TrainId): SVGGElement {
    const group = svgEl("g", {
        class: "train",
        "data-train-id": trainId,
    });
    const shadow = svgEl("rect", {
        class: "train-shadow",
        x: -14,
        y: -7,
        width: 30,
        height: 15,
        rx: 3,
    });
    const body = svgEl("rect", {
        class: "train-body",
        x: -15,
        y: -8,
        width: 30,
        height: 16,
        rx: 3,
    });
    const window = svgEl("rect", {
        class: "train-window",
        x: -13,
        y: -4,
        width: 22,
        height: 8,
        rx: 1,
    });
    const highlight = svgEl("path", {
        class: "train-highlight",
        d: "M-11 -5 L8 -5",
        fill: "none",
    });
    const undercarriage = svgEl("path", {
        class: "train-undercarriage",
        d: "M-10 6 L9 6",
        fill: "none",
    });
    const divider = svgEl("path", {
        class: "train-divider",
        d: "M-3 -7 L-3 7 M5 -7 L5 7",
        fill: "none",
    });
    const nose = svgEl("path", {
        class: "train-nose",
        d: "M11 -4 L15 0 L11 4",
        fill: "none",
    });
    const load = svgEl("rect", {
        class: "train-load",
        x: -13,
        y: 6,
        width: 26,
        height: 2,
    });

    group.append(
        shadow,
        body,
        highlight,
        undercarriage,
        window,
        divider,
        load,
        nose,
    );
    return group;
}
