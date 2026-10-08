---
name: hq-ui-setup
description: Install Headquarters UI on this machine and switch headquarters reports to its interactive format.
disable-model-invocation: true
---

Headquarters UI is a local web app over `~/.headquarters`. Headquarters works fully without it; this setup adds the app and turns on the switch that makes reports interactive. Each step is idempotent: check what exists and change only what's missing.

## 1. Install and build

In this repo's root, run `npm install`, then `npm run build`. Done when `dist/index.html` exists.

## 2. Install the report skill

Link `skills/hq-ui-report` into each agent's skills folder beside the headquarters skills (`~/.claude/skills/`, and `~/.codex/skills/` when Codex is used), the same way the headquarters skills are linked: a junction on Windows (`New-Item -ItemType Junction`), a symlink elsewhere.

## 3. Turn on the switch

Add this line to `~/.headquarters/settings.md`, creating the file with a `# Settings` heading if needed:

```
report-skill: hq-ui-report
```

Headquarters skills read `settings.md` before writing a report, so new reports now go through `hq-ui-report`. Removing the line turns the switch off; reports written meanwhile keep their static `index.html`.

## 4. Hand over

The user starts the app themselves. Give them the command and leave running it to them: `npm start` in this repo, which serves `http://localhost:4321` (`HQ_ROOT` points it at another headquarters, `HQ_UI_PORT` changes the port).

Tell the user what changed and where: the links made, the `settings.md` line, and the command to start the app.
