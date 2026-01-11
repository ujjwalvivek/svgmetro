import type { World } from "./types";

export function updateCongestion(world: World, dt: number): void {
    for (const station of world.stations.values()) {
        const previous = station.overcrowd;

        if (station.queue.length > world.config.queueLimit) {
            const overload = station.queue.length - world.config.queueLimit;
            const warningRange = Math.max(
                1,
                world.config.queueWarning - world.config.queueLimit,
            );
            const pressure = Math.min(1.75, overload / warningRange);
            station.overcrowd += dt * pressure;
        } else {
            station.overcrowd -= dt * world.config.overcrowdRecoveryRate;
        }

        station.overcrowd = Math.max(
            0,
            Math.min(station.overcrowd, world.config.overcrowdLimit),
        );

        if (Math.abs(station.overcrowd - previous) > 0.01) {
            station.dirtyVisual = true;
        }

        if (station.overcrowd >= world.config.overcrowdLimit) {
            world.gameOver = true;
            world.failedStationId = station.id;
            station.dirtyVisual = true;
            return;
        }
    }
}
