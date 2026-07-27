import { useRef } from "react";
import { ImagePlus, Pencil, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { readImageAsDataUrl } from "@/lib/readImageAsDataUrl";
import { toast } from "sonner";

type Variant = "tile" | "square" | "card";

type Props = {
  value?: string;
  onChange: (dataUrl: string) => void;
  onClear?: () => void;
  variant?: Variant;
  label?: string;
  className?: string;
  alt?: string;
};

const variantClass: Record<Variant, string> = {
  square: "h-32 w-32 rounded-xl",
  tile: "h-10 w-10 rounded-lg",
  card: "w-full aspect-[16/10] rounded-none",
};

export function ProductImagePicker({
  value,
  onChange,
  onClear,
  variant = "square",
  label,
  className,
  alt = "Zdjęcie produktu",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      onChange(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wczytać zdjęcia.");
    }
  };

  const isCard = variant === "card";

  return (
    <div className={cn("relative", !isCard && "inline-block", className)}>
      {label && variant !== "card" ? (
        <p className="text-sm font-medium mb-1.5">{label}</p>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          "group relative overflow-hidden border border-dashed border-border bg-muted/40 hover:bg-muted transition-colors flex flex-col items-center justify-center gap-1",
          variantClass[variant],
          value && "border-solid border-border",
        )}
      >
        {value ? (
          <>
            <img src={value} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/45 transition-colors">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <Pencil className="h-3.5 w-3.5" />
                {isCard ? "Zmień zdjęcie" : "Zmień"}
              </span>
            </span>
          </>
        ) : (
          <>
            {isCard ? (
              <ImagePlus className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground relative z-10">
              {isCard ? "Dodaj zdjęcie produktu" : "Wgraj"}
            </span>
          </>
        )}
      </button>
      {value && onClear && variant !== "card" ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Usuń zdjęcie
        </button>
      ) : null}
    </div>
  );
}
