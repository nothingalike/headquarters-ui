---
name: hq-ui-report
description: Write headquarters reports as data that Headquarters UI makes interactive, and read the user's answers back. Use when headquarters `settings.md` names `report-skill: hq-ui-report`, or when work picks up from a report folder that holds `answers.json`.
---

Headquarters UI renders a report folder's `report.json` with live controls: a checkbox for each to-do, a text box for each question, buttons for each choice. The user's answers save to `answers.json` in the same folder. This skill writes the data, renders a static `index.html` from it so the report still opens straight from disk, and reads the answers back.

The calling skill (or the hq guide) still decides where the report goes and what it says. This skill decides its format.

## Writing a report

1. **Pick the type.** A report whose main job is things for the user to do, answer, approve, or choose (a to-do list, open questions, plans awaiting sign-off) is a `todo` report. Every other report is written the way the calling skill describes, as static HTML, and this skill's work ends there.
2. **Create the folder** where the calling skill or the hq guide puts reports, such as `~/.headquarters/<project>/general/reports/YYYY-MM-DD-HHMM-<slug>/`.
3. **Write `report.json`** in the shape below. Write the copy by the rules in `hq-artifact-design` (section 3).
4. **Render** with `node <this skill's folder>/render.mjs <report folder>`. It checks the data, lists any problems, and writes `index.html`. The report is done when it prints `Wrote …`.
5. **Hand over** both links: the app page `http://localhost:4321/f/<path inside headquarters>`, which works while the user has the app running, and the `file:///` link to `index.html`, as the hq guide describes. The user starts the app themselves.

To update a report, edit `report.json` and render again. Keep the ids of unchanged items, because answers attach to ids.

## The `todo` shape

```json
{
  "type": "todo",
  "version": 1,
  "title": "Acme to-do, Oct 7",
  "summary": "Three things need you before the cart release.",
  "created": "2026-10-07T18:09",
  "project": "acme-shop",
  "story": "SHOP-004",
  "sections": [
    {
      "id": "review",
      "title": "Review before the agent builds",
      "intro": "Both plans are written; nothing is committed.",
      "items": [
        { "id": "approve-cart-plan", "ask": "check", "text": "Approve the **SHOP-004** cart plan in `docs/plans/cart.md`" },
        { "id": "gift-card-tax", "ask": "text", "text": "Which tax rule applies to gift cards?", "waitingOn": "Dana" },
        { "id": "release-day", "ask": "choice", "text": "Pick the release day", "options": ["Tuesday", "Thursday"] },
        { "id": "email-dana", "ask": "check", "text": "Send Dana the tax question", "detail": "Hi Dana,\n\nWhich tax rule applies to gift cards?" },
        { "id": "build-green", "text": "The build on `main` is green." }
      ]
    }
  ]
}
```

- **`ask`** sets the control: `check` for something to do, `text` for a question, `choice` for a pick from `options` (two or more). An item without `ask` is information and gets no control.
- **`text`, `detail`, `summary`, and `intro`** are Markdown. Put anything the user copies (an email draft, a command, SQL) in `detail`, which gets a Copy button.
- **Ids** are lowercase words joined by hyphens, unique across the whole report, and named for the item (`gift-card-tax`), so they stay stable when items move.
- `waitingOn`, `story`, `project`, `created`, `summary`, and `intro` are optional.

## Reading answers

`answers.json` belongs to the user: the UI writes it, and agents read it. When work picks up from a report, read it next to `report.json`:

```json
{ "version": 1, "answers": {
  "approve-cart-plan": { "done": true, "at": "2026-10-08T14:02:11.000Z" },
  "gift-card-tax": { "text": "Exempt, per Dana's email", "at": "2026-10-08T14:05:40.000Z" },
  "release-day": { "choice": "Thursday", "text": "after the freeze", "at": "2026-10-08T14:06:02.000Z" }
} }
```

An item with no entry is unanswered. `text` on a `check` or `choice` item is the user's note. Act on each answer, then record what came of it where the hq guide puts that kind of knowledge: an answered question in the plate log and the story, a decision on the story.
