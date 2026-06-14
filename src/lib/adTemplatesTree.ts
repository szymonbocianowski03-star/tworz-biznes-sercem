import tplAdvertorialEditorial from "@/skills/marketing/templates/advertorial-editorial.md?raw";
import tplBenefitListSplit from "@/skills/marketing/templates/benefit-list-split.md?raw";
import tplBenefitSplitInformationDense from "@/skills/marketing/templates/benefit-split-information-dense.md?raw";
import tplComparisonGridTable from "@/skills/marketing/templates/comparison-grid-table.md?raw";
import tplCuriosityGapHookTestimonial from "@/skills/marketing/templates/curiosity-gap-hook-testimonial.md?raw";
import tplCuriosityGapScrollStopper from "@/skills/marketing/templates/curiosity-gap-scroll-stopper.md?raw";
import tplFauxIphoneNotes from "@/skills/marketing/templates/faux-iphone-notes.md?raw";
import tplFauxPressNewsScreenshot from "@/skills/marketing/templates/faux-press-news-screenshot.md?raw";
import tplFeatureArrowCallout from "@/skills/marketing/templates/feature-arrow-callout.md?raw";
import tplFeaturesBenefits from "@/skills/marketing/templates/features-benefits.md?raw";
import tplFlavorStoryTastesLike from "@/skills/marketing/templates/flavor-story-tastes-like.md?raw";
import tplGradientBannerBenefits from "@/skills/marketing/templates/gradient-banner-benefits.md?raw";
import tplGradientBoldStatement from "@/skills/marketing/templates/gradient-bold-statement.md?raw";
import tplHeadline from "@/skills/marketing/templates/headline.md?raw";
import tplHeroProductShowcaseStatBar from "@/skills/marketing/templates/hero-product-showcase-stat-bar.md?raw";
import tplHeroStatementIconBar from "@/skills/marketing/templates/hero-statement-icon-bar.md?raw";
import tplHeroStatementIconBarPromo from "@/skills/marketing/templates/hero-statement-icon-bar-promo.md?raw";
import tplHighlightedTestimonial from "@/skills/marketing/templates/highlighted-testimonial.md?raw";
import tplLifestyleActionColorwayArray from "@/skills/marketing/templates/lifestyle-action-colorway-array.md?raw";
import tplLongFormManifesto from "@/skills/marketing/templates/long-form-manifesto.md?raw";
import tplNegativeMarketing from "@/skills/marketing/templates/negative-marketing.md?raw";
import tplOfferPromotion from "@/skills/marketing/templates/offer-promotion.md?raw";
import tplPostItNoteUglyOrganic from "@/skills/marketing/templates/post-it-note-ugly-organic.md?raw";
import tplPressEditorial from "@/skills/marketing/templates/press-editorial.md?raw";
import tplProductCommentCallout from "@/skills/marketing/templates/product-comment-callout.md?raw";
import tplPullQuoteReviewCard from "@/skills/marketing/templates/pull-quote-review-card.md?raw";
import tplScrollStopper from "@/skills/marketing/templates/scroll-stopper.md?raw";
import tplSocialCommentScreenshot from "@/skills/marketing/templates/social-comment-screenshot.md?raw";
import tplSocialProof from "@/skills/marketing/templates/social-proof.md?raw";
import tplStatCalloutDataDrivenLifestyle from "@/skills/marketing/templates/stat-callout-data-driven-lifestyle.md?raw";
import tplStatSurroundCalloutRadial from "@/skills/marketing/templates/stat-surround-callout-radial.md?raw";
import tplStatSurroundFlatlay from "@/skills/marketing/templates/stat-surround-flatlay.md?raw";
import tplTestimonials from "@/skills/marketing/templates/testimonials.md?raw";
import tplTiktokBeforeAfter from "@/skills/marketing/templates/tiktok-before-after.md?raw";
import tplUgcLifestyleReviewCardSplit from "@/skills/marketing/templates/ugc-lifestyle-review-card-split.md?raw";
import tplUgcStoryCallout from "@/skills/marketing/templates/ugc-story-callout.md?raw";
import tplUgcViralPostOverlay from "@/skills/marketing/templates/ugc-viral-post-overlay.md?raw";
import tplUsVsThem from "@/skills/marketing/templates/us-vs-them.md?raw";
import tplUsVsThemColorSplit from "@/skills/marketing/templates/us-vs-them-color-split.md?raw";
import tplVerifiedReviewCard from "@/skills/marketing/templates/verified-review-card.md?raw";
import tplWhiteboardBeforeAfter from "@/skills/marketing/templates/whiteboard-before-after.md?raw";

