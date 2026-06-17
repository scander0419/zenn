import path from "node:path";
import { spawnSync } from "node:child_process";
import { createArticleFromArgs, parseArgs } from "./zenn-article-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

try {
  const { articlePath, slug, title } = await createArticleFromArgs(args);
  const branchName = args.branch ?? `article/${slug}`;
  const baseBranch = args.base ?? "main";
  const commitMessage = args["commit-message"] ?? `Add Zenn article: ${title}`;
  const prTitle = args["pr-title"] ?? `Add Zenn article: ${title}`;
  const published = args.published ?? "false";
  const relativeArticlePath = path.relative(process.cwd(), articlePath);

  run("git", ["switch", "-c", branchName]);
  run("git", ["add", relativeArticlePath]);
  run("git", ["commit", "-m", commitMessage]);
  run("git", ["push", "-u", "origin", branchName]);

  const prArgs = [
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    branchName,
    "--title",
    prTitle,
    "--body",
    buildPrBody(relativeArticlePath, published),
  ];

  if (args.draft === "true") {
    prArgs.push("--draft");
  }

  run("gh", prArgs);
  console.log(`Created PR flow for ${relativeArticlePath}`);
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exit(1);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed.`);
  }
}

function buildPrBody(articlePath, published) {
  return `## 概要

- \`${articlePath}\` に記事を追加
- 現在の \`published\`: \`${published}\`
- 必要なら \`@codex review\` でレビュー依頼

## レビューチェック

- [ ] front matter が正しい
- [ ] \`npm run check\` が通っている
- [ ] 必要ならローカル preview を確認した
- [ ] 機密情報や未確認情報が含まれていない
- [ ] \`main\` へ merge して Zenn 同期してよい内容になっている
- [ ] 下書きのまま残したい場合は \`zenn:draft\` ラベルを付ける

## スマホレビュー用メモ

- GitHub モバイルアプリで PR を確認する
- 文言や構成の修正は PR コメントで指示する
- \`@codex\` への具体的な指示は、この PR ブランチだけを更新する想定
- merge で公開したい通常記事は \`published: false\` のままでよい

コメント例:

\`\`\`text
@codex
- タイトルをもっと具体化
- 結論を先に出す
- ハマりどころを短く整理
- published は false のまま
\`\`\`
`;
}

function printHelp() {
  console.log(`Usage:
  npm run article:pr -- --title "記事タイトル" [options]

Behavior:
  1. Create articles/<slug>.md
  2. Create a branch
  3. Commit the article
  4. Push the branch to origin
  5. Create a GitHub PR

Options:
  --title               Required. Article title.
  --slug                Optional. 12-50 chars, a-z0-9, "-" or "_".
  --emoji               Optional. Default: 📝
  --type                Optional. tech or idea. Default: tech
  --topics              Optional. Comma separated topics
  --published           Optional. true or false. Default: false
  --published-at        Optional. JST schedule. Example: 2026-06-20 09:00
  --body                Optional. Inline article body
  --body-file           Optional. Path to markdown body file
  --branch              Optional. Default: article/<slug>
  --base                Optional. Default: main
  --commit-message      Optional. Custom commit message
  --pr-title            Optional. Custom PR title
  --draft               Optional. true to create a draft PR
  --help                Show this help
`);
}
