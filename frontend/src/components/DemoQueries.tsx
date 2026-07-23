"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";
import { AdvisoryResult } from "@/components/AIResponseCard";
import { useState, useCallback } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface DemoQueryItem {
    emoji: string;
    labelKey: string;
    queryKey: string;
}

const DEMO_QUERY_ITEMS: DemoQueryItem[] = [
    { emoji: "🍅", labelKey: "demo.tomato", queryKey: "demo.q.tomato" },
    { emoji: "🌾", labelKey: "demo.rice", queryKey: "demo.q.rice" },
    { emoji: "💰", labelKey: "demo.sell", queryKey: "demo.q.sell" },
    { emoji: "📊", labelKey: "demo.sellbest", queryKey: "demo.q.sellbest" },
    { emoji: "🌿", labelKey: "demo.community", queryKey: "demo.q.community" },
    { emoji: "☁️", labelKey: "demo.weather", queryKey: "demo.q.weather" },
    { emoji: "🌧️", labelKey: "demo.rain", queryKey: "demo.q.rain" },
    { emoji: "🌡️", labelKey: "demo.heat", queryKey: "demo.q.heat" },
];

interface DemoQueriesProps {
    onResult: (query: string, result: AdvisoryResult) => void;
    onError: (msg: string) => void;
    onLoading: () => void;
    disabled: boolean;
}

export default function DemoQueries({ onResult, onError, onLoading, disabled }: DemoQueriesProps) {
    const { lang } = useLanguage();
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const handleClick = useCallback(async (item: DemoQueryItem) => {
        if (disabled || activeKey) return;
        const query = t(lang, item.queryKey);
        setActiveKey(item.labelKey);
        onLoading();

        try {
            const res = await fetch(`${BACKEND}/voice-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: query }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { detail?: string }).detail ?? `Server error ${res.status}`);
            }
            const data: AdvisoryResult = await res.json();
            onResult(query, data);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Query failed.");
        } finally {
            setActiveKey(null);
        }
    }, [disabled, activeKey, lang, onLoading, onResult, onError]);

    return (
        <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                {t(lang, "section.quick")}
            </h2>
            <div className="flex flex-wrap gap-2">
                {DEMO_QUERY_ITEMS.map((item) => {
                    const isActive = activeKey === item.labelKey;
                    return (
                        <button
                            key={item.labelKey}
                            onClick={() => handleClick(item)}
                            disabled={disabled || !!activeKey}
                            aria-label={t(lang, item.labelKey)}
                            className={[
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                                "glass border transition-all duration-150",
                                isActive
                                    ? "border-primary/60 text-primary bg-primary/10 scale-95"
                                    : "border-border/40 text-foreground hover:border-primary/40 hover:text-primary active:scale-95",
                                disabled && !isActive ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                            ].join(" ")}
                        >
                            <span>{item.emoji}</span>
                            <span>{t(lang, item.labelKey)}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
