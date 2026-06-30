/**
 * Drzewo „Umiejętności marketingowe” w stylu NOW: SKILL.md (dyrektor) + folder marketing/ z płaską listą.
 */
import marketingSkill from "@/skills/marketing/SKILL.md?raw";
import marketingSkillDirector from "@/skills/marketing/skill-director/SKILL.md?raw";
import abTestSetup from "@/skills/marketing/ab-test-setup/SKILL.md?raw";
import adCreative from "@/skills/marketing/ad-creative/SKILL.md?raw";
import aiSeo from "@/skills/marketing/ai-seo/SKILL.md?raw";
import analyticsTracking from "@/skills/marketing/analytics-tracking/SKILL.md?raw";
import asoAudit from "@/skills/marketing/aso-audit/SKILL.md?raw";
import directorySubmissions from "@/skills/marketing/directory-submissions/SKILL.md?raw";
import churnPrevention from "@/skills/marketing/churn-prevention/SKILL.md?raw";
import coldEmail from "@/skills/marketing/cold-email/SKILL.md?raw";
import communityMarketing from "@/skills/marketing/community-marketing/SKILL.md?raw";
import competitorAlternativePages from "@/skills/marketing/competitor-alternative-pages/SKILL.md?raw";
import contentStrategy from "@/skills/marketing/content-strategy/SKILL.md?raw";
import copyEditing from "@/skills/marketing/copy-editing/SKILL.md?raw";
import copywriting from "@/skills/marketing/copywriting/SKILL.md?raw";
import customerResearch from "@/skills/marketing/customer-research/SKILL.md?raw";
import emailSequenceDesign from "@/skills/marketing/email-sequence-design/SKILL.md?raw";
import formCro from "@/skills/marketing/form-cro/SKILL.md?raw";
import freeToolStrategy from "@/skills/marketing/free-tool-strategy/SKILL.md?raw";
import launchStrategy from "@/skills/marketing/launch-strategy/SKILL.md?raw";
import leadMagnets from "@/skills/marketing/lead-magnets/SKILL.md?raw";
import marketingIdeasSaas from "@/skills/marketing/marketing-ideas-saas/SKILL.md?raw";
import marketingPsychology from "@/skills/marketing/marketing-psychology/SKILL.md?raw";
import marketingVideo from "@/skills/marketing/marketing-video/SKILL.md?raw";
import marketingVisualContent from "@/skills/marketing/marketing-visual-content/SKILL.md?raw";
import onboardingCro from "@/skills/marketing/onboarding-cro/SKILL.md?raw";
import pageCro from "@/skills/marketing/page-cro/SKILL.md?raw";
import paidAds from "@/skills/marketing/paid-ads/SKILL.md?raw";
import paywallUpgradeCro from "@/skills/marketing/paywall-upgrade-cro/SKILL.md?raw";
import popupCro from "@/skills/marketing/popup-cro/SKILL.md?raw";
import pricingStrategy from "@/skills/marketing/pricing-strategy/SKILL.md?raw";
import productMarketingContext from "@/skills/marketing/product-marketing-context/SKILL.md?raw";
import programmaticSeo from "@/skills/marketing/programmatic-seo/SKILL.md?raw";
import referralAffiliate from "@/skills/marketing/referral-affiliate/SKILL.md?raw";
import revops from "@/skills/marketing/revops/SKILL.md?raw";
import salesEnablement from "@/skills/marketing/sales-enablement/SKILL.md?raw";
import schemaMarkup from "@/skills/marketing/schema-markup/SKILL.md?raw";
import seoAudit from "@/skills/marketing/seo-audit/SKILL.md?raw";
import signupFlowCro from "@/skills/marketing/signup-flow-cro/SKILL.md?raw";
import siteArchitecture from "@/skills/marketing/site-architecture/SKILL.md?raw";
import marketingMetaTpl from "@/skills/marketing/templates/meta-ads-short.md?raw";
import marketingGoogleTpl from "@/skills/marketing/templates/google-ads-rsa.md?raw";

type SkillFile = {
  kind: "file";
  id: string;
  name: string;
  description: string;
  content: string;
};

type SkillDir = {
  kind: "dir";
  id: string;
  name: string;
  children: (SkillFile | SkillDir)[];
};

