# Repository Guidelines

## Project Structure & Module Organization

AIBooking is a Node.js ES-module application with a static PWA frontend. Root modules implement HTTP routing (`server.mjs`), RailKit integration (`railkit.mjs`), AI orchestration (`assistant.mjs`), MCP, payments, commerce, and SQLite storage. Browser modules, styles, icons, and HTML live in `public/`. Shared rail schemas and validation belong in `public/services.js`. Tests live in `test/`; operational documentation lives in `docs/` and `deploy/`. GitHub Actions configuration is in `.github/workflows/`.

## Build, Test, and Development Commands

Use Node.js 24 to match Docker and CI.

- `npm ci --ignore-scripts`: install locked dependencies.
- `cp .env.example .env && chmod 600 .env`: prepare private local configuration; edit credentials locally.
- `node --env-file=.env server.mjs`: run locally at `http://localhost:3000`.
- `npm start`: run using already-exported environment variables; it does not load `.env`.
- `npm test`: execute all Node test-runner suites.
- `docker build -t aibooking-local .`: validate the production image. No frontend compilation step exists.

## Coding Style & Naming Conventions

Use ES-module imports, `.mjs` for server modules, and `.js` for browser modules. Prefer camelCase functions and variables, descriptive filenames, and two-space indentation in new multiline blocks; preserve surrounding compact formatting when editing existing files. No formatter or lint command is configured. Validate browser-provided inputs server-side and render untrusted text through `textContent`.

## Testing Guidelines

Use `node:test` and `node:assert/strict`; UI interaction tests use jsdom. Name suites `test/<feature>.test.mjs` and describe observable behavior in test names. Mock provider requests and use isolated SQLite databases. Cover changed validation, failure paths, payment verification, and persistence. No numeric coverage threshold is configured. Run `npm test` before submitting; jsdom does not replace real-browser layout checks.

## Commit & Pull Request Guidelines

History uses concise imperative subjects, such as “Integrate hosted wallet checkout”; Conventional Commit prefixes are not required. Explain the problem, resulting behavior, validation, and material limitations in PR descriptions. Link relevant issues and include screenshots for visible UI changes. Main-branch pushes automatically deploy passing revisions to pi.

## Security & Deployment

Never commit `.env`, credentials, private keys, certificates, or SQLite data. Keep provider secrets server-side. Do not fabricate rail results, payment confirmations, or booking capabilities. Payments use hosted checkout; no stored-money wallet exists. Preserve production data and use `compose.pi.yaml` for pi; standalone Compose conflicts with its shared proxy. Follow `docs/OPERATIONS.md` before deployment or recovery changes.
