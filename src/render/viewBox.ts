import type { World, WorldConfig } from "../sim/types";

export interface SvgViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

const FIT_PADDING = 126;
const MIN_VIEW_WIDTH_RATIO = 0.82;

export function fullViewBox(config: WorldConfig): SvgViewBox {
    return {
        x: 0,
        y: 0,
        width: config.mapWidth,
        height: config.mapHeight,
    };
}

export function stationFitViewBox(world: World): SvgViewBox {
    if (world.stations.size === 0) return fullViewBox(world.config);

    const stations = [...world.stations.values()];
    const minX = Math.min(...stations.map((station) => station.x));
    const maxX = Math.max(...stations.map((station) => station.x));
    const minY = Math.min(...stations.map((station) => station.y));
    const maxY = Math.max(...stations.map((station) => station.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const aspect = world.config.mapWidth / world.config.mapHeight;
    const minWidth = world.config.mapWidth * MIN_VIEW_WIDTH_RATIO;

    let width = Math.max(maxX - minX + FIT_PADDING * 2, minWidth);
    let height = maxY - minY + FIT_PADDING * 2;

    if (width / height < aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }

    if (width >= world.config.mapWidth || height >= world.config.mapHeight) {
        return fullViewBox(world.config);
    }

    const x = clamp(centerX - width / 2, 0, world.config.mapWidth - width);
    const y = clamp(centerY - height / 2, 0, world.config.mapHeight - height);

    return {
        x: roundViewBoxValue(x),
        y: roundViewBoxValue(y),
        width: roundViewBoxValue(width),
        height: roundViewBoxValue(height),
    };
}

export function viewBoxToString(viewBox: SvgViewBox): string {
    return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

export function viewBoxScale(config: WorldConfig, viewBox: SvgViewBox): number {
    return viewBox.width / config.mapWidth;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function roundViewBoxValue(value: number): number {
    return Math.round(value * 10) / 10;
}
