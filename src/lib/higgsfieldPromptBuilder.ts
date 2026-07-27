/** Wspólne szablony promptów UGC / Higgsfield — używane w UI i Edge Functions. */

export const HIGGSFIELD_NEGATIVE_PROMPT =
  "Avoid: AI-generated look, plastic skin, over-smoothed face, uncanny eyes, extra fingers, distorted hands, warped product label, fake text, unreadable logo, overly cinematic lighting, stock photo look, perfect symmetry, unrealistic body proportions, over-polished commercial studio style, CGI avatar look, cartoonish animation, unnatural lip sync, frozen facial expression.";

export const HIGGSFIELD_REALISM_SUFFIX =
  "Handheld phone camera, slight camera shake, natural lighting, real skin texture, imperfect framing, subtle asymmetry, casual background, natural blinking, small head movements, realistic hand gestures, believable facial expression, slight motion blur, no over-polished commercial look.";

export type VideoPromptStyle = "" | "ugc" | "viral" | "product" | "testimonial" | "image-animate";

export function buildHiggsfieldVideoPrompt(userPrompt: string, style?: string): string {
  const p = userPrompt.trim();
  if (!p) return "";
  const s = (style ?? "").trim().toLowerCase() as VideoPromptStyle;

  let core: string;
  switch (s) {
    case "ugc":
      core =
        `A realistic handheld iPhone-style UGC video: ${p}. ` +
        "Authentic TikTok/Reels selfie, not a polished commercial. Natural imperfect framing, subtle camera shake, real skin texture, slight asymmetry, casual facial expressions, realistic blinking, natural hand gestures, everyday lighting, slight background imperfections. Product visible naturally when relevant. Genuine enthusiasm and credibility. Grounded, realistic, human.";
      break;
    case "viral":
      core =
        `Viral short-form social video with scroll-stopping hook in the first second: ${p}. ` +
        "Handheld smartphone aesthetic, dynamic but believable pacing, trending UGC energy, not studio polish.";
      break;
    case "product":
      core =
        `Realistic product-focused short ad video: ${p}. ` +
        "Clear product visibility, natural demo or unboxing feel, believable environment, handheld or subtle gimbal, not CGI showroom.";
      break;
    case "testimonial":
      core =
        `Realistic selfie testimonial UGC: ${p}. ` +
        "Person speaks directly to camera with conversational tone, natural pauses, authentic emotion, phone-recorded look.";
      break;
    case "image-animate":
      core =
        `Animate this starting frame into a realistic short UGC-style video: ${p}. ` +
        "Keep identity, face shape, jawline, cheekbones, nose, eye spacing, lips, hairline, body proportions, clothing and environment consistent with the reference. Subtle blinking, breathing, small head movement, slight hand movement, micro expressions, natural camera shake. Do not change the face or identity. Not cartoon, avatar, CGI or AI animation.";
      break;
    default:
      core = p;
  }

  if (s === "" || s === "product") {
    return `${core} ${HIGGSFIELD_REALISM_SUFFIX} Negative prompt: ${HIGGSFIELD_NEGATIVE_PROMPT}`;
  }
  return `${core} ${HIGGSFIELD_REALISM_SUFFIX} Negative prompt: ${HIGGSFIELD_NEGATIVE_PROMPT}`;
}

export function defaultRatioForPlatform(platform: "tiktok" | "youtube" | "meta" | "stories"): string {
  switch (platform) {
    case "youtube":
      return "1280:720";
    case "meta":
      return "960:960";
    case "tiktok":
    case "stories":
    default:
      return "720:1280";
  }
}
