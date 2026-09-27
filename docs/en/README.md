# KanRay · Documentation Hub

> 中文: [README.md](../README.md)

This directory holds the project's **complete product manual**. It is split into standalone documents by role, covering everything from installation and deployment to day-to-day use. Chinese and English live in separate files; use the language switcher at the top of each page to move between them.

> For a quick start (deployment commands, default account, common commands) see the root [README](../../README_EN.md). This hub is for deeper usage and operations topics.

## Reader Navigation

| Role | Read first | Then read |
|------|------|------|
| Business users (upload data / build charts / assemble dashboards / build big screens / design forms) | [Quick start](quick-start.md) | [User manual](01-user-manual.md) |
| Administrators (users / roles / audit / API keys) | [Quick start](quick-start.md) | [Admin manual](02-administration-manual.md) |
| Data engineers (connect external databases / build datasets) | [Quick start](quick-start.md) | [Data sources & builder](03-data-sources-and-builder.md) |
| Big-screen authors (visualization screens / cockpits / presentations) | [User manual](01-user-manual.md) | [Big-screen designer manual](07-big-screen-designer.md) |
| Form users (design / publish / share online forms, collect data) | [Forms manual](08-forms-manual.md) | [User manual](01-user-manual.md) |
| External system developers (Open API integration) | [Open API integration guide](04-open-api-integration.md) | — |
| Operations (Docker / systemd / multi-instance deployment, database and Redis configuration, key management) | [Deployment & operations manual](05-deployment-and-operations.md) | [FAQ](06-faq.md) |

## Document List

| Document | Contents | Size |
|------|------|------|
| [Quick start](quick-start.md) | Two startup paths (container image / source), signing in, first dashboard in 3 minutes | ~4k words |
| [01-User manual](01-user-manual.md) | Data upload → charts → dashboards → cross-filtering → sharing, the full day-to-day workflow | ~6k words |
| [02-Admin manual](02-administration-manual.md) | User management, roles & permission points, audit log, Open API keys, access tokens | ~5k words |
| [03-Data sources & builder](03-data-sources-and-builder.md) | 22 drivers, direct vs sync, three builder modes (SQL / drag-and-drop / ETL), table registration | ~5k words |
| [04-Open API integration guide](04-open-api-integration.md) | Credential system, 6 data endpoints, CSV, rate limiting & security, error codes, Swagger | ~6k words |
| [05-Deployment & operations manual](05-deployment-and-operations.md) | Docker / systemd deployment, full env-var table, database (storage backend) switching, Redis, multi-instance distributed deployment, key rotation | ~6k words |
| [06-FAQ](06-faq.md) | Scenario-based Q&A: sign-in / data sources / sync / sharing / Open API | ~3k words |
| [07-Big-screen designer manual](07-big-screen-designer.md) | Free-layout big-screen canvas, component library, data binding, templates, preview & sharing, shortcuts & permissions | ~5k words |
| [08-Forms manual](08-forms-manual.md) | Form design / publish & close / password & public sharing / filling online / submission records, with data written back to datasets | ~3k words |

## Conventions

- Baseline: the latest code on the `master` branch
- Default account: `admin@kanray.local / admin123` (change it in production — see the deployment manual)
- Menu paths are written in the form “Administration → Users”
- Language layout: Chinese and English live in separate files, linked by the language switcher at the top of each page; code blocks and commands are written once per language (they are language-neutral); when a table's headers are Chinese, an English table is appended right after; screenshots come in two language variants — the Chinese UI uses `images/NN-*.png` and the English UI uses `images/en/NN-*.png`, and each figure appears as an adjacent pair
- Proper nouns are not translated: the product name `KanRay`, technology stack names, permission codes, API paths, and environment variable names stay as-is
