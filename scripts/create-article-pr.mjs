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
  return `## Summary

- add article at \`${articlePath}\`
- published: \`${published}\`
- request Codex review if needed with \`@codex review\`

## Review Checklist

- [ ] front matter is correct
- [ ] \`npm run check\` passed
- [ ] local preview was checked when needed
- [ ] no confidential or unverified content is included
- [ ] merge to \`main\` is safe for Zenn sync

## Mobile Review Notes

- Review this PR in the GitHub mobile app
- Use PR comments for wording or structure feedback
- Use \`@codex\` with concrete instructions to update only this PR branch
- Keep \`published: false\` unless this PR is ready to go live on Zenn

Example:

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
