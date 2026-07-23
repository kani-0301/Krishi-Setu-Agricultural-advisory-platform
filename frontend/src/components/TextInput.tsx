"use client";

import { useState, useRef, useCallback, FormEvent, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { AdvisoryResult } from "@/components/AIResponseCard";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface TextInputProps {
    onResult: (query: string, result: AdvisoryResult) => void;
    onError: (msg: string) => void;
    onLoading: () => void;
    disabled: boolean;
}

export default function TextInput({ onResult, onError, onLoading, disabled }: TextInputProps) {
    const [text, setText] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { lang } = useLanguage();

    // Auto-resize textarea height
    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    };

    const submit = useCallback(async () => {
        const query = text.trim();
        if (!query || disabled) return;

        setText("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
        onLoading();

        try {
            const res = await fetch(`${BACKEND}/voice-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: query, target_lang: lang }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { detail?: string }).detail ?? `Server error ${res.status}`);
            }

            const data: AdvisoryResult = await res.json();
            onResult(query, data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Query failed.";
            if (msg.includes("fetch") || msg.includes("Failed")) {
                onError("📡 You appear to be offline. Showing last saved response if available.");
            } else {
                onError(`⚠️ ${msg}`);
            }
        }
    }, [text, disabled, onLoading, onResult, onError]);

    const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        submit();
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="relative glow-focus rounded-2xl glass transition-all duration-200"
        >
            <textarea
                ref={textareaRef}
                rows={1}
                value={text}
                onChange={(e) => { setText(e.target.value); autoResize(); }}
                onKeyDown={handleKey}
                disabled={disabled}
                placeholder={t(lang, "input.placeholder")}
                aria-label={t(lang, "input.aria")}
                className={[
                    "w-full resize-none bg-transparent rounded-2xl pl-4 pr-14 py-4",
                    "text-sm text-foreground placeholder:text-muted-foreground/60",
                    "focus:outline-none leading-relaxed",
                    disabled ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
                style={{ minHeight: "52px", maxHeight: "140px" }}
            />

            <button
                type="submit"
                disabled={!text.trim() || disabled}
                aria-label="Send question"
                className={[
                    "absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center",
                    "transition-all duration-150",
                    text.trim() && !disabled
                        ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                ].join(" ")}
            >
                {disabled
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                }
            </button>
        </form>
    );
}
