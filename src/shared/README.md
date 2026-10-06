# Shared React building blocks

This directory is the home for React and TypeScript code reused by multiple FSCM roles or capabilities.

- `ui/` contains design-system primitives with no business knowledge.
- `components/` contains reusable business components such as order summaries, status badges, filters, tables, evidence viewers, and metric cards.
- `domain/` contains cross-role types and schemas for products, retailers, batches, orders, promotions, complaints, and notifications.
- `lib/` contains framework-independent formatting, validation, and utility code.

Shared components receive data and callbacks through typed props. They must not import a feature store, feature hook, or role-specific API module. Role-specific orchestration stays under `src/features/<feature>`.
