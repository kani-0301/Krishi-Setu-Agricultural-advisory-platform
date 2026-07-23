"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ShoppingBasket, Activity } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const CROPS = ["tomato", "onion", "potato", "wheat", "rice", "cotton", "chilli", "soybean"];

interface PriceData {
    crop: string;
    modal_price: number;
    trend: "high" | "medium" | "low";
    market: string;
    demand_forecast?: "high" | "medium" | "low";
}

const trendConfig = {
    high: {
        label: "High",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/25",
        glow: "shadow-emerald-500/10",
        Icon: TrendingUp,
    },
    medium: {
        label: "Stable",
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/25",
        glow: "shadow-amber-500/10",
        Icon: Minus,
    },
    low: {
        label: "Low",
        color: "text-rose-400",
        bg: "bg-rose-400/10",
        border: "border-rose-400/25",
        glow: "shadow-rose-500/10",
        Icon: TrendingDown,
    },
};

// Demand forecast uses a separate purple/blue palette so it's visually distinct from price trend
const demandConfig = {
    high: {
        color: "text-violet-300",
        bg: "bg-violet-400/12",
        border: "border-violet-400/25",
        dot: "bg-violet-400",
    },
    medium: {
        color: "text-sky-300",
        bg: "bg-sky-400/12",
        border: "border-sky-400/25",
        dot: "bg-sky-400",
    },
    low: {
        color: "text-slate-400",
        bg: "bg-slate-400/10",
        border: "border-slate-400/20",
        dot: "bg-slate-400",
    },
};

function SinglePriceCard({ crop, lang }: { crop: string; lang: import("@/lib/translations").Language }) {
    const [data, setData] = useState<PriceData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch(`${BACKEND}/price?crop=${crop}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(setData)
            .catch(() => setError(true));
    }, [crop]);

    if (error || !data) {
        return (
            <div className="rounded-2xl bg-card/60 border border-border p-4 space-y-2">
                <div className="shimmer h-2.5 w-1/2 rounded-full" />
                <div className="shimmer h-6 w-3/4 rounded-full" />
                <div className="shimmer h-2.5 w-1/3 rounded-full" />
                <div className="shimmer h-5 w-1/2 rounded-full mt-1" />
            </div>
        );
    }

    const trend = trendConfig[data.trend] ?? trendConfig.medium;
    const { Icon } = trend;

    const demandKey = data.demand_forecast ?? null;
    const demand = demandKey ? demandConfig[demandKey] : null;
    const demandLabel = demandKey
        ? t(lang, `demand.${demandKey}`)
        : null;

    return (
        <div className={`card-hover rounded-2xl glass border p-4 flex flex-col gap-2.5 ${trend.border} shadow-lg ${trend.glow}`}>
            {/* Header */}
            <div className="flex items-center gap-1.5">
                <ShoppingBasket className="w-3.5 h-3.5 text-muted-foreground/70" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                    {data.crop}
                </span>
            </div>

            {/* Price */}
            <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                    ₹{data.modal_price.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{t(lang, "price.quintal")}</p>
            </div>

            {/* Market */}
            <p className="text-xs text-muted-foreground">{data.market}</p>

            {/* Price trend badge */}
            <span className={`inline-flex items-center gap-1 self-start text-xs font-semibold
                 px-2.5 py-1 rounded-full ${trend.bg} ${trend.color} border ${trend.border}`}>
                <Icon className="w-3 h-3" />
                {trend.label}
            </span>

            {/* Demand forecast badge */}
            {demand && demandLabel && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full self-start
                     border ${demand.bg} ${demand.border}`}>
                    <Activity className="w-3 h-3 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground/70 font-medium">
                        {t(lang, "demand.label")}:
                    </span>
                    <span className={`text-xs font-bold ${demand.color}`}>
                        {demandLabel}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${demand.dot} animate-pulse`} />
                </div>
            )}
        </div>
    );
}

export default function PriceCards() {
    const { lang } = useLanguage();
    return (
        <section className="animate-fade-up">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                {t(lang, "section.prices")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
                {CROPS.map((c) => (
                    <SinglePriceCard key={c} crop={c} lang={lang} />
                ))}
            </div>
        </section>
    );
}
