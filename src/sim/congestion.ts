import type { World } from "./types";

export function updateCongestion(world: World, dt: number): void {
    for (const station of world.stations.values()) {
        const previous = station.overcrowd;

        const unreachable = station.queue.reduce((count, passengerId) => {
            const passenger = world.passengers.get(passengerId);
            return count + (passenger?.unreachable ? 1 : 0);
        }, 0);
        const overload = Math.max(0, station.queue.length - world.config.queueLimit);

        if (overload > 0 || unreachable > 0) {
            const warningRange = Math.max(
                1,
                world.config.queueWarning - world.config.queueLimit,
            );
            const queuePressure = Math.pow(overload / warningRange, 1.25);
            const unreachablePressure =
                (unreachable / Math.max(1, world.config.queueWarning)) *
                world.config.unreachableCongestionRate;
            const pressure = Math.min(3.2, queuePressure + unreachablePressure);
            station.overcrowd += dt * pressure * world.config.overcrowdGrowthRate;
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
