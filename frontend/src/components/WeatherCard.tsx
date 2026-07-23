"use client";

import { useEffect, useState } from "react";
import { Thermometer, Droplets, Wind, Leaf, MapPin } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/translations";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface WeatherData {
    city: string;
    temperature: number;
    humidity: number;
    condition: string;
    soil_temp: number | null;
    soil_moisture: number | null;
}

const conditionEmoji: Record<string, string> = {
    Clear: "☀️",
    Clouds: "⛅",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Thunderstorm: "⛈️",
    Snow: "❄️",
    Mist: "🌫️",
    Smoke: "🌫️",
    Haze: "🌁",
    Fog: "🌁",
};

interface WeatherCardProps {
    city?: string;
    onMount?: () => void;
}

export default function WeatherCard({ city = "Madurai", onMount }: WeatherCardProps) {
    const [data, setData] = useState<WeatherData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { lang } = useLanguage();

    useEffect(() => { onMount?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setData(null);
        setError(null);
        const cityName = city.trim() || "Madurai";
        fetch(`${BACKEND}/weather?city=${encodeURIComponent(cityName)}`)
            .then((r) => (r.ok ? r.json() : r.json().then((e: { detail: string }) => Promise.reject(e.detail))))
            .then(setData)
            .catch((msg: string) => setError(msg ?? "Could not load weather data."));
    }, [city]);

    if (error) {
        return (
            <section className="animate-fade-up">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                    {t(lang, "section.weather")}
                </h2>
                <div className="rounded-2xl glass border border-border/60 p-6 space-y-4">
                    <div className="shimmer h-10 w-1/3 rounded-xl" />
                    <div className="shimmer h-3 w-1/2 rounded-full" />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="shimmer h-14 rounded-xl" />
                        <div className="shimmer h-14 rounded-xl" />
                    </div>
                </div>
            </section>
        );
    }

    if (!data) {
        return (
            <section>
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                    {t(lang, "section.weather")}
                </h2>
                <div className="rounded-2xl glass border border-border p-6 space-y-4">
                    <div className="shimmer h-10 w-1/3 rounded-xl" />
                    <div className="shimmer h-3 w-1/2 rounded-full" />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="shimmer h-14 rounded-xl" />
                        <div className="shimmer h-14 rounded-xl" />
                    </div>
                </div>
            </section>
        );
    }

    const emoji = conditionEmoji[data.condition] ?? "🌤️";

    return (
        <section className="animate-fade-up">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Weather
                </h2>
                <div className="flex items-center gap-1 text-muted-foreground/60">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs">{data.city}</span>
                </div>
            </div>

            <div className="rounded-2xl glass border border-border/60 p-5 space-y-4
                            shadow-xl shadow-black/20 card-hover">
                {/* Main temp row */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-6xl font-bold text-foreground leading-none tracking-tight">
                            {data.temperature}°
                            <span className="text-2xl font-normal text-muted-foreground">C</span>
                        </p>
                        <p className="text-muted-foreground mt-1.5 text-base">{data.condition}</p>
                    </div>
                    <span className="text-7xl" role="img" aria-label={data.condition}>{emoji}</span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex items-center gap-2.5 rounded-xl bg-sky-400/8 border border-sky-400/15 px-3 py-2.5">
                        <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground">{t(lang, "weather.humidity")}</p>
                            <p className="text-sm font-semibold text-foreground">{data.humidity}%</p>
                        </div>
                    </div>

                    {data.soil_temp !== null ? (
                        <div className="flex items-center gap-2.5 rounded-xl bg-amber-400/8 border border-amber-400/15 px-3 py-2.5">
                            <Thermometer className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">{t(lang, "weather.soiltemp")}</p>
                                <p className="text-sm font-semibold text-foreground">{data.soil_temp}°C</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 rounded-xl bg-muted/30 border border-border px-3 py-2.5">
                            <Wind className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">{t(lang, "weather.condition")}</p>
                                <p className="text-sm font-semibold text-foreground">{data.condition}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Soil moisture bar */}
                {data.soil_moisture !== null && (
                    <div className="rounded-xl bg-emerald-400/8 border border-emerald-400/20 px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                                <p className="text-xs text-emerald-400/80 font-medium">{t(lang, "weather.soilmoisture")}</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-300">
                                {(data.soil_moisture * 100).toFixed(1)}%
                                <span className="text-xs font-normal text-muted-foreground ml-1">vol.</span>
                            </p>
                        </div>
                        {/* Moisture progress bar */}
                        <div className="h-1.5 rounded-full bg-emerald-400/15 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                                style={{ width: `${Math.min(data.soil_moisture * 100 * 5, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
