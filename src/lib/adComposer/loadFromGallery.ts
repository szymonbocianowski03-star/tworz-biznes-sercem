import type { AdCreative, AdFormat } from "./types";
import { defaultLayoutForType, defaultStyle, emptyCopy } from "./types";

function formatFromSize(size: string | null | undefined): AdFormat {
  const s = (size ?? "").toLowerCase();
  if (s.includes("1536x1024") || s.includes("16:9") || s.includes("768x432")) return "16:9";
  if (s.includes("1024x1536") || s.includes("9:16") || s.includes("432x768")) return "9:16";
  if (s.includes("4:5") || s.includes("540x675")) return "4:5";
  return "1:1";
}

/** Przygotowuje szkic warstwowej reklamy z istniejącego obrazu z galerii. */
export function adCreativeFromGalleryImage(input: {
  imageUrl: string;
  prompt?: string | null;
  size?: string | null;
}): AdCreative {
  const format = formatFromSize(input.size);
  return {
    creative_type: "product-mockup",
    format,
    layout: defaultLayoutForType("product-mockup"),
    visual_prompt: "",
    copy: {
      ...emptyCopy(),
      headline: input.prompt?.trim().slice(0, 80) ?? "",
    },
    style: defaultStyle(),
    backgroundUrl: input.imageUrl,
    suppressEmbeddedText: false,
  };
}
