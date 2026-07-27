import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DESC_PL, templates } from "./ad-template-prompts-pl.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "src", "skills", "marketing", "templates");

function md({ title, aspect, prompt }) {
  return `# Szablon: ${title}

## Opis

${DESC_PL}

## Wytyczne (prompt do generatora obrazu)

${prompt.trim()}

## Proporcje

${aspect ?? "jak w wytycznych"}
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const t of templates) {
  fs.writeFileSync(path.join(outDir, t.file), md(t), "utf8");
}
console.log(`Wrote ${templates.length} templates to ${outDir}`);
