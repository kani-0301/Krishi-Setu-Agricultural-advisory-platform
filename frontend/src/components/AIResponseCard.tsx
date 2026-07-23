"use client";

import { useRef, useState } from "react";
import {
    Volume2, AlertCircle, Quote, ChevronDown, ChevronUp,
    TrendingUp, TrendingDown, Minus, Droplets, Thermometer, BookOpen,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────
export interface AdvisoryResult {
    advice: string;
    price: Record<string, unknown> | null;
    weather: Record<string, unknown> | null;
    sources: string[];
    market_insight?: Record<string, unknown> | null;  // Phase 10 sell analysis
    community_tips?: Array<{                           // Phase 11 community knowledge
        author: string;
        location: string;
        topic: string;
        upvotes: number;
        tip: string;
    }>;
}

// Kept for voice (audio) pipeline compatibility
export interface VoiceResult {
    transcription: string;
    response_text: string;
    audio_url: string;
}

interface AIResponseCardProps {
    result: AdvisoryResult | VoiceResult | null;
    error: string | null;
    loading: boolean;
    loadingStep?: string;  // e.g. "Fetching price data…"
    fromCache?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isAdvisory(r: AdvisoryResult | VoiceResult): r is AdvisoryResult {
    return "advice" in r;
}

function renderAdviceText(text: string) {
    return text.split("\n").map((line, i) => {
        const upper = line.toUpperCase();
        if (upper.startsWith("DO:") && !upper.startsWith("DON'T:")) {
            return (
                <div key={i} className="border-l-4 border-emerald-500 pl-3 py-1 bg-emerald-400/5 rounded-r-lg">
                    <span className="font-bold text-emerald-400">DO:</span>
                    <span className="text-foreground">{line.slice(3)}</span>
                </div>
            );
        }
        if (upper.startsWith("DON'T:") || upper.startsWith("DONT:")) {
            const idx = line.indexOf(":") + 1;
            return (
                <div key={i} className="border-l-4 border-rose-500 pl-3 py-1 bg-rose-400/5 rounded-r-lg">
                    <span className="font-bold text-rose-400">DON&apos;T:</span>
                    <span className="text-foreground">{line.slice(idx)}</span>
                </div>
            );
        }
        if (line.startsWith("Source:")) {
            return (
                <p key={i} className="text-xs text-muted-foreground mt-2 italic">{line}</p>
            );
        }
        return line ? <p key={i} className="text-foreground leading-relaxed">{line}</p> : <br key={i} />;
    });
}

const TREND_CFG = {
    rising: { label: "Rising", color: "text-emerald-400", Icon: TrendingUp },
    falling: { label: "Falling", color: "text-rose-400", Icon: TrendingDown },
    stable: { label: "Stable", color: "text-amber-400", Icon: Minus },
};

function ReasoningAccordion({ result }: { result: AdvisoryResult }) {
    const [open, setOpen] = useState(false);
    const { lang } = useLanguage();
    const mi = result.market_insight as Record<string, Record<string, unknown>> | null | undefined;
    const tips = result.community_tips ?? [];
    const hasReasoning = result.price || result.weather || result.sources.length > 0 || mi || tips.length > 0;
    if (!hasReasoning) return null;


    const trend = (result.price?.trend as string) ?? "medium";
    // Map price trend (high/medium/low) to TREND_CFG keys (rising/stable/falling)
    const priceToTrendKey = (t: string): keyof typeof TREND_CFG =>
        t === "high" ? "rising" : t === "low" ? "falling" : "stable";
    const CfgForPrice = TREND_CFG[priceToTrendKey(trend)];
    const TrendIcon = CfgForPrice.Icon;

    // Market insight sub-data
    const miTrend = mi?.trend as Record<string, unknown> | undefined;
    const miArb = mi?.arbitrage as Record<string, unknown> | undefined;
    const miLocal = mi?.local_market as Record<string, unknown> | undefined;
    const miBest = mi?.best_market as Record<string, unknown> | undefined;
    const trendLabel = (miTrend?.label as string ?? "stable") as keyof typeof TREND_CFG;
    const TrendCfg = TREND_CFG[trendLabel] ?? TREND_CFG.stable;

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
            >
                <span className="font-medium text-muted-foreground">{t(lang, "reasoning.toggle")}</span>
                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-4 pt-3">

                    {/* ── Market Outlook (Phase 10) ─── */}
                    {mi && miLocal && miBest && miArb && (
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2.5">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                                {t(lang, "reasoning.market")}
                            </p>

                            {/* Local vs Best comparison row */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                    <p className="text-xs text-muted-foreground">Local ({String(miLocal.name)})</p>
                                    <p className="text-sm font-bold text-foreground">₹{String(miLocal.price)}<span className="text-xs font-normal text-muted-foreground">/qtl</span></p>
                                </div>
                                <div className="rounded-lg bg-emerald-400/10 border border-emerald-400/20 px-3 py-2">
                                    <p className="text-xs text-muted-foreground">Best ({String(miBest.name)})</p>
                                    <p className="text-sm font-bold text-emerald-300">₹{String(miBest.price)}<span className="text-xs font-normal text-muted-foreground">/qtl</span></p>
                                </div>
                            </div>

                            {/* Net gain + trend + sell_now badge */}
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                    {t(lang, "market.net_gain")}:
                                    <span className={`ml-1 font-semibold ${Number(miArb.net_gain) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {Number(miArb.net_gain) >= 0 ? '+' : ''}₹{String(miArb.net_gain)}/qtl
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted/40 ${TrendCfg.color}`}>
                                        <TrendCfg.Icon className="w-3 h-3" />
                                        {TrendCfg.label}
                                    </span>
                                    {mi.sell_now !== undefined && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mi.sell_now ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'
                                            }`}>
                                            {mi.sell_now ? t(lang, "market.sell_now") : t(lang, "market.wait")}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* AI recommendation */}
                            {mi.recommendation && (
                                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                                    💡 {String(mi.recommendation)}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Market Price */}
                    {result.price && (
                        <div className="flex items-start gap-2">
                            <TrendIcon className={`w-4 h-4 mt-0.5 ${CfgForPrice.color}`} />
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t(lang, "reasoning.price")}</p>
                                <p className="text-sm font-medium text-foreground">
                                    {String(result.price.crop).charAt(0).toUpperCase() + String(result.price.crop).slice(1)}
                                    {" "}— ₹{String(result.price.modal_price)}/qtl
                                    <span className={`ml-2 text-xs ${CfgForPrice.color}`}>
                                        {String(trend).toUpperCase()}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">{String(result.price.market)} Mandi</p>
                            </div>
                        </div>
                    )}

                    {/* Weather */}
                    {result.weather && (
                        <div className="flex items-start gap-2">
                            <Thermometer className="w-4 h-4 mt-0.5 text-sky-400" />
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t(lang, "reasoning.weather")}</p>
                                <p className="text-sm font-medium text-foreground">
                                    {String(result.weather.city)} — {String(result.weather.temperature)}°C — {String(result.weather.condition)}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-muted-foreground">
                                        💧 {t(lang, "weather.humidity")}: {String(result.weather.humidity)}%
                                    </span>
                                    {result.weather.soil_moisture != null && (
                                        <div className="flex items-center gap-1">
                                            <Droplets className="w-3 h-3 text-emerald-400" />
                                            <p className="text-xs text-muted-foreground">
                                                Soil {(Number(result.weather.soil_moisture) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ICAR sources */}
                    {result.sources.length > 0 && (
                        <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t(lang, "reasoning.icar")}</p>
                                {result.sources.map((src, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">{src}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Community Voices (Phase 11) */}
                    {tips.length > 0 && (
                        <div className="space-y-2.5">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                <span className="text-base">🌾</span>
                                {t(lang, "reasoning.community")}
                            </p>
                            {tips.map((tip, i) => (
                                <div
                                    key={i}
                                    className="rounded-xl border-l-4 border-primary/50 bg-primary/5 pl-3 pr-3 py-3 space-y-1.5"
                                >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs font-semibold text-foreground">{tip.author}</span>
                                        <span className="text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full">📍 {tip.location}</span>
                                        <span className="text-xs text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">{tip.topic}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">👍 {tip.upvotes}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed italic">&ldquo;{tip.tip}&rdquo;</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AIResponseCard({
    result,
    error,
    loading,
    loadingStep,
    fromCache,
}: AIResponseCardProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { lang } = useLanguage();

    const playAudio = (url: string) => {
        const fullUrl = `${BACKEND}${url}`;
        if (!audioRef.current) {
            audioRef.current = new Audio(fullUrl);
        } else {
            audioRef.current.src = fullUrl;
        }
        audioRef.current.play().catch(() => {
            audioRef.current = new Audio(fullUrl);
            audioRef.current?.play();
        });
    };

    // Loading state with step indicator
    if (loading) {
        return (
            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">
                        {loadingStep ?? "Thinking…"}
                    </p>
                </div>
                <div className="space-y-3">
                    <div className="shimmer h-4 w-3/4 rounded-full" />
                    <div className="shimmer h-4 w-full rounded-full" />
                    <div className="shimmer h-4 w-5/6 rounded-full" />
                </div>
            </div>
        );
    }

    // Error state — soft warning (not alarming red)
    if (error) {
        return (
            <div className="rounded-2xl bg-amber-400/8 border border-amber-400/25 p-5 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200 font-medium">{error}</p>
            </div>
        );
    }

    // Empty state
    if (!result) {
        return (
            <div className="rounded-2xl bg-card border border-border p-7 text-center">
                <Quote className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(lang, "advisory.empty")}
                </p>
            </div>
        );
    }

    // ── Voice audio result (POST /voice response) ──────────────────────────
    if (!isAdvisory(result)) {
        return (
            <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{t(lang, "voice.asked")}</p>
                    <p className="text-sm italic text-muted-foreground">&ldquo;{result.transcription}&rdquo;</p>
                </div>
                <hr className="border-border" />
                <div className="space-y-2">{renderAdviceText(result.response_text)}</div>
                {result.audio_url && (
                    <button
                        onClick={() => playAudio(result.audio_url)}
                        className="flex items-center gap-2 w-full justify-center py-3 rounded-xl
                       bg-primary/20 hover:bg-primary/30 active:scale-95
                       text-primary font-semibold transition-all duration-150"
                    >
                        <Volume2 className="w-5 h-5" /> {t(lang, "voice.play")}
                    </button>
                )}
            </div>
        );
    }

    // ── Advisory result (POST /voice-query or demo chip) ───────────────────
    return (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
            {fromCache && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
                    <span>⚡</span>
                    <span>{t(lang, "advisory.cached")}</span>
                </div>
            )}

            <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                    {t(lang, "advisory.label")}
                </p>
                <div className="space-y-2">{renderAdviceText(result.advice)}</div>
            </div>

            <ReasoningAccordion result={result} />
        </div>
    );
}
