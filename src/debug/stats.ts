export interface FrameStats {
    fps: number;
    frameMs: number;
    p95FrameMs: number;
    nodeCount: number;
    lastCommand: string;
    draftStations: number;
    samples: number[];
}

export function createFrameStats(): FrameStats {
    return {
        fps: 0,
        frameMs: 0,
        p95FrameMs: 0,
        nodeCount: 0,
        lastCommand: "-",
        draftStations: 0,
        samples: [],
    };
}

export function updateFrameStats(stats: FrameStats, frameMs: number): void {
    stats.frameMs = frameMs;

    const instantFps = frameMs > 0 ? 1000 / frameMs : 0;
    stats.fps =
        stats.fps === 0 ? instantFps : stats.fps * 0.9 + instantFps * 0.1;
    stats.samples.push(frameMs);

    if (stats.samples.length > 240) {
        stats.samples.shift();
    }

    const sorted = [...stats.samples].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    stats.p95FrameMs = sorted[index] ?? frameMs;
}
