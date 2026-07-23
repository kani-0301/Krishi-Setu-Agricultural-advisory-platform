"use client";

import { useState, useRef } from "react";
import { Sprout, Globe } from "lucide-react";
import MicButton, { VoiceResult } from "@/components/MicButton";
import AIResponseCard, { AdvisoryResult } from "@/components/AIResponseCard";
import PriceCards from "@/components/PriceCards";
import WeatherCard from "@/components/WeatherCard";
import DemoQueries from "@/components/DemoQueries";
import TextInput from "@/components/TextInput";
import ConversationHistory, { HistoryEntry } from "@/components/ConversationHistory";
import { saveToCache, loadFromCache, pruneCache } from "@/lib/cache";
import { useLanguage } from "@/components/LanguageProvider";
import { translations, t, type Language } from "@/lib/translations";

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "mr", label: "मराठी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "bn", label: "বাংলা" },
];

const LOADING_STEPS_KEYS = [
  "loading.detecting",
  "loading.price",
  "loading.weather",
  "loading.icar",
  "loading.generating",
];

type Result = AdvisoryResult | VoiceResult | null;

export default function HomePage() {
  const { lang, setLang } = useLanguage();
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>(t(lang, LOADING_STEPS_KEYS[0]));
  const [fromCache, setFromCache] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [userCity, setUserCity] = useState<string>("Madurai");
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advisoryRef = useRef<HTMLElement | null>(null);
  const cityDetected = useRef(false);

  const detectUserCity = () => {
    if (cityDetected.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en", "User-Agent": "Krishi-Setu/1.0" } }
          );
          const data = await res.json();
          const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || "Madurai";
          setUserCity(city);
          cityDetected.current = true;
        } catch { /* keep default */ }
      },
      () => { /* permission denied */ }
    );
  };

  const triggerCityDetect = () => { if (!cityDetected.current) detectUserCity(); };

  const startLoadingSteps = () => {
    let i = 0;
    setLoadingStep(t(lang, LOADING_STEPS_KEYS[0]));
    stepTimerRef.current = setInterval(() => {
      i = (i + 1) % LOADING_STEPS_KEYS.length;
      setLoadingStep(t(lang, LOADING_STEPS_KEYS[i]));
    }, 2200);
  };

  const stopLoadingSteps = () => {
    if (stepTimerRef.current) { clearInterval(stepTimerRef.current); stepTimerRef.current = null; }
  };

  const scrollToAdvisory = () => {
    setTimeout(() => advisoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const addToHistory = (query: string, advisory: AdvisoryResult) => {
    setHistory(prev => [{ query, advice: advisory.advice, timestamp: Date.now() }, ...prev].slice(0, 5));
  };

  const handleAdvisoryResult = (query: string, advisory: AdvisoryResult) => {
    stopLoadingSteps();
    saveToCache(query, advisory);
    addToHistory(query, advisory);
    setResult(advisory);
    setFromCache(false);
    setError(null);
    setLoading(false);
    scrollToAdvisory();
  };

  const handleVoiceResult = (voice: VoiceResult) => {
    stopLoadingSteps();
    setResult(voice);
    setFromCache(false);
    setError(null);
    setLoading(false);
    scrollToAdvisory();
  };

  const handleError = (msg: string) => {
    stopLoadingSteps();
    if (msg.includes("offline") || msg.includes("fetch") || msg.includes("network")) {
      const store = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("krishi_cache") ?? "{}") : {};
      const keys = Object.keys(store);
      if (keys.length > 0) {
        const cached = loadFromCache(keys[keys.length - 1]);
        if (cached) { setResult(cached as AdvisoryResult); setFromCache(true); setError(null); setLoading(false); return; }
      }
    }
    setError(msg);
    setResult(null);
    setFromCache(false);
    setLoading(false);
  };

  const handleLoadingStart = () => {
    pruneCache();
    setLoading(true);
    setError(null);
    setFromCache(false);
    startLoadingSteps();
    scrollToAdvisory();
    triggerCityDetect();
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Glassmorphic Sticky Header ─────────────────────────────── */}
      <header className="sticky top-0 z-20 glass border-b border-border/50 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <Sprout className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">Krishi-Setu</span>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="text-sm glass border-border/40 rounded-xl px-3 py-1.5
                       focus:outline-none focus:ring-2 focus:ring-primary
                       text-foreground cursor-pointer"
            aria-label="Select language"
          >
            {LANG_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-16 space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-12 flex flex-col items-center gap-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {t(lang, "hero.title")}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {t(lang, "hero.subtitle")}
            </p>
          </div>

          <MicButton
            onResult={(r: VoiceResult) => { handleLoadingStart(); handleVoiceResult(r); }}
            onError={handleError}
            targetLang={lang}
          />

          {/* ── Text input ─────────────────────────────────────────── */}
          <div className="w-full">
            <TextInput
              onResult={handleAdvisoryResult}
              onError={handleError}
              onLoading={handleLoadingStart}
              disabled={loading}
            />
          </div>
        </section>

        {/* ── Demo query chips ──────────────────────────────────────── */}
        <DemoQueries
          onResult={handleAdvisoryResult}
          onError={handleError}
          onLoading={handleLoadingStart}
          disabled={loading}
        />

        {/* ── AI Response ───────────────────────────────────────────── */}
        <section ref={advisoryRef} className="animate-fade-up">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-4">
            {t(lang, "section.advisory")}
          </h2>
          <AIResponseCard
            result={result}
            error={error}
            loading={loading}
            loadingStep={loadingStep}
            fromCache={fromCache}
          />
        </section>

        {/* ── Conversation history ──────────────────────────────────── */}
        <ConversationHistory entries={history} />

        {/* ── Weather ───────────────────────────────────────────────── */}
        <WeatherCard city={userCity} onMount={triggerCityDetect} />

        {/* ── Market Prices ─────────────────────────────────────────── */}
        <PriceCards />
      </main>
    </div>
  );
}
