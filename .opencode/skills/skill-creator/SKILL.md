---
name: skill-creator
description: Create new skills, modify and improve existing skills, and keep them organized in the Anthropic-style structure. Use when the user wants to create a skill from scratch, edit or restructure an existing skill, or understand the SKILL.md convention (frontmatter, scripts/, references/, assets/, agents/).
---

# Skill Creator

A skill for creating new skills in the Anthropic-style layout that opencode already
natively supports. Each skill is a folder named after the skill containing a `SKILL.md`
plus optional bundled resources. See `references/skill-anatomy.md` for the full schema.

## Process

1. **Capture intent** — what should the skill enable, and when should it trigger?
   Extract answers from the conversation if a workflow already exists; otherwise
   ask before writing anything.
2. **Write the SKILL.md** — frontmatter (`name`, `description`) plus the body.
3. **Iterate** — run a realistic prompt, check the result, revise.

Prefer the imperative form in instructions, and explain *why* something matters
rather than piling on all-caps MUSTs.

## Scaffolding

Create a new skill with the bundled script:

```bash
.opencode/skills/skill-creator/scripts/new-skill.sh my-skill [path/to/skills]
```

It writes `SKILL.md` (from `assets/SKILL.template.md`) and empty `scripts/`,
`references/`, `assets/` directories. Fill in the frontmatter `description` first —
it is the primary triggering mechanism.

## Writing the description

The `description` field is what decides whether a skill is surfaced to the model.
Cover **both** what the skill does and the specific contexts that should trigger it.
Front-load concrete keywords and filenames the user is likely to say, and gate with
"Use ONLY when..." if the skill should stay quiet on adjacent topics. Write in third
person. Erring "pushy" beats under-triggering: name the nearby words ("dashboard",
"slides", ".docx") even when the user doesn't say the exact term.

## Anatomy

```
skill-name/
├── SKILL.md        (required — frontmatter + markdown body)
├── LICENSE.txt     (optional)
├── scripts/        (executable code for deterministic, repeated tasks)
├── references/     (docs loaded into context only when needed)
├── assets/         (files used in output: templates, icons, fonts)
└── agents/         (instructions for specialized subagents)
```

Three-level loading: metadata (name + description) is always in context (~100 words),
the SKILL.md body loads when the skill triggers (keep it under ~500 lines), and
bundled resources load on demand. If a body approaches 500 lines, push detail into
`references/` and leave clear pointers about when to read them.

Reference files clearly from SKILL.md with guidance on when to read them; for large
reference files (>300 lines) include a table of contents. When a skill supports
several domains, split `references/` by variant (`aws.md`, `gcp.md`, `azure.md`) so
only the relevant one is read.

## Reference files

- `references/skill-anatomy.md` — frontmatter schema, directory layout, naming rules,
  and where skills live (project vs global vs external).
- `scripts/new-skill.sh` — scaffolding script.
- `assets/SKILL.template.md` — boilerplate for a new `SKILL.md`.
