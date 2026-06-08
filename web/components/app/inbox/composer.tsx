"use client";

import { useRef, useState } from "react";
import {
  FileTextIcon,
  ListBulletsIcon,
  MicrophoneIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationDtoT } from "@/lib/services/inbox/schemas";

import { AudioRecorder } from "./audio-recorder";
import { sendMessageRequest, uploadToBlob } from "./send-helpers";
import type { AttachmentDraft } from "./use-attachment-draft";

/** Tipos de archivo aceptados por el composer, por categoría. */
const ACCEPT_ALL =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

const MAX_TEXTAREA_PX = 160;

export function Composer({
  orgId,
  conversation,
  draft,
  onSent,
  onOpenTemplate,
  onOpenInteractive,
}: {
  orgId: string;
  conversation: ConversationDtoT;
  draft: AttachmentDraft;
  onSent: () => void;
  onOpenTemplate: () => void;
  onOpenInteractive: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const base = `/api/v1/orgs/${orgId}/inbox/conversations/${conversation.id}/messages`;
  const attachment = draft.attachment;
  // El micrófono aparece solo con el input vacío y sin adjunto (excluyente con
  // el texto): así el audio nunca convive con un caption.
  const showMic = !text.trim() && !attachment;

  if (!conversation.windowOpen) {
    return (
      <footer className="space-y-2 border-t p-3">
        <p className="rounded-md bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
          La ventana de 24 horas está cerrada. Solo puedes escribir mediante una
          plantilla.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onOpenTemplate}
        >
          <FileTextIcon /> Enviar plantilla
        </Button>
      </footer>
    );
  }

  function autoGrow() {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }

  function resetText() {
    setText("");
    if (textRef.current) textRef.current.style.height = "auto";
  }

  async function send() {
    if (sending) return;
    const value = text.trim();
    if (!attachment && !value) return;
    setSending(true);
    setError(null);
    try {
      if (attachment) {
        const { publicUrl, category } = await uploadToBlob(
          orgId,
          attachment.file,
        );
        await sendMessageRequest(base, {
          type: category,
          mediaUrl: publicUrl,
          // El audio no admite caption; el resto usa el texto como caption.
          ...(category !== "audio" && value ? { text: value } : {}),
          ...(category === "document" ? { filename: attachment.file.name } : {}),
        });
        draft.clear();
      } else {
        await sendMessageRequest(base, { type: "text", text: value });
      }
      resetText();
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function sendAudio(file: File) {
    setSending(true);
    setError(null);
    try {
      const { publicUrl, category } = await uploadToBlob(orgId, file);
      await sendMessageRequest(base, { type: category, mediaUrl: publicUrl });
      setAudioMode(false);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el audio.");
    } finally {
      setSending(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return; // pegado de texto normal
    e.preventDefault();
    draft.addFiles(files);
  }

  return (
    <footer className="space-y-1.5 border-t p-3">
      {(error || draft.error) && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <WarningCircleIcon className="size-3.5" />
          {error ?? draft.error}
        </p>
      )}

      {attachment && !audioMode && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2">
          {attachment.kind === "image" && attachment.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.previewUrl}
              alt="Adjunto"
              className="size-12 shrink-0 rounded object-cover"
            />
          ) : attachment.kind === "video" && attachment.previewUrl ? (
            <video
              src={attachment.previewUrl}
              className="size-12 shrink-0 rounded object-cover"
            />
          ) : (
            <PaperclipIcon className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm">
            {attachment.file.name}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={sending}
            onClick={draft.clear}
            aria-label="Quitar adjunto"
          >
            <XIcon />
          </Button>
        </div>
      )}

      {audioMode ? (
        <AudioRecorder
          onSend={sendAudio}
          onCancel={() => setAudioMode(false)}
          busy={sending}
        />
      ) : (
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ALL}
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) draft.addFiles(files);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
            aria-label="Adjuntar archivo"
          >
            <PaperclipIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sending}
            onClick={onOpenTemplate}
            aria-label="Enviar plantilla"
          >
            <FileTextIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sending}
            onClick={onOpenInteractive}
            aria-label="Enviar mensaje interactivo"
          >
            <ListBulletsIcon />
          </Button>
          <Textarea
            ref={textRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
            placeholder="Escribe un mensaje"
            className="max-h-40 min-h-9 resize-none"
          />
          {showMic ? (
            <Button
              type="button"
              size="icon"
              disabled={sending}
              onClick={() => setAudioMode(true)}
              aria-label="Grabar audio"
            >
              <MicrophoneIcon />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              disabled={sending || (!text.trim() && !attachment)}
              onClick={send}
              aria-label="Enviar mensaje"
            >
              <PaperPlaneTiltIcon />
            </Button>
          )}
        </div>
      )}
    </footer>
  );
}
