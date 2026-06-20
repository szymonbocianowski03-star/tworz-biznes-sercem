/** Klucz sessionStorage — treść przekazywana do czatu z Zasobów (obraz / wideo). */
export const ASSET_AGENT_SEED_KEY = "mn.asset.agentSeed";

export type AssetAgentSeedKind = "image" | "video";

export type AssetAgentSeedPayload = {
  kind: AssetAgentSeedKind;
  /** Pełna treść wiadomości użytkownika. */
  text: string;
  /** URL pliku (obraz w wątku; wideo w treści). */
  mediaUrl: string;
};

export function setAssetAgentSeed(payload: AssetAgentSeedPayload): void {
  sessionStorage.setItem(ASSET_AGENT_SEED_KEY, JSON.stringify(payload));
}

export function buildAssetAgentPrompt(kind: AssetAgentSeedKind, prompt: string, mediaUrl: string): string {
  const intro =
    kind === "image"
      ? "Chcę dopracować tę kreację graficzną. Oceń kompozycję, czytelność i spójność z briefem. Zaproponuj konkretne poprawki i — jeśli ma sens — ulepszony prompt do ponownej generacji."
      : "Chcę dopracować ten klip. Oceń tempo, kadr i przekaz. Zaproponuj poprawki montażowe / scenariuszowe i — jeśli ma sens — ulepszony opis sceny do ponownej generacji.";
  // Nie doklejaj długich URL-i do treści czatu — obraz/wideo i tak jest dołączane osobno jako mediaUrl.
  // Treść ma być krótka i skupiona na zadaniu.
  void mediaUrl;
  return [intro, "", "Brief / prompt:", prompt].join("\n");
}
