# Contributing Guide

Thanks for taking time to improve KleinValue Advisor! A polished repo helps recruiters and other contributors understand the project quickly. Please follow the workflow below.

## Prerequisites

- Node.js 18 or newer
- npm 9+
- Chrome/Chromium for manual testing

## Local Setup

```bash
git clone https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension.git
cd kleinvalue-advisor
npm install
```

## Workflow

1. Create a feature branch: `git checkout -b feat/<short-description>`.
2. Make your changes with readable commits.
3. Run quality gates before pushing:
    ```bash
    npm run lint
    npm run format:check
    npm run build
    ```
4. Open a pull request that:
    - Describes the change and motivation.
    - Includes screenshots/GIFs for UI updates.
    - Mentions any manual verification steps (e.g., loading the extension in Chrome).

## Coding Standards

- Follow the ESLint + Prettier configuration checked into the repo.
- Prefer small, composable modules inside `lib/`.
- Keep UI strings and provider metadata centralized to simplify localization.
- Avoid committing API keys or `dist/` artifacts.

## Reporting Issues

Use GitHub Issues with a clear title, reproduction steps, and screenshots where possible. Security-sensitive disclosures should be shared privately with the maintainer.

## Tests

Automated unit tests are scheduled for a future milestone. Until then, please outline the manual testing you performed in your PR.
