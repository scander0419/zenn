import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const files = process.argv.slice(2)
  .map((filePath) => filePath.trim())
  .filter(Boolean);

if (files.length === 0) {
  console.log("No article files were provided.");
  process.exit(0);
}

const promoted = [];

for (const filePath of files) {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const updated = promotePublished(raw);

  if (updated == null) {
    continue;
  }

  await writeFile(absolutePath, updated, "utf8");
  promoted.push(filePath);
}

if (promoted.length === 0) {
  console.log("No articles required promotion.");
  process.exit(0);
}

console.log(`Promoted ${promoted.length} article(s):`);
for (const filePath of promoted) {
  console.log(`- ${filePath}`);
}

function promotePublished(markdown) {
  const frontMatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/u);
  if (!frontMatterMatch) {
    return null;
  }

  if (!/^published:\s+false\s*$/mu.test(frontMatterMatch[1])) {
    return null;
  }

  return markdown.replace(/^published:\s+false\s*$/mu, "published: true");
}
