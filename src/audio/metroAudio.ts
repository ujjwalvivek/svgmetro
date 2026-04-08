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

const MASTER_GAIN = 1.85;
const AMBIENT_GAIN = 0.42;
const SFX_GAIN = 1.05;
const LOOKAHEAD_SECONDS = 0.42;
const STEP_SECONDS = 60 / 92;
const ROOT_PATTERN = [57, 60, 55, 53, 57, 64, 60, 55];
const MELODY_PATTERN = [
    69, undefined, 72, 76, 74, undefined, 72, 67,
    69, 71, undefined, 72, 76, 74, 72, undefined,
] as const;
const COUNTER_PATTERN = [64, undefined, 67, undefined, 64, 62, undefined, 60] as const;
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
    let highpass: BiquadFilterNode | undefined;
    let feedback: GainNode | undefined;
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
        highpass = audioContext.createBiquadFilter();

        master.gain.value = outputGain();
        ambientBus.gain.value = AMBIENT_GAIN;
        sfxBus.gain.value = SFX_GAIN;
        delay.delayTime.value = 0.29;
        feedback.gain.value = 0.14;
        highpass.type = "highpass";
        highpass.frequency.value = 145;
        highpass.Q.value = 0.6;

        ambientBus.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(master);
        ambientBus.connect(master);
        sfxBus.connect(master);
        master.connect(highpass);
        highpass.connect(compressor);
        compressor.connect(audioContext.destination);

        context = audioContext;
        nextStepTime = audioContext.currentTime + 0.12;
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
            if (master && context)
                ramp(master.gain, 0, context.currentTime, 0.18);
            return;
        }

        const audioContext = init();
        if (!audioContext || !master) return;

        ramp(master.gain, outputGain(), audioContext.currentTime, 0.18);
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
            step = (step + 1) % MELODY_PATTERN.length;
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
                chord(audioContext, now, [293.66, 369.99, 440], 0.72, 0.12);
                sparkle(audioContext, now + 0.08, 880, 0.08);
                return;
            case "congestion":
                pluck(audioContext, 440, now, 0.11, 0.08);
                pluck(audioContext, 523.25, now + 0.11, 0.1, 0.065);
                return;
            case "gameover":
                chord(audioContext, now, [246.94, 293.66, 369.99], 1.55, 0.13);
                sparkle(audioContext, now + 0.18, 739.99, 0.055);
                return;
        }
    }

    function scheduleAmbientStep(
        audioContext: AudioContext,
        time: number,
        stepIndex: number,
    ): void {
        const root = ROOT_PATTERN[stepIndex % ROOT_PATTERN.length]!;
        const melody = MELODY_PATTERN[stepIndex % MELODY_PATTERN.length];
        const counter = COUNTER_PATTERN[stepIndex % COUNTER_PATTERN.length];
        const phraseStart = stepIndex % 8 === 0;

        if (stepIndex % 2 === 0) {
            softBeat(audioContext, time, phraseStart);
        }

        if (phraseStart) {
            ambientVoice(
                audioContext,
                midiToFrequency(root + 12),
                time + 0.02,
                0.36,
                0.045,
            );
        }

        if (melody !== undefined) {
            ambientVoice(
                audioContext,
                midiToFrequency(melody),
                time + 0.03,
                0.44,
                0.082,
            );
        }

        if (counter !== undefined && stepIndex % 2 === 0) {
            ambientVoice(
                audioContext,
                midiToFrequency(counter + 12),
                time + 0.09,
                0.26,
                0.036,
            );
        }

        if (stepIndex % 16 === 6 || stepIndex % 16 === 14) {
            sparkle(
                audioContext,
                time + 0.12,
                midiToFrequency(root + 24),
                0.03,
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
        filter.frequency.setValueAtTime(1420, time);
        filter.Q.setValueAtTime(0.24, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(level, time + 0.11);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ambientBus);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.05);
    }

    function softBeat(
        audioContext: AudioContext,
        time: number,
        accent: boolean,
    ): void {
        if (!ambientBus) return;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        const frequency = accent ? 246.94 : 293.66;
        const level = accent ? 0.09 : 0.052;
        const duration = accent ? 0.12 : 0.085;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 0.86,
            time + duration,
        );
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(frequency * 1.35, time);
        filter.Q.setValueAtTime(1.8, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(level, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ambientBus);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
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
        pluck(audioContext, frequency, time, 0.16, level * 0.72);
        pluck(audioContext, frequency * 1.5, time + 0.018, 0.13, level * 0.28);
    }

    function sparkle(
        audioContext: AudioContext,
        time: number,
        frequency: number,
        level: number,
    ): void {
        pluck(audioContext, frequency, time, 0.07, level);
        pluck(audioContext, frequency * 1.25, time + 0.035, 0.06, level * 0.55);
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
