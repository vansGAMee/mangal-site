import { readFileSync } from "node:fs";
import { join } from "node:path";

const skills = [
  "existing-project-audit",
  "safe-refactor-existing-app",
  "restaurant-site-productization",
  "database-migrations-and-seeding",
  "vercel-demo-deployment",
  "russian-vps-deployment",
  "browser-sales-research",
  "vk-outreach-human-review",
  "browser-qa-and-handoff",
];

for (const skill of skills) {
  const directory = join(".agents", "skills", skill);
  const markdown = readFileSync(join(directory, "SKILL.md"), "utf8");
  const frontmatter = markdown.match(
    /^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: (.+)\r?\n---\r?\n/,
  );

  if (!frontmatter || frontmatter[1] !== skill || frontmatter[2].includes("TODO")) {
    throw new Error(`Invalid SKILL.md frontmatter: ${skill}`);
  }

  const metadata = readFileSync(join(directory, "agents", "openai.yaml"), "utf8");
  if (!metadata.includes(`default_prompt: "Use $${skill}`)) {
    throw new Error(`Invalid agents/openai.yaml: ${skill}`);
  }

  process.stdout.write(`VALID ${skill}\n`);
}
