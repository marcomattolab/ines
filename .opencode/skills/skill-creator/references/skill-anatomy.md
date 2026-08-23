# Skill Anatomy

## Directory layout

```
skill-name/
├── SKILL.md        (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled resources (optional)
    ├── scripts/    - executable code for deterministic/repetitive tasks
    ├── references/ - docs loaded into context as needed
    ├── assets/     - files used in output (templates, icons, fonts)
    └── agents/     - instructions for specialized subagents
```

## Frontmatter schema

```yaml
---
name: my-skill            # required, lowercase hyphen-separated, <= 64 chars, matches folder name
description: ...          # required in practice — skills without one are filtered out
license: ...              # optional
compatibility: ...        # optional — required tools/dependencies
metadata: {}              # optional — string-string map
---
```

- `name` must match the folder name and be lowercase hyphen-separated.
- `description` drives triggering. Cover both what the skill does and when to use it.
  Write in third person, front-load trigger keywords/filenames, and gate with
  "Use ONLY when..." to stay quiet on adjacent topics. Skew "pushy" — the more common
  failure is under-triggering, so name the nearby words the user might say.

## Progressive disclosure

1. **Metadata** (name + description) — always in context (~100 words).
2. **SKILL.md body** — in context when the skill triggers (keep under ~500 lines).
3. **Bundled resources** — loaded on demand; scripts can execute without loading.

If a body approaches 500 lines, add a layer of hierarchy and pointer text ("see
`references/foo.md` for X") instead of growing the body.

## Where skills live

opencode scans for `**/SKILL.md` in each skill directory.

| Scope | Path |
| --- | --- |
| Project | `.opencode/skills/<name>/SKILL.md` |
| Global | `~/.config/opencode/skills/<name>/SKILL.md` |
| External (auto-loaded) | `~/.claude/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md` |

Register non-default locations in `opencode.json`:

```json
{
  "skills": {
    "paths": [".opencode/skills", "/abs/path/to/skills"],
    "urls": ["https://example.com/.well-known/skills/"]
  }
}
```

Changes to skills are loaded at startup only — restart opencode after editing.

## Writing patterns

- Prefer the imperative form in instructions.
- Explain *why* rather than stacking all-caps MUSTs.
- Define output formats explicitly with a fixed template.
- Use Input/Output example pairs where they clarify behavior.
