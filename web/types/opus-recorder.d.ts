/**
 * Declaración mínima de tipos para `opus-recorder` (la librería no publica
 * `.d.ts`). Solo se tipa la superficie que usamos en el grabador de audio.
 * Graba directo a OGG/Opus en todos los navegadores (incluido Chrome), que es
 * el formato que WhatsApp acepta como nota de voz.
 */
declare module "opus-recorder" {
  interface RecorderOptions {
    /** URL pública del worker del codificador (servido desde /public). */
    encoderPath?: string;
    encoderSampleRate?: number;
    numberOfChannels?: number;
    /** 2048 = VOIP, 2049 = AUDIO, 2051 = RESTRICTED_LOWDELAY. */
    encoderApplication?: number;
    streamPages?: boolean;
    monitorGain?: number;
    recordingGain?: number;
    [key: string]: unknown;
  }

  export default class Recorder {
    constructor(options?: RecorderOptions);
    static isRecordingSupported(): boolean;
    /** Recibe el archivo OGG/Opus completo (Uint8Array) al detener. */
    ondataavailable: ((data: BlobPart) => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;
    onpause: (() => void) | null;
    onresume: (() => void) | null;
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    resume(): void;
    close(): void;
    readonly state: string;
  }
}
