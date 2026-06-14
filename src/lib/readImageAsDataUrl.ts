/** Wczytuje plik graficzny jako data URL (do miniatury produktu w localStorage). */
export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Nieobsługiwany format — wybierz plik graficzny."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Nie udało się wczytać pliku."));
    reader.readAsDataURL(file);
  });
}
