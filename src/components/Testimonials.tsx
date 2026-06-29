import { useEffect, useState } from "react";
import { sfx } from "@/lib/sounds";

type Review = {
  id: string;
  name: string;
  role?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: number;
};

const SEED: Review[] = [
  { id: "s1", name: "Marta K.", role: "Founder, e-commerce", rating: 5, text: "Pierwsza kampania w 7 minut. Konwersja w Meta lepsza niż u poprzedniej agencji za 6 000 zł/mies.", createdAt: 0 },
  { id: "s2", name: "Tomek W.", role: "DTC, kosmetyki", rating: 5, text: "Polskie copy bez korpomowy. Wreszcie nie brzmi jak tłumaczenie z angielskiego.", createdAt: 0 },
  { id: "s3", name: "Ola B.", role: "SaaS B2B", rating: 4, text: "Świetne do briefów i kreacji. Brakuje mi natywnej integracji z LinkedIn Ads — obiecali, że będzie.", createdAt: 0 },
  { id: "s4", name: "Paweł R.", role: "Sklep stacjonarny + online", rating: 4, text: "Robi 80% roboty stratega. Końcówkę i tak warto przejrzeć ręką, ale czas spadł 5x.", createdAt: 0 },
  { id: "s5", name: "Kamil S.", role: "Solo founder", rating: 3, text: "Działa git, kampanie OK — ale dla mnie za drogo na start. Mini plan ratuje sytuację, gdyby nie on, dałbym 2.", createdAt: 0 },
  { id: "s6", name: "Iza P.", role: "Agencja, 4 osoby", rating: 3, text: "Jakość kreacji bardzo dobra. Cena Pro jak dla mnie za wysoka — wolałabym pakiet 2 000 kredytów w środku.", createdAt: 0 },
  { id: "s7", name: "Jakub D.", role: "Marketplace", rating: 5, text: "Audyt konta Google Ads wykrył 3 kampanie palące budżet. Zwrot z subskrypcji w pierwszym tygodniu.", createdAt: 0 },
  { id: "s8", name: "Ewa N.", role: "Studio jogi", rating: 4, text: "Nie znałam się na reklamach. MarketingNow prowadzi krok po kroku, jakbym miała stratega na etacie.", createdAt: 0 },
];

const KEY = "mn.reviews.v1";

function load(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Review[]) : [];
  } catch { return []; }
}
function save(rs: Review[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rs)); } catch { /* noop */ }
}

function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (v: 1|2|3|4|5) => void; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Ocena: ${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={onChange ? () => { sfx.tap(); onChange(n as 1|2|3|4|5); } : undefined}
            disabled={!onChange}
            className={`${onChange ? "cursor-pointer" : "cursor-default"} leading-none`}
            aria-label={`${n} z 5`}
          >
            <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" className={filled ? "text-neutral-950" : "text-neutral-400"}>
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78L1.58 7.62l5.82-.85L10 1.5z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export function Testimonials() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const user = load();
    setReviews([...user, ...SEED]);
  }, []);

  const addReview = (r: Omit<Review, "id" | "createdAt">) => {
    const item: Review = { ...r, id: crypto.randomUUID(), createdAt: Date.now() };
    const next = [item, ...load()];
    save(next);
    setReviews([item, ...reviews]);
    sfx.success();
  };

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;

  return (
    <section id="opinie" className="border-b border-neutral-200 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-20 md:py-32">
        <div className="mb-12 max-w-5xl">
          <h2 className="serif text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] tracking-[-0.03em]">
            Co mówią <span className="italic font-light">użytkownicy</span>.
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-[14px] text-neutral-700">
            <Stars value={Math.round(avg)} />
            <span className="serif text-[20px]">{avg.toFixed(1)}</span>
            <span className="text-neutral-500">· {reviews.length} opinii</span>
            <button
              onClick={() => { sfx.tap(); setOpen(true); }}
              className="ml-0 sm:ml-auto text-[12px] uppercase tracking-[0.16em] border border-neutral-950 px-4 py-2 hover:bg-neutral-950 hover:text-white transition-colors"
            >
              Dodaj opinię
            </button>
          </div>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 border border-neutral-200">
          {reviews.map((r) => (
            <li key={r.id} className="bg-white p-6 md:p-8 flex flex-col gap-3">
              <Stars value={r.rating} size={16} />
              <p className="text-[15px] leading-[1.55] text-neutral-800 flex-1">"{r.text}"</p>
              <div className="pt-3 border-t border-neutral-100">
                <p className="serif text-[18px] tracking-tight">{r.name}</p>
                {r.role && <p className="text-[12px] uppercase tracking-[0.16em] text-neutral-500 mt-1">{r.role}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {open && <ReviewModal onClose={() => setOpen(false)} onSubmit={addReview} />}
    </section>
  );
}

function ReviewModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (r: Omit<Review, "id" | "createdAt">) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState<1|2|3|4|5>(5);
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    onSubmit({ name: name.trim(), role: role.trim() || undefined, rating, text: text.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg border border-neutral-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 md:p-8">
          <p className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">Opinia</p>
          <h3 className="serif text-[28px] tracking-tight mt-1">Podziel się wrażeniem</h3>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-2">Ocena</label>
              <Stars value={rating} onChange={setRating} size={26} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-2">Imię</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-neutral-300 px-3 py-2 text-[15px] outline-none focus:border-neutral-950"
                placeholder="np. Anna K."
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-2">Rola / firma (opcjonalnie)</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-neutral-300 px-3 py-2 text-[15px] outline-none focus:border-neutral-950"
                placeholder="np. Founder, e-commerce"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-neutral-500 mb-2">Opinia</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={4}
                className="w-full border border-neutral-300 px-3 py-2 text-[15px] outline-none focus:border-neutral-950"
                placeholder="Napisz krótko, co Ci się podobało lub czego brakuje..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 text-[13px] uppercase tracking-[0.14em] py-3 border border-neutral-300 hover:bg-neutral-100 transition">
                Anuluj
              </button>
              <button type="submit" className="flex-1 text-[13px] uppercase tracking-[0.14em] py-3 border border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 transition">
                Opublikuj
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
