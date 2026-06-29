import { useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

const SHORTS = [
  { id: "6-SmYnkEAnw", align: "left" as const },
  { id: "wr4UYaLS5lg", align: "right" as const },
];

/** Miniatury Shorts — od najwyższej jakości (pionowe oar) w dół. */
function shortThumbnailCandidates(videoId: string): string[] {
  const base = `https://i.ytimg.com/vi/${videoId}`;
  return [
    `${base}/oardefault.jpg`,
    `${base}/maxresdefault.jpg`,
    `${base}/sddefault.jpg`,
    `${base}/hqdefault.jpg`,
  ];
}

function ShortPoster({ videoId }: { videoId: string }) {
  const candidates = shortThumbnailCandidates(videoId);
  const [index, setIndex] = useState(0);

  return (
    <img
      src={candidates[index]}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        setIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : prev));
      }}
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  );
}

function ShortCard({ videoId, align }: { videoId: string; align: "left" | "right" }) {
  const [playing, setPlaying] = useState(false);
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full max-w-[min(100%,400px)] ${
        align === "left"
          ? "md:mr-auto md:translate-x-[-clamp(0px,3vw,32px)]"
          : "md:ml-auto md:translate-x-[clamp(0px,3vw,32px)]"
      }`}
    >
      <div className="group rounded-[20px] bg-white p-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] ring-1 ring-neutral-200/80 transition-shadow duration-300 ease-out hover:shadow-[0_20px_50px_-14px_rgba(0,0,0,0.28)]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[16px] bg-neutral-950">
          {playing ? (
            <iframe
              src={embedSrc}
              title="Opinia użytkownika MarketingNow"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex h-full w-full items-center justify-center"
              aria-label="Odtwórz opinię wideo"
            >
              <ShortPoster videoId={videoId} />
              <span className="absolute inset-0 bg-neutral-950/20 transition-colors group-hover:bg-neutral-950/30" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-neutral-950 shadow-lg ring-1 ring-white/80 transition-transform group-hover:scale-105">
                <Play className="h-7 w-7 fill-current ml-1" />
              </span>
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function TestimonialsShorts() {
  return (
    <section id="poznaj-opinie" className="border-b border-neutral-200 bg-neutral-50/60 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 md:mb-16 text-center max-w-3xl mx-auto"
        >
          <h2 className="serif text-[clamp(2rem,5.5vw,3.75rem)] leading-[1.02] tracking-[-0.03em] text-neutral-950">
            Poznaj opinie
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-neutral-600">
            Zobacz, co mówią użytkownicy o pracy z MarketingNow — krótkie relacje w formacie Shorts.
          </p>
        </motion.div>

        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-8 lg:gap-10">
          {SHORTS.map((short) => (
            <ShortCard key={short.id} videoId={short.id} align={short.align} />
          ))}
        </div>
      </div>
    </section>
  );
}
