import path from "node:path";
import { createArticleFromArgs, parseArgs } from "./zenn-article-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

try {
  const { articlePath } = await createArticleFromArgs(args);
  console.log(`Created ${path.relative(process.cwd(), articlePath)}`);
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exit(1);
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
