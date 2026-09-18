import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/i18n'; // ensure i18n is initialized
import { LANGUAGE_OPTIONS, LangKey } from '../lib/i18n';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGE_OPTIONS.find(l => l.code === i18n.language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLang = (code: LangKey) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:border-red-300 hover:bg-red-50 transition-all text-sm font-medium text-neutral-700 shadow-sm"
        aria-label="Switch language"
      >
        <span className="text-base">🌐</span>
        {!compact && <span>{current.nativeLabel}</span>}
        {compact && <span>{current.nativeLabel}</span>}
        <svg className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-up">
          {LANGUAGE_OPTIONS.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLang(lang.code)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'bg-red-50 text-red-700 font-semibold'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <span>{lang.label}</span>
              <span className="text-base font-bold text-neutral-500">{lang.nativeLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