const marketingFlatFiles: SkillFile[] = [
  {
    kind: "file",
    id: "marketing/ab-test-setup/SKILL.md",
    name: "Konfiguracja testów A/B",
    description: "Projektowanie testów A/B: hipoteza, metryki, próba, analiza i playbook.",
    content: abTestSetup,
  },
  {
    kind: "file",
    id: "marketing/ad-creative/SKILL.md",
    name: "Kreacje reklamowe",
    description: "Kreacje performance: kąty, limity znaków, iteracja z danych.",
    content: adCreative,
  },
  {
    kind: "file",
    id: "marketing/ai-seo/SKILL.md",
    name: "AI SEO (widoczność w LLM)",
    description: "GEO/AI SEO: audyt cytowań, struktura, autorytet, presence, monitoring.",
    content: aiSeo,
  },
  {
    kind: "file",
    id: "marketing/analytics-tracking/SKILL.md",
    name: "Analityka i śledzenie",
    description: "Tracking plan: eventy, konwencje, UTMy, QA, privacy.",
    content: analyticsTracking,
  },
  {
    kind: "file",
    id: "marketing/aso-audit/SKILL.md",
    name: "Audyt ASO",
    description: "Audyt ASO App Store / Google Play: scoring i plan działań.",
    content: asoAudit,
  },
  {
    kind: "file",
    id: "marketing/churn-prevention/SKILL.md",
    name: "Retencja i churn",
    description: "Cancel flow, save offers, dunning i retencja proaktywna.",
    content: churnPrevention,
  },
  {
    kind: "file",
    id: "marketing/cold-email/SKILL.md",
    name: "Zimna poczta (cold email)",
    description: "Cold maile: struktury, zasady, subject lines, follow-up.",
    content: coldEmail,
  },
  {
    kind: "file",
    id: "marketing/community-marketing/SKILL.md",
    name: "Marketing społecznościowy",
    description: "Budowa community: core loop, rytuały, metryki zdrowia.",
    content: communityMarketing,
  },
  {
    kind: "file",
    id: "marketing/competitor-alternative-pages/SKILL.md",
    name: "Konkurencja i alternatywy",
    description: "Porównania „vs” i „alternatives to”: struktura, uczciwość, SEO/GEO.",
    content: competitorAlternativePages,
  },
  {
    kind: "file",
    id: "marketing/content-strategy/SKILL.md",
    name: "Strategia treści",
    description: "Pillary, kalendarz, dystrybucja — strategia treści pod cele.",
    content: contentStrategy,
  },
  {
    kind: "file",
    id: "marketing/copy-editing/SKILL.md",
    name: "Redakcja copy",
    description: "Edycja istniejącego copy: jasność, konwersja, spójność głosu.",
    content: copyEditing,
  },
  {
    kind: "file",
    id: "marketing/copywriting/SKILL.md",
    name: "Copywriting",
    description: "Copy od zera: hero, landing, mikrocopy, frameworki perswazji.",
    content: copywriting,
  },
  {
    kind: "file",
    id: "marketing/customer-research/SKILL.md",
    name: "Research klienta",
    description: "Wywiady, ankiety, synteza insightów pod positioning i GTM.",
    content: customerResearch,
  },
  {
    kind: "file",
    id: "marketing/directory-submissions/SKILL.md",
    name: "Katalogi i zgłoszenia",
    description: "Dystrybucja przez katalogi + GEO: readiness, tier-y, tracker.",
    content: directorySubmissions,
  },
  {
    kind: "file",
    id: "marketing/email-sequence-design/SKILL.md",
    name: "Sekwencja maili",
    description: "Drip i nurture: mapa maili, narracja, metryki, drafty.",
    content: emailSequenceDesign,
  },
  {
    kind: "file",
    id: "marketing/form-cro/SKILL.md",
    name: "CRO formularzy",
    description: "Optymalizacja formularzy: pola, friction, trust, testy.",
    content: formCro,
  },
  {
    kind: "file",
    id: "marketing/free-tool-strategy/SKILL.md",
    name: "Strategia darmowych narzędzi",
    description: "Kalkulatory, generatory, MVP narzędzi: lead gen, SEO, scorecard.",
    content: freeToolStrategy,
  },
  {
    kind: "file",
    id: "marketing/launch-strategy/SKILL.md",
    name: "Strategia launchu",
    description: "ORB, fazy launchu, Product Hunt, momentum po starcie.",
    content: launchStrategy,
  },
  {
    kind: "file",
    id: "marketing/lead-magnets/SKILL.md",
    name: "Lead magnety",
    description: "Formaty magnesów, gating, LP, dystrybucja, metryki.",
    content: leadMagnets,
  },
  {
    kind: "file",
    id: "marketing/SKILL.md",
    name: "Marketing — podstawa",
    description: "Bazowe zasady pakietu marketingowego i deliverables.",
    content: marketingSkill,
  },
  {
    kind: "file",
    id: "marketing/marketing-ideas-saas/SKILL.md",
    name: "Pomysły marketingowe (SaaS)",
    description: "Biblioteka taktyk: dobór pod etap, budżet, use case.",
    content: marketingIdeasSaas,
  },
  {
    kind: "file",
    id: "marketing/marketing-psychology/SKILL.md",
    name: "Psychologia marketingu",
    description: "Modele mentalne, biasy, perswazja i psychologia cen (etycznie).",
    content: marketingPsychology,
  },
  {
    kind: "file",
    id: "marketing/marketing-video/SKILL.md",
    name: "Wideo marketingowe",
    description: "AI video, avatary, Hyperframes/Remotion, formaty platform.",
    content: marketingVideo,
  },
  {
    kind: "file",
    id: "marketing/onboarding-cro/SKILL.md",
    name: "CRO onboardingu",
    description: "Aha moment, checklisty, empty states, maile aktywacyjne.",
    content: onboardingCro,
  },
  {
    kind: "file",
    id: "marketing/page-cro/SKILL.md",
    name: "CRO stron",
    description: "Landing, home, pricing: propozycja wartości, CTA, trust, tarcie.",
    content: pageCro,
  },
  {
    kind: "file",
    id: "marketing/paid-ads/SKILL.md",
    name: "Reklamy płatne",
    description: "Struktura kont, platformy, kreacje, target, optymalizacja.",
    content: paidAds,
  },
  {
    kind: "file",
    id: "marketing/paywall-upgrade-cro/SKILL.md",
    name: "CRO paywall / upgrade",
    description: "Free→paid, limity, trial end, trigger timing, etyka.",
    content: paywallUpgradeCro,
  },
  {
    kind: "file",
    id: "marketing/popup-cro/SKILL.md",
    name: "CRO popupów",
    description: "Triggery, częstotliwość, mobile, a11y, GDPR, konwersja bez irytacji.",
    content: popupCro,
  },
  {
    kind: "file",
    id: "marketing/pricing-strategy/SKILL.md",
    name: "Strategia cen",
    description: "Pakiety, metryka wartości, badania WTP, strona cennika.",
    content: pricingStrategy,
  },
  {
    kind: "file",
    id: "marketing/product-marketing-context/SKILL.md",
    name: "Kontekst produktu (PMM)",
    description: "Plik .agents/product-marketing-context.md — positioning i messaging.",
    content: productMarketingContext,
  },
  {
    kind: "file",
    id: "marketing/programmatic-seo/SKILL.md",
    name: "SEO programatyczne",
    description: "Szablony stron, dane, jakość, linkowanie, indeksacja.",
    content: programmaticSeo,
  },
  {
    kind: "file",
    id: "marketing/referral-affiliate/SKILL.md",
    name: "Polecenia i afiliacja",
    description: "Pętla poleceń, nagrody, metryki, launch programu.",
    content: referralAffiliate,
  },
  {
    kind: "file",
    id: "marketing/revops/SKILL.md",
    name: "RevOps",
    description: "Lejek, MQL/SQL, scoring, routing, SLA, metryki.",
    content: revops,
  },
  {
    kind: "file",
    id: "marketing/sales-enablement/SKILL.md",
    name: "Wsparcie sprzedaży",
    description: "Decki, one-pagery, obiekcje, demo, playbooki, ROI.",
    content: salesEnablement,
  },
  {
    kind: "file",
    id: "marketing/schema-markup/SKILL.md",
    name: "Schema.org / JSON-LD",
    description: "JSON-LD, typy schema, walidacja, rich results.",
    content: schemaMarkup,
  },
  {
    kind: "file",
    id: "marketing/seo-audit/SKILL.md",
    name: "Audyt SEO",
    description: "Audyt klasycznego SEO: technika, on-page, treść, i18n, raport.",
    content: seoAudit,
  },
  {
    kind: "file",
    id: "marketing/signup-flow-cro/SKILL.md",
    name: "CRO rejestracji",
    description: "Rejestracja: pola, SSO, kroki, mobile, metryki drop-off.",
    content: signupFlowCro,
  },
  {
    kind: "file",
    id: "marketing/site-architecture/SKILL.md",
    name: "Architektura witryny",
    description: "IA, URL, nawigacja, linkowanie wewnętrzne, deliverables.",
    content: siteArchitecture,
  },
  {
    kind: "file",
    id: "marketing/marketing-visual-content/SKILL.md",
    name: "Treści wizualne",
    description: "AI image, Canva/Figma, rozmiary social, OG, optymalizacja web.",
    content: marketingVisualContent,
  },
];

