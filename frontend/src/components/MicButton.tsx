"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface VoiceResult {
    transcription: string;
    response_text: string;
    audio_url: string;
}

interface MicButtonProps {
    onResult: (result: VoiceResult) => void;
    onError: (msg: string) => void;
    targetLang?: string;
}

type RecordState = "idle" | "recording" | "processing";

export default function MicButton({ onResult, onError, targetLang = "en" }: MicButtonProps) {
    const [state, setState] = useState<RecordState>("idle");
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const { lang } = useLanguage();

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            chunks.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                setState("processing");

                const blob = new Blob(chunks.current, { type: "audio/webm" });
                const form = new FormData();
                form.append("audio_file", blob, "question.webm");
                form.append("target_lang", targetLang);

                try {
                    const res = await fetch(`${BACKEND}/voice`, { method: "POST", body: form });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error((err as { detail?: string }).detail ?? `Server error ${res.status}`);
                    }
                    const data: VoiceResult = await res.json();
                    onResult(data);
                } catch (err) {
                    onError(err instanceof Error ? err.message : "Voice query failed.");
                } finally {
                    setState("idle");
                }
            };

            recorder.start();
            mediaRecorder.current = recorder;
            setState("recording");
        } catch {
            onError(t(lang, "mic.denied"));
            setState("idle");
        }
    }, [onError, onResult, targetLang]);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current?.state === "recording") {
            mediaRecorder.current.stop();
        }
    }, []);

    const label =
        state === "recording"
            ? t(lang, "mic.recording")
            : state === "processing"
                ? t(lang, "mic.processing")
                : t(lang, "mic.idle");

    return (
        <div className="flex flex-col items-center gap-5 select-none">
            {/* Outer decorative ring */}
            <div className={[
                "relative rounded-full p-2 transition-all duration-300",
                state === "recording"
                    ? "bg-destructive/10"
                    : "bg-primary/8",
            ].join(" ")}>
                {/* Middle ring */}
                <div className={[
                    "rounded-full p-2.5 transition-all duration-300",
                    state === "recording"
                        ? "bg-destructive/15"
                        : "bg-primary/10",
                ].join(" ")}>
                    {/* The mic button */}
                    <button
                        onPointerDown={state === "idle" ? startRecording : undefined}
                        onPointerUp={state === "recording" ? stopRecording : undefined}
                        onPointerLeave={state === "recording" ? stopRecording : undefined}
                        disabled={state === "processing"}
                        aria-label={label}
                        className={[
                            "relative w-24 h-24 rounded-full flex items-center justify-center",
                            "text-primary-foreground transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary",
                            state === "idle"
                                ? [
                                    "cursor-pointer active:scale-95",
                                    "bg-gradient-to-br from-primary via-green-400 to-emerald-600",
                                    "shadow-2xl shadow-primary/40",
                                    "hover:shadow-primary/60 hover:scale-105",
                                ].join(" ")
                                : state === "recording"
                                    ? "bg-destructive mic-pulse cursor-pointer scale-110 shadow-2xl shadow-destructive/40"
                                    : "bg-muted cursor-not-allowed opacity-70",
                        ].join(" ")}
                    >
                        {state === "processing" ? (
                            <Loader2 className="w-10 h-10 animate-spin" />
                        ) : state === "recording" ? (
                            <MicOff className="w-10 h-10" />
                        ) : (
                            <Mic className="w-10 h-10" />
                        )}
                    </button>
                </div>
            </div>

            <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
                {label}
            </p>
        </div>
    );
}
