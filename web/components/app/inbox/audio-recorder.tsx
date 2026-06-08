"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  StopIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type RecorderT from "opus-recorder";

import { Button } from "@/components/ui/button";

/**
 * Grabador de audio del composer. Usa `opus-recorder`, que graba DIRECTO a
 * OGG/Opus en todos los navegadores (incluido Chrome) — el formato que WhatsApp
 * acepta como nota de voz. (El `MediaRecorder` nativo solo produce webm en
 * Chrome, que WhatsApp rechaza; ese fue el origen del fallo de entrega.)
 *
 * Toma el control de la fila del composer al montarse: graba → detiene →
 * previsualiza → enviar o descartar. Nunca envía automáticamente; sin caption.
 */

/** Worker del codificador, copiado a /public/opus (el wasm va inlined). */
const ENCODER_PATH = "/opus/encoderWorker.min.js";
/** WhatsApp espera el contenedor OGG; el códec Opus va dentro. */
const OGG_MIME = "audio/ogg";

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Phase = "recording" | "preview" | "error";

export function AudioRecorder({
  onSend,
  onCancel,
  busy,
}: {
  onSend: (file: File) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("recording");
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<RecorderT | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Inicia la grabación al montar; limpia recorder/timer/URL al desmontar.
  // `opus-recorder` se importa de forma dinámica (toca APIs del navegador y no
  // debe ejecutarse en el render del servidor de los Client Components).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: Recorder } = await import("opus-recorder");
      if (cancelled) return;

      if (!Recorder.isRecordingSupported()) {
        setErrorMsg("Tu navegador no permite grabar audio.");
        setPhase("error");
        return;
      }

      const recorder = new Recorder({
        encoderPath: ENCODER_PATH,
        numberOfChannels: 1,
        encoderSampleRate: 48000,
        encoderApplication: 2048, // VOIP: optimizado para voz
      });
      recorderRef.current = recorder;

      // `ondataavailable` entrega el OGG/Opus completo al detener.
      recorder.ondataavailable = (data) => {
        if (cancelled) return;
        const blob = new Blob([data], { type: OGG_MIME });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("preview");
      };

      try {
        await recorder.start();
        if (cancelled) {
          recorder.stop();
          return;
        }
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        setErrorMsg(
          "No se pudo acceder al micrófono. Revisa los permisos del navegador.",
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
      try {
        recorderRef.current?.close();
      } catch {
        // El recorder ya estaba cerrado; nada que hacer.
      }
      setPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    };
  }, []);

  function stop() {
    stopTimer();
    recorderRef.current?.stop();
  }

  function send() {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], `nota-de-voz-${seconds}s.ogg`, {
      type: OGG_MIME,
    });
    onSend(file);
  }

  if (phase === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <WarningCircleIcon className="size-3.5" />
          {errorMsg}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      {phase === "recording" ? (
        <>
          <span className="inline-flex size-2.5 shrink-0 animate-pulse rounded-full bg-red-600" />
          <span className="text-sm tabular-nums">{fmtSeconds(seconds)}</span>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            Grabando…
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCancel}
            aria-label="Descartar grabación"
          >
            <TrashIcon />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={stop}
            aria-label="Detener grabación"
          >
            <StopIcon />
          </Button>
        </>
      ) : (
        <>
          {previewUrl && (
            <audio src={previewUrl} controls className="h-9 flex-1" />
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={busy}
            onClick={onCancel}
            aria-label="Descartar audio"
          >
            <TrashIcon />
          </Button>
          <Button
            type="button"
            size="icon"
            disabled={busy}
            onClick={send}
            aria-label="Enviar audio"
          >
            <CheckIcon />
          </Button>
        </>
      )}
    </div>
  );
}
