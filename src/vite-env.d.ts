/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Publiczny URL podglądu Lovable — włącza logowanie Google na localhost przez broker Lovable (bez kopiowania sekretów). */
  readonly VITE_LOVABLE_APP_URL?: string;
  /** Ustaw na `"true"` dopiero gdy Google OAuth jest skonfigurowany w Supabase (Client ID + Secret). Domyślnie wyłączone. */
  readonly VITE_ENABLE_GOOGLE_AUTH?: string;
}

declare module "*.md?raw" {
  const src: string;
  export default src;
}
