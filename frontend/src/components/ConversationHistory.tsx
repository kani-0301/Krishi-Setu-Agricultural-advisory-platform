"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

export interface HistoryEntry {
    query: string;
    advice: string;
    timestamp: number;
}

interface ConversationHistoryProps {
    entries: HistoryEntry[];
}

function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return `${Math.floor(diff / 3600)} hr ago`;
}

export default function ConversationHistory({ entries }: ConversationHistoryProps) {
    const [expanded, setExpanded] = useState<number | null>(null);
    const { lang } = useLanguage();

    if (entries.length === 0) return null;

    return (
        <section>
            <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(lang, "history.heading")}
                </h2>
            </div>

            <div className="space-y-2">
                {entries.map((entry, i) => {
                    const isOpen = expanded === i;
                    const preview = entry.advice.slice(0, 80) + (entry.advice.length > 80 ? "…" : "");

                    return (
                        <div key={i} className="rounded-xl bg-card border border-border overflow-hidden">
                            <button
                                onClick={() => setExpanded(isOpen ? null : i)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                                aria-expanded={isOpen}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {entry.query.length > 55 ? entry.query.slice(0, 55) + "…" : entry.query}
                                    </p>
                                    {!isOpen && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <span className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                                    {isOpen
                                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    }
                                </div>
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 border-t border-border">
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line mt-3">
                                        {entry.advice}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
