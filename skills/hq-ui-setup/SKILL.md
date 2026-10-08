---
name: hq-ui-setup
description: Install Headquarters UI on this machine and switch headquarters reports to its interactive format.
disable-model-invocation: true
---

Headquarters UI is a local web app over `~/.headquarters`. Headquarters works fully without it; this setup adds the app and turns on the switch that makes reports interactive. Each step is idempotent: check what exists and change only what's missing.

## 1. Find the clone

The app runs from a clone of the `headquarters-ui` repo. Use the current folder when it is one (its `package.json` names `headquarters-ui`); otherwise ask the user where they cloned it.

## 2. Install and build

In the clone, run `npm install`, then `npm run build`. Done when `dist/index.html` exists.

## 3. Check the report skill

`hq-ui-report` must sit beside the headquarters skills in each agent's skills folder (`~/.claude/skills/`, and `~/.codex/skills/` when Codex is used). When it's missing, tell the user to run `npx skills add nothingalike/headquarters-ui --global`, and continue once it's there.

## 4. Turn on the switch

Add this line to `~/.headquarters/settings.md`, creating the file with a `# Settings` heading if needed:

```
report-skill: hq-ui-report
```

Headquarters skills read `settings.md` before writing a report, so new reports now go through `hq-ui-report`. Removing the line turns the switch off; reports written meanwhile keep their static `index.html`.

## 5. Hand over

The user starts the app themselves. Give them the command and leave running it to them: `npm start` in the clone, which serves `http://localhost:4321` (`HQ_ROOT` points it at another headquarters, `HQ_UI_PORT` changes the port).

Tell the user what changed and where: the build, the `settings.md` line, and the command to start the app.