const marketingTemplatesDir: SkillDir = {
  kind: "dir",
  id: "marketing/templates",
  name: "szablony (tekst)",
  children: [
    {
      kind: "file",
      id: "marketing/templates/meta-ads-short.md",
      name: "Meta — krótkie kreacje.md",
      description: "Krótkie zestawy pod reklamy Meta / IG / FB.",
      content: marketingMetaTpl,
    },
    {
      kind: "file",
      id: "marketing/templates/google-ads-rsa.md",
      name: "Google Ads — RSA.md",
      description: "Nagłówki i opisy pod Responsive Search Ads.",
      content: marketingGoogleTpl,
    },
  ],
};

/** Gałąź jak w panelu NOW: najpierw SKILL.md (dyrektor), potem marketing/ z listą plików. */
export const marketingSkillsBranch: SkillDir = {
  kind: "dir",
  id: "marketing-skills",
  name: "Umiejętności marketingowe",
  children: [
    {
      kind: "file",
      id: "marketing-skills/SKILL.md",
      name: "SKILL.md",
      description:
        "Dyrektor umiejętności marketingowych — dobiera właściwy skill do zadania (paid, email, CRO, SEO, launch). Zawsze aktywny.",
      content: marketingSkillDirector,
    },
    {
      kind: "dir",
      id: "marketing-skills/marketing",
      name: "Szczegółowe skille",
      children: [...marketingFlatFiles, marketingTemplatesDir],
    },
  ],
};
