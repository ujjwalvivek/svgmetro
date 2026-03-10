export type AudioCue =
    | "ui"
    | "select"
    | "commit"
    | "cancel"
    | "station"
    | "deliver"
    | "start"
    | "congestion"
    | "gameover";

export interface MetroAudio {
    enabled: boolean;
    unlocked: boolean;
    volume: number;
    setEnabled(enabled: boolean): void;
    setVolume(volume: number): void;
    unlock(): void;
    update(): void;
    cue(cue: AudioCue): void;
}

const MASTER_GAIN = 2.4;
const AMBIENT_GAIN = 0.34;
const SFX_GAIN = 1.35;
const LOOKAHEAD_SECONDS = 0.32;
const STEP_SECONDS = 60 / 76;
const AMBIENT_PATTERN = [
    57, 64, 69, 64, 60, 67, 72, 67, 55, 62, 67, 62, 60, 64, 69, 64,
];
const CUE_LIMITS: Record<AudioCue, number> = {
    ui: 0.035,
    select: 0.045,
    commit: 0.12,
    cancel: 0.08,
    station: 0.45,
    deliver: 0.08,
    start: 0.24,
    congestion: 1.4,
    gameover: 1.6,
};

export function createMetroAudio(): MetroAudio {
    let context: AudioContext | undefined;
    let master: GainNode | undefined;
    let ambientBus: GainNode | undefined;
    let sfxBus: GainNode | undefined;
    let delay: DelayNode | undefined;
    let feedback: GainNode | undefined;
    let drone: OscillatorNode[] = [];
    let droneGain: GainNode | undefined;
    let nextStepTime = 0;
    let step = 0;
    let enabled = true;
    let unlocked = false;
    let volume = 1;
    const lastCueTimes = new Map<AudioCue, number>();

    function init(): AudioContext | undefined {
        if (context) return context;

        const AudioContextClass =
            window.AudioContext ??
            (window as Window & { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioContextClass) return undefined;

        const audioContext = new AudioContextClass();
        const compressor = audioContext.createDynamicsCompressor();
        master = audioContext.createGain();
        ambientBus = audioContext.createGain();
        sfxBus = audioContext.createGain();
        delay = audioContext.createDelay(1.2);
        feedback = audioContext.createGain();

        master.gain.value = outputGain();
        ambientBus.gain.value = AMBIENT_GAIN;
        sfxBus.gain.value = SFX_GAIN;
        delay.delayTime.value = 0.34;
        feedback.gain.value = 0.18;

        ambientBus.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(master);
        ambientBus.connect(master);
        sfxBus.connect(master);
        master.connect(compressor);
        compressor.connect(audioContext.destination);

        context = audioContext;
        nextStepTime = audioContext.currentTime + 0.12;
        startDrone(audioContext);
        return audioContext;
    }

    function unlock(): void {
        if (!enabled) return;

        const audioContext = init();
        if (!audioContext) return;

        void audioContext.resume();
        unlocked = true;
    }

    function setEnabled(nextEnabled: boolean): void {
        enabled = nextEnabled;

        if (!enabled) {
            stopDrone();
            if (master && context)
                ramp(master.gain, 0, context.currentTime, 0.18);
            return;
        }

        const audioContext = init();
        if (!audioContext || !master) return;

        ramp(master.gain, outputGain(), audioContext.currentTime, 0.18);
        if (drone.length === 0) startDrone(audioContext);
        unlock();
    }

    function setVolume(nextVolume: number): void {
        volume = clamp(nextVolume, 0, 1);

        if (master && context) {
            ramp(master.gain, outputGain(), context.currentTime, 0.08);
        }
    }

    function update(): void {
        const audioContext = context;
        if (!enabled || !unlocked || !audioContext || !ambientBus) return;

        while (nextStepTime < audioContext.currentTime + LOOKAHEAD_SECONDS) {
            scheduleAmbientStep(audioContext, nextStepTime, step);
            nextStepTime += STEP_SECONDS;
            step = (step + 1) % AMBIENT_PATTERN.length;
        }
    }

    function cue(cueName: AudioCue): void {
        const audioContext = context;
        if (!enabled || !unlocked || !audioContext || !sfxBus) return;

        const now = audioContext.currentTime;
        const last = lastCueTimes.get(cueName) ?? -Infinity;
        if (now - last < CUE_LIMITS[cueName]) return;

        lastCueTimes.set(cueName, now);

        switch (cueName) {
            case "ui":
                pluck(audioContext, 523.25, now, 0.05, 0.18);
                return;
            case "select":
                pluck(audioContext, 391.99, now, 0.065, 0.22);
                return;
            case "commit":
                pluck(audioContext, 523.25, now, 0.08, 0.24);
                pluck(audioContext, 659.25, now + 0.055, 0.08, 0.22);
                return;
            case "cancel":
                pluck(audioContext, 349.23, now, 0.09, 0.19);
                return;
            case "station":
                bell(audioContext, now, 830.61, 0.32);
                return;
            case "deliver":
                bell(audioContext, now, 1046.5, 0.26);
                return;
            case "start":
                chord(audioContext, now, [220, 330, 440], 0.58, 0.2);
                return;
            case "congestion":
                pluck(audioContext, 196, now, 0.16, 0.22);
                pluck(audioContext, 246.94, now + 0.09, 0.14, 0.16);
                return;
            case "gameover":
                chord(audioContext, now, [174.61, 220, 261.63], 1.4, 0.22);
                return;
        }
    }

    function scheduleAmbientStep(
        audioContext: AudioContext,
        time: number,
        stepIndex: number,
    ): void {
        const midi = AMBIENT_PATTERN[stepIndex]!;
        const isRootPulse = stepIndex % 4 === 0;
        const frequency = midiToFrequency(midi);
        ambientVoice(
            audioContext,
            frequency,
            time,
            isRootPulse ? 1.85 : 1.28,
            isRootPulse ? 0.18 : 0.13,
        );

        if (stepIndex % 8 === 2) {
            ambientVoice(
                audioContext,
                midiToFrequency(midi + 12),
                time + 0.04,
                0.8,
                0.075,
            );
        }
    }

    function ambientVoice(
        audioContext: AudioContext,
        frequency: number,
        time: number,
        duration: number,
        level: number,
    ): void {
        if (!ambientBus) return;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, time);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1080, time);
        filter.Q.setValueAtTime(0.3, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(level, time + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ambientBus);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.05);
    }

    function pluck(
        audioContext: AudioContext,
        frequency: number,
        time: number,
        duration: number,
        level: number,
    ): void {
        if (!sfxBus) return;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 1.015,
            time + duration,
        );
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(level, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        oscillator.connect(gain);
        gain.connect(sfxBus);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
    }

    function bell(
        audioContext: AudioContext,
        time: number,
        frequency: number,
        level: number,
    ): void {
        pluck(audioContext, frequency, time, 0.18, level);
        pluck(audioContext, frequency * 1.5, time + 0.015, 0.14, level * 0.46);
    }

    function chord(
        audioContext: AudioContext,
        time: number,
        frequencies: number[],
        duration: number,
        level: number,
    ): void {
        for (const frequency of frequencies) {
            ambientVoice(audioContext, frequency, time, duration, level);
        }
    }

    function startDrone(audioContext: AudioContext): void {
        if (!ambientBus || drone.length > 0) return;

        droneGain = audioContext.createGain();
        droneGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        droneGain.gain.exponentialRampToValueAtTime(
            0.11,
            audioContext.currentTime + 1.2,
        );
        droneGain.connect(ambientBus);

        for (const frequency of [110, 164.81]) {
            const oscillator = audioContext.createOscillator();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            oscillator.connect(droneGain);
            oscillator.start();
            drone.push(oscillator);
        }
    }

    function stopDrone(): void {
        const audioContext = context;
        if (droneGain && audioContext) {
            ramp(droneGain.gain, 0.0001, audioContext.currentTime, 0.25);
        }

        for (const oscillator of drone) {
            try {
                oscillator.stop((audioContext?.currentTime ?? 0) + 0.3);
            } catch {}
        }

        drone = [];
        droneGain = undefined;
    }

    function ramp(
        param: AudioParam,
        value: number,
        time: number,
        duration: number,
    ): void {
        param.cancelScheduledValues(time);
        param.setTargetAtTime(value, time, Math.max(duration / 3, 0.001));
    }

    function outputGain(): number {
        return enabled ? MASTER_GAIN * volume : 0;
    }

    return {
        get enabled() {
            return enabled;
        },
        get unlocked() {
            return unlocked;
        },
        get volume() {
            return volume;
        },
        setEnabled,
        setVolume,
        unlock,
        update,
        cue,
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function midiToFrequency(midi: number): number {
    return 440 * 2 ** ((midi - 69) / 12);
}
