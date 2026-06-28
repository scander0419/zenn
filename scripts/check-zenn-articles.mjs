import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const articlesDir = path.resolve("articles");
const entries = await readdir(articlesDir, { withFileTypes: true }).catch(() => []);
const articleFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name);

const issues = [];

for (const fileName of articleFiles) {
  const slug = fileName.replace(/\.md$/u, "");
  const fullPath = path.join(articlesDir, fileName);
  const raw = await readFile(fullPath, "utf8");

  if (!/^[a-z0-9_-]{12,50}$/.test(slug)) {
    issues.push(`${fileName}: slug must be 12-50 chars and only contain a-z, 0-9, "-", "_".`);
  }

  const frontMatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (!frontMatterMatch) {
    issues.push(`${fileName}: front matter is missing.`);
    continue;
  }

  const frontMatter = frontMatterMatch[1];
  for (const key of ["title", "emoji", "type", "topics", "published"]) {
    const pattern = new RegExp(`^${key}:\\s`, "mu");
    if (!pattern.test(frontMatter)) {
      issues.push(`${fileName}: missing \`${key}\` in front matter.`);
    }
  }

  const typeMatch = frontMatter.match(/^type:\s+"?(tech|idea)"?\s*$/mu);
  if (!typeMatch) {
    issues.push(`${fileName}: type must be tech or idea.`);
  }

  const publishedMatch = frontMatter.match(/^published:\s+(true|false)\s*$/mu);
  if (!publishedMatch) {
    issues.push(`${fileName}: published must be true or false.`);
  }

  const topicsMatch = frontMatter.match(/^topics:\s+\[(.*)\]\s*$/mu);
  if (!topicsMatch) {
    issues.push(`${fileName}: topics must be an inline array, e.g. [\"aws\", \"lambda\"].`);
  }

  if (raw.includes("[:contents]")) {
    issues.push(`${fileName}: remove unsupported "[:contents]" syntax (Zenn generates the table of contents automatically).`);
  }
}

if (issues.length > 0) {
  console.error("Zenn article validation failed:\n");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Validated ${articleFiles.length} article(s).`);
