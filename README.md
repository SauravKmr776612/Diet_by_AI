# Goodkind nutrition planner

A small, responsive wellness-planning app built with Node.js and vanilla HTML, CSS, and JavaScript. It has no database and does not persist submitted health information.

## Run locally

Requires Node.js 22.9 or newer.

1. Copy `.env.example` to `.env`.
2. Set `SERVAM_API_KEY`, `SERVAM_API_URL`, and `SERVAM_MODEL` in `.env` using values from your AI provider. The URL must be a full OpenAI-compatible chat-completions endpoint. Use HTTPS outside local development.
3. Start the server with `npm start` and open `http://localhost:3000`.

If AI settings are omitted, the app returns a small set of general, non-personalized ideas. When an allergy is disclosed without an AI service configured, it avoids generating a meal plan. Configure production secrets through your hosting provider's secret/environment-variable settings, not frontend code or committed files.

## Checks

Run `npm test` to execute input validation and API endpoint tests.

## Privacy and safety

The browser sends form answers only to this app's `/api/plan` endpoint. The backend forwards validated answers to the configured AI provider when configured. The app does not log or store answers, and responses are marked `no-store`. Deployments should disclose the provider's processing and retention practices to users. This is general educational information, not diagnosis or treatment. People with health conditions, pregnancy, eating-disorder concerns, severe allergies, or medication-related food restrictions should consult a doctor or registered dietitian.