export type AdTemplateFileNode = {
  kind: "file";
  id: string;
  name: string;
  description: string;
  content: string;
};

/** Płaska lista szablonów pod `Ad Templates → templates` (alfabetycznie po nazwie, UI po polsku). */
export const adTemplateFileNodes: AdTemplateFileNode[] = [
  {
    kind: "file",
    id: "marketing/templates/advertorial-editorial.md",
    name: "Advertorial / editorial.md",
    description: "4:5 · editorial organiczny, portret + strefa tekstu.",
    content: tplAdvertorialEditorial,
  },
  {
    kind: "file",
    id: "marketing/templates/benefit-list-split.md",
    name: "Lista korzyści (split).md",
    description: "4:5 · produkt + lista benefitów w kółkach.",
    content: tplBenefitListSplit,
  },
  {
    kind: "file",
    id: "marketing/templates/benefit-split-information-dense.md",
    name: "Split informacyjny (korzyści).md",
    description: "1:1 · układ dzielony: produkt + gwiazdy, lista, CTA.",
    content: tplBenefitSplitInformationDense,
  },
  {
    kind: "file",
    id: "marketing/templates/comparison-grid-table.md",
    name: "Tabela porównawcza.md",
    description: "1:1 · siatka „my vs konkurent”, format memowy.",
    content: tplComparisonGridTable,
  },
  {
    kind: "file",
    id: "marketing/templates/curiosity-gap-hook-testimonial.md",
    name: "Luka ciekawości + świadectwo.md",
    description: "1:1 · cytat, ujawnienie, produkt, gwiazdy, disclaimer.",
    content: tplCuriosityGapHookTestimonial,
  },
  {
    kind: "file",
    id: "marketing/templates/curiosity-gap-scroll-stopper.md",
    name: "Scroll-stop (bez produktu).md",
    description: "1:1 · ucięty podpis + obraz problemu, bez produktu.",
    content: tplCuriosityGapScrollStopper,
  },
  {
    kind: "file",
    id: "marketing/templates/faux-iphone-notes.md",
    name: "Udawane Notatki iPhone.md",
    description: "1:1 · zrzut Notatek + benefity + produkt.",
    content: tplFauxIphoneNotes,
  },
  {
    kind: "file",
    id: "marketing/templates/faux-press-news-screenshot.md",
    name: "Udawany zrzut newsa.md",
    description: "4:5 · nagłówek „gazety” + dwa UGC z produktem.",
    content: tplFauxPressNewsScreenshot,
  },
  {
    kind: "file",
    id: "marketing/templates/feature-arrow-callout.md",
    name: "Strzałki i kalouty.md",
    description: "1:1 · adnotacje wokół produktu + pas promocyjny.",
    content: tplFeatureArrowCallout,
  },
  {
    kind: "file",
    id: "marketing/templates/features-benefits.md",
    name: "Diagram cech i benefitów.md",
    description: "4:5 · diagram edukacyjny z liniami do benefitów.",
    content: tplFeaturesBenefits,
  },
  {
    kind: "file",
    id: "marketing/templates/flavor-story-tastes-like.md",
    name: "Historia smaku „jak…”.md",
    description: "1:1 · jedzenie jako bohater + produkt + pasek liczb.",
    content: tplFlavorStoryTastesLike,
  },
  {
    kind: "file",
    id: "marketing/templates/gradient-banner-benefits.md",
    name: "Gradient i pasek benefitów.md",
    description: "1:1 · gradient, pasek segmentów, pudełko, lifestyle.",
    content: tplGradientBannerBenefits,
  },
  {
    kind: "file",
    id: "marketing/templates/gradient-bold-statement.md",
    name: "Gradient i mocny nagłówek.md",
    description: "1:1 · duży, luźny nagłówek + produkt, bez statystyk.",
    content: tplGradientBoldStatement,
  },
  {
    kind: "file",
    id: "marketing/templates/headline.md",
    name: "Nagłówek + produkt.md",
    description: "4:5 · nagłówek + podtytuł + produkt.",
    content: tplHeadline,
  },
  {
    kind: "file",
    id: "marketing/templates/hero-product-showcase-stat-bar.md",
    name: "Hero produktu + pasek statów.md",
    description: "1:1 · produkt, „eksplozja” elementów, pasek metryk.",
    content: tplHeroProductShowcaseStatBar,
  },
  {
    kind: "file",
    id: "marketing/templates/hero-statement-icon-bar-promo.md",
    name: "Hasło + ikony (promo).md",
    description: "1:1 · mocne hasło, plakietka rabatu, ikony benefitów.",
    content: tplHeroStatementIconBarPromo,
  },
  {
    kind: "file",
    id: "marketing/templates/hero-statement-icon-bar.md",
    name: "Mocne hasło + pasek ikon.md",
    description: "1:1 · pas z hasłem + lifestyle + ikony + ticker.",
    content: tplHeroStatementIconBar,
  },
  {
    kind: "file",
    id: "marketing/templates/highlighted-testimonial.md",
    name: "Opinia z podświetleniami.md",
    description: "1:1 · długa recenzja z wyróżnionymi frazami + produkt.",
    content: tplHighlightedTestimonial,
  },
  {
    kind: "file",
    id: "marketing/templates/lifestyle-action-colorway-array.md",
    name: "Lifestyle + warianty kolorystyczne.md",
    description: "1:1 · scena 2/3 + wachlarz wariantów produktu.",
    content: tplLifestyleActionColorwayArray,
  },
  {
    kind: "file",
    id: "marketing/templates/long-form-manifesto.md",
    name: "Manifest tekstowy.md",
    description: "1:1 · długi argument tekstowy + produkt na dole.",
    content: tplLongFormManifesto,
  },
  {
    kind: "file",
    id: "marketing/templates/negative-marketing.md",
    name: "Negatyw marketingowy.md",
    description: "4:5 · „słaba” recenzja jako haczyk + punchline.",
    content: tplNegativeMarketing,
  },
  {
    kind: "file",
    id: "marketing/templates/offer-promotion.md",
    name: "Oferta / promocja.md",
    description: "9:16 · podział kolorów, oferta, produkt na styku.",
    content: tplOfferPromotion,
  },
  {
    kind: "file",
    id: "marketing/templates/post-it-note-ugly-organic.md",
    name: "Karteczka (organic UGC).md",
    description: "4:5 · zdjęcie „z telefonu” + karteczka na produkcie.",
    content: tplPostItNoteUglyOrganic,
  },
  {
    kind: "file",
    id: "marketing/templates/press-editorial.md",
    name: "Press / editorial.md",
    description: "4:5 · „Polecane w mediach” + cytat + produkt.",
    content: tplPressEditorial,
  },
  {
    kind: "file",
    id: "marketing/templates/product-comment-callout.md",
    name: "Produkt + komentarz.md",
    description: "1:1 · produkt + karta komentarza (styl FB).",
    content: tplProductCommentCallout,
  },
  {
    kind: "file",
    id: "marketing/templates/pull-quote-review-card.md",
    name: "Cytat wyciągnięty + karta recenzji.md",
    description: "1:1 lub 4:5 · mocny cytat + karta recenzji + produkt.",
    content: tplPullQuoteReviewCard,
  },
  {
    kind: "file",
    id: "marketing/templates/scroll-stopper.md",
    name: "Scroll-stop (ogólnie).md",
    description: "1:1 · ogólny układ scroll-stop (wybierz wariant).",
    content: tplScrollStopper,
  },
  {
    kind: "file",
    id: "marketing/templates/social-comment-screenshot.md",
    name: "Zrzut komentarza.md",
    description: "1:1 · haczyk + komentarz + produkt, bez logo.",
    content: tplSocialCommentScreenshot,
  },
  {
    kind: "file",
    id: "marketing/templates/social-proof.md",
    name: "Dowód społeczny.md",
    description: "4:5 · nagłówek, gwiazdy, karta recenzji, loga prasy.",
    content: tplSocialProof,
  },
  {
    kind: "file",
    id: "marketing/templates/stat-callout-data-driven-lifestyle.md",
    name: "Statystyka + lifestyle.md",
    description: "4:5 · lifestyle u góry, statystyki jako nagłówek dół.",
    content: tplStatCalloutDataDrivenLifestyle,
  },
  {
    kind: "file",
    id: "marketing/templates/stat-surround-callout-radial.md",
    name: "Staty wokół produktu.md",
    description: "1:1 · produkt + strzałki do metryk + plakietka ceny.",
    content: tplStatSurroundCalloutRadial,
  },
  {
    kind: "file",
    id: "marketing/templates/stat-surround-flatlay.md",
    name: "Flatlay ze statami.md",
    description: "1:1 · układ z góry + banner + strzałki do produktu.",
    content: tplStatSurroundFlatlay,
  },
  {
    kind: "file",
    id: "marketing/templates/testimonials.md",
    name: "Świadectwa.md",
    description: "9:16 · nakładka na scenę + cytat i gwiazdy.",
    content: tplTestimonials,
  },
  {
    kind: "file",
    id: "marketing/templates/tiktok-before-after.md",
    name: "TikTok: przed i po.md",
    description: "9:16 · before/after w lustrze, styl CapCut.",
    content: tplTiktokBeforeAfter,
  },
  {
    kind: "file",
    id: "marketing/templates/ugc-lifestyle-review-card-split.md",
    name: "UGC + karta opinii (split).md",
    description: "4:5 · UGC po lewej, kolor + karta recenzji po prawej.",
    content: tplUgcLifestyleReviewCardSplit,
  },
  {
    kind: "file",
    id: "marketing/templates/ugc-story-callout.md",
    name: "Relacja Story z dymkami.md",
    description: "9:16 · pięć dymków tekstu na Story.",
    content: tplUgcStoryCallout,
  },
  {
    kind: "file",
    id: "marketing/templates/ugc-viral-post-overlay.md",
    name: "UGC + nakładka posta.md",
    description: "9:16 · selfie + zrzut posta (Reddit/X), bez produktu.",
    content: tplUgcViralPostOverlay,
  },
  {
    kind: "file",
    id: "marketing/templates/us-vs-them-color-split.md",
    name: "My vs oni (kolory).md",
    description: "1:1 · podział kolorów, mocne vs słabe strony, VS.",
    content: tplUsVsThemColorSplit,
  },
  {
    kind: "file",
    id: "marketing/templates/us-vs-them.md",
    name: "My vs oni.md",
    description: "4:5 · VS w kółku, listy słabości vs mocnych stron.",
    content: tplUsVsThem,
  },
  {
    kind: "file",
    id: "marketing/templates/verified-review-card.md",
    name: "Zweryfikowana recenzja.md",
    description: "1:1 · cytat + karta „zweryfikowany recenzent” + produkt.",
    content: tplVerifiedReviewCard,
  },
  {
    kind: "file",
    id: "marketing/templates/whiteboard-before-after.md",
    name: "Tablica przed/po.md",
    description: "4:5 · tablica z rysunkami przed/po + produkt w kadrze.",
    content: tplWhiteboardBeforeAfter,
  },
];
