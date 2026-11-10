import { useState } from 'react';
import { Check, Languages } from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import { LOCALES, loadLocale, saveLocale } from '../../domain/locale';

const LanguagePage = () => {
  const [locale, setLocale] = useState(() => loadLocale());

  const choose = (id) => {
    setLocale(saveLocale(id));
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F0EFED] px-5 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-800">Idioma</h1>
            <p className="text-sm font-medium text-slate-500">El documento usa este idioma para la revisión, las fechas y el corrector.</p>
          </div>
        </div>
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Languages size={16} className="text-[#67BFA1]" />
            <h2 className="text-base font-black text-slate-800">Idioma de Pistache</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOCALES.map((item) => {
              const selected = locale === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item.id)}
                  aria-pressed={selected}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-[#67BFA1] bg-[#67BFA1]/12'
                      : 'border-gray-200 bg-white hover:border-[#67BFA1]/50'
                  }`}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-[#1f6b52] bg-[#1f6b52] text-white' : 'border-gray-300 text-transparent'}`}>
                    <Check size={12} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-slate-800">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LanguagePage;
