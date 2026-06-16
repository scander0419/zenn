import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const title = args.title?.trim();
if (!title) {
  console.error("`--title` is required.");
  printHelp();
  process.exit(1);
}

const type = args.type ?? "tech";
if (!["tech", "idea"].includes(type)) {
  console.error("`--type` must be `tech` or `idea`.");
  process.exit(1);
}

const emoji = args.emoji ?? "📝";
const topics = splitTopics(args.topics);
const published = parseBoolean(args.published, false);
const slug = args.slug ?? buildSlug(title);
const publicationName = args["publication-name"];
const publishedAt = args["published-at"];

assertSlug(slug);

const articleDir = path.resolve("articles");
const articlePath = path.join(articleDir, `${slug}.md`);
const body = await loadBody(args, title);

const frontMatter = [
  "---",
  `title: ${toYamlString(title)}`,
  `emoji: ${toYamlString(emoji)}`,
  `type: ${toYamlString(type)}`,
  `topics: ${toYamlArray(topics)}`,
  `published: ${published}`,
  publicationName ? `publication_name: ${toYamlString(publicationName)}` : null,
  publishedAt ? `published_at: ${publishedAt}` : null,
  "---",
  "",
  body,
  "",
]
  .filter(Boolean)
  .join("\n");

await mkdir(articleDir, { recursive: true });
await writeFile(articlePath, frontMatter, { flag: "wx" });

console.log(`Created ${path.relative(process.cwd(), articlePath)}`);

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npm run article:new -- --title "記事タイトル" [options]

Options:
  --title               Required. Article title.
  --slug                Optional. 12-50 chars, a-z0-9, "-" or "_".
  --emoji               Optional. Default: 📝
  --type                Optional. tech or idea. Default: tech
  --topics              Optional. Comma separated topics. Example: aws,bedrock,lambda
  --published           Optional. true or false. Default: false
  --publication-name    Optional. Publication slug/name
  --published-at        Optional. JST schedule. Example: 2026-06-20 09:00
  --body                Optional. Inline article body
  --body-file           Optional. Path to markdown body file
  --help                Show this help
`);
}

function splitTopics(raw) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  console.error("`--published` must be `true` or `false`.");
  process.exit(1);
}

function buildSlug(titleText) {
  const datePrefix = formatDate(new Date());
  const asciiTitle = titleText
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  let base = asciiTitle ? `${datePrefix}-${asciiTitle}` : `${datePrefix}-${randomSuffix(8)}`;
  base = base.slice(0, 50).replace(/-+$/g, "");

  if (base.length < 12) {
    base = `${base}-${randomSuffix(12 - base.length - 1)}`;
  }

  if (base.length > 50) {
    base = base.slice(0, 50).replace(/-+$/g, "");
  }

  if (base.length < 12) {
    return `${datePrefix}-${randomSuffix(4)}`;
  }

  return base;
}

function formatDate(date) {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function randomSuffix(length) {
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, "0");
}

function assertSlug(value) {
  if (!/^[a-z0-9_-]{12,50}$/.test(value)) {
    console.error("Slug must be 12-50 chars and only contain a-z, 0-9, `-`, `_`.");
    process.exit(1);
  }
}

async function loadBody(parsedArgs, articleTitle) {
  if (parsedArgs["body-file"]) {
    return readFile(path.resolve(parsedArgs["body-file"]), "utf8");
  }

  if (parsedArgs.body) {
    return parsedArgs.body;
  }

  return `## はじめに

この記事では、${articleTitle} について整理します。

## 結論

先に要点を書く。

## 背景

前提やハマりどころを書く。

## 詳細

手順、コード、検証結果を書く。

## まとめ

学びと次のアクションを書く。`;
}

function toYamlString(value) {
  return JSON.stringify(value);
}

function toYamlArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
