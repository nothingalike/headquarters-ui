# Headquarters UI

A local web app over [headquarters](https://github.com/nothingalike/headquarters) (`~/.headquarters`): browse projects and stories, search everything, see your plate, and answer the questions and to-dos in reports.

Headquarters works fully without this app. The app reads the same files the agents write, and the only thing it writes is `answers.json` beside an interactive report.

## Install

You need Node 22.18 or newer, which runs the TypeScript server directly.

1. **Set up headquarters first**, if you haven't:

   ```bash
   npx skills add nothingalike/headquarters --global
   ```

   Then run `/hq-setup` once on your machine.

2. **Clone this repo** anywhere you like:

   ```bash
   git clone https://github.com/nothingalike/headquarters-ui.git
   ```

3. **Install its skills:**

   ```bash
   npx skills add nothingalike/headquarters-ui --global
   ```

4. **Run `/hq-ui-setup`** from inside the clone. It installs the app's packages, builds it, and turns on the switch that makes new headquarters reports interactive (`report-skill: hq-ui-report` in `~/.headquarters/settings.md`).

5. **Start the app** yourself. No skill starts it for you.

   ```bash
   npm start          # builds, then serves http://localhost:4321
   ```

   `HQ_ROOT` points it at another headquarters folder, and `HQ_UI_PORT` changes the port. To try it on made-up data, run `HQ_ROOT=examples/headquarters npm start`.

To turn interactive reports off again, delete the `report-skill:` line from `~/.headquarters/settings.md`. Reports written in the meantime keep a static `index.html`, so they still open from disk.

## What it does

- **Plate** (home): open items from `plate/plate.md` by project, with in-progress, waiting, blocked, and age, beside today's log.
- **Files**: the headquarters tree. Markdown renders, and HTML reports open in a sandboxed frame.
- **Search** (`Ctrl K` or `/`): names first, then full text across Markdown and reports.
- **Interactive reports**: a folder with `report.json` renders with a control for each item that asks something. Answers save to `answers.json` in that folder, where agents read them.
- **Inbox**: every unanswered item across interactive reports.
- **Live**: pages refresh when files change on disk.

## Skills

| Skill | Invoked by | What it does |
|---|---|---|
| `hq-ui-setup` | you, once per machine | Installs and builds the app, and turns on interactive reports in `~/.headquarters/settings.md`. |
| `hq-ui-report` | the agent | Writes reports as `report.json`, renders their static `index.html`, and reads your answers back from `answers.json`. Headquarters skills hand reports to it once the switch is on. |

## Adding a report type

1. Add a view in `web/src/reports/` and register it in `registry.tsx`.
2. Teach `skills/hq-ui-report` the type: its `report.json` shape, a check in `render.mjs`, and its static rendering in `template.html`.
3. If the type asks questions, extend `askedItems` in `shared/reports.ts` so its items reach the Inbox.

## Develop

```bash
npm run dev        # API with reload on :4321, Vite on :5173
npm test           # server tests
npm run typecheck
```

The server (`server/`) is Hono on Node; the app (`web/`) is React, Vite, and TypeScript; `shared/` holds the types and answer rules both use.
