# Wideo marketingowe (AI + programmatic)

Wspierasz produkcję wideo: demo produktu, explainery, social clipy, reklamy — z użyciem **generacji AI, avatarów, narzędzi programmatic** i dobrych praktyk formatów.

## Zanim zaczniesz

Wczytaj `.agents/product-marketing-context.md` (lub `.claude/...`).

Ustal: cel wideo, platforma (YouTube, TikTok/Reels, Shorts, ads, deck), długość, czy potrzebny prezenter (avatar vs voiceover vs screen), istniejące assety (UI, logo, nagrania), czy to one-off czy szablon powtarzalny, budżet/API narzędzi.

## Dobór podejścia

| Podejście | Najlepsze do | Narzędzia (przykłady) |
|-----------|--------------|------------------------|
| Programmatic | szablony, batch, dane | Hyperframes, Remotion |
| Generacja AI | B-roll, ujęcia niemożliwe do filmu | narzędzia wideo AI (np. Veo, Kling, Pika) |
| Awatary AI | talking head bez studia | HeyGen, Synthesia |
| Montaż / repurposing | długie → krótkie | Descript, Opus Clip, CapCut |

## Programmatic video

**Hyperframes (HTML/CSS):** klatki jako HTML, timeline → MP4 — dobre dla agentów (zwykły HTML/CSS), deterministyczny output, changelogi, spersonalizowane krótkie filmy.

**Remotion (React):** większa moc animacji, Lambda pod skalę; wymaga React.

**Kiedy co:** proste overlaye i szybkie iteracje → Hyperframes; złożone animacje i duży batch w chmurze → Remotion.

## Generacja wideo (prompt)

Struktura: **podmiot + akcja + kamera + styl + nastrój**.  
Błędy: zbyt ogólny opis, brak ruchu kamery, brak stylu, **tekst w kadrze** (modele słabo czytelny tekst — lepiej napisy programmatic).

## Awatary vs inne

| Scenariusz | Avatar | Zamiast |
|------------|--------|---------|
| Cotygodniowe update’y, wielojęzyczność | tak | — |
| Autentyczny founder | — | prawdziwe nagranie |
| Walkthrough UI | — | screen recording |
| Artystyczny klip | — | generacja / stock |

## Repurposing (workflow)

Długi materiał (webinar, podcast) → wycięcie fillerów (np. Descript) → auto-klipy z scoringiem (np. Opus) → napisy i styl platformy (CapCut / Captions) → publikacja Shorts/Reels/LinkedIn.

## Proporcje i długość

**9:16** social vertical, **16:9** YouTube / web, **1:1** niektóre feedy. **Napisy prawie zawsze** (duża część ogląda bez dźwięku).

## Pipeline „agent-native” (koncepcja)

Skrypt (z kontekstu produktu) → Hyperframes / Remotion (szablon HTML/React) i/lub API avatarów i/lub API modeli wideo na B-roll → złożenie → export gotowy do publikacji.

## Typowe błędy

Start od narzędzia zamiast od strategii; tekst generowany w kadrze; słaba jakość avatara przy wysokich oczekiwaniach; zły aspect ratio; brak napisów; „nadprodukcja” tam, gdzie autentyczność wygrywa (np. TikTok).

## Powiązane

`community-marketing`, `content-strategy`, `ad-creative`, `copywriting`, `marketing-psychology`, `marketing-visual-content`
