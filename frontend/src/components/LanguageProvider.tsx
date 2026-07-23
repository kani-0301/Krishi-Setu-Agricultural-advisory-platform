"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { Language } from "@/lib/translations";

interface LanguageContextValue {
    lang: Language;
    setLang: (l: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: "en",
    setLang: () => { },
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Language>("en");
    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
