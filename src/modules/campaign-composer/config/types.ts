export type FieldOption = { value: string; label: string };

export type PlatformFieldConfig = {
  provider: "meta" | "tiktok" | "linkedin";
  /** Etykiety poziomów struktury, np. Campaign → Ad Set → Ad. */
  campaignStructure: { campaign: string; group: string; ad: string };
  /** Kroki kreatora (UI). */
  steps: { id: string; label: string }[];
  campaignObjectives: FieldOption[];
  budgetTypes: FieldOption[];
  bidStrategies: FieldOption[];
  placements: FieldOption[];
  creativeFormats: FieldOption[];
  ctaOptions: FieldOption[];
  optimizationGoals: FieldOption[];
};