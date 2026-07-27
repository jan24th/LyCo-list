// 同步 .scratch 各 spec.md 中 issue 链接后的状态标注与 issue 文件的 Status: 行
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

for (const group of readdirSync(".scratch")) {
  const specPath = join(".scratch", group, "spec.md");
  let spec;
  try {
    spec = readFileSync(specPath, "utf8");
  } catch {
    continue;
  }
  const updated = spec.replace(
    /\[(.+?)\]\(issues\/(.+?\.md)\) — (.+?)（(.+?)）/g,
    (m, name, file, title) => {
      const content = readFileSync(join(".scratch", group, "issues", file), "utf8");
      const status = (content.match(/^Status: (.+)$/m) || [])[1];
      return `[${name}](issues/${file}) — ${title}（${status}）`;
    },
  );
  if (updated !== spec) {
    writeFileSync(specPath, updated);
    console.log(`updated: ${group}`);
  }
}
