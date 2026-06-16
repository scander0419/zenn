import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function parseArgs(argv) {
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

export function parseBoolean(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("`--published` must be `true` or `false`.");
}

export function splitTopics(raw) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export function buildSlug(titleText) {
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

export function assertSlug(value) {
  if (!/^[a-z0-9_-]{12,50}$/.test(value)) {
    throw new Error("Slug must be 12-50 chars and only contain a-z, 0-9, `-`, `_`.");
  }
}

export async function loadBody(parsedArgs, articleTitle) {
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

export function toYamlString(value) {
  return JSON.stringify(value);
}

export function toYamlArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

export async function createArticleFromArgs(parsedArgs) {
  const title = parsedArgs.title?.trim();
  if (!title) {
    throw new Error("`--title` is required.");
  }

  const type = parsedArgs.type ?? "tech";
  if (!["tech", "idea"].includes(type)) {
    throw new Error("`--type` must be `tech` or `idea`.");
  }

  const emoji = parsedArgs.emoji ?? "📝";
  const topics = splitTopics(parsedArgs.topics);
  const published = parseBoolean(parsedArgs.published, false);
  const slug = parsedArgs.slug ?? buildSlug(title);
  const publicationName = parsedArgs["publication-name"];
  const publishedAt = parsedArgs["published-at"];

  assertSlug(slug);

  const articleDir = path.resolve("articles");
  const articlePath = path.join(articleDir, `${slug}.md`);
  const body = await loadBody(parsedArgs, title);

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

  return { articlePath, slug, title };
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
