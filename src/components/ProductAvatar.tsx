import { useRef } from "react";
import { cn } from "@/lib/utils";
import { getProductAvatarUrl } from "@/lib/productAvatar";
import type { Product } from "@/hooks/useProducts";

type Props = {
  product: Product | null | undefined;
  /** Np. podgląd z modala „Nowy produkt” przed zapisem */
  previewUrl?: string;
  size?: "sm" | "md";
  editable?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  className?: string;
};

const sizeClass = {
  sm: "h-5 w-5 rounded-md text-[10px]",
  md: "h-8 w-8 rounded-lg text-xs",
} as const;

export function ProductAvatar({
  product,
  previewUrl,
  size = "sm",
  editable = false,
  onUpload,
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const url = previewUrl ?? getProductAvatarUrl(product);
  const label = product?.name?.trim() || "P";
  const initial = label.slice(0, 1).toUpperCase();

  const inner = url ? (
    <img src={url} alt="" className={cn("object-cover shrink-0", sizeClass[size], className)} />
  ) : (
    <span
      className={cn(
        "bg-foreground text-background font-bold flex items-center justify-center shrink-0",
        sizeClass[size],
        className,
      )}
    >
      {initial}
    </span>
  );

  if (!editable || !onUpload) return inner;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onUpload(f);
        }}
      />
      <button
        type="button"
        title="Zmień zdjęcie produktu"
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
        className="rounded-md hover:ring-2 hover:ring-accent/40 transition-shadow shrink-0"
      >
        {inner}
      </button>
    </>
  );
}
