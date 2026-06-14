import type { Product } from "@/hooks/useProducts";

/** URL miniatury produktu: główne zdjęcie, potem pierwszy obraz z brand kit. */
export function getProductAvatarUrl(product: Product | null | undefined): string | undefined {
  if (!product) return undefined;
  if (product.thumbnail) return product.thumbnail;
  const first = product.brandVisualImages?.[0];
  return first || undefined;
}
