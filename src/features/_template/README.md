# Feature template

Copy this folder after a client-facing capability is approved. Keep role-specific API calls, components, hooks, pages, schemas, and TypeScript types together.

Before adding a component or type here, check whether another role can use it:

- Framework and design-system primitives belong in `src/shared/ui` or `src/shared/lib`.
- Cross-role business types and composed components belong in `src/shared/domain` and `src/shared/components`.
- Components and hooks that encode one role's workflow remain in `src/features/<feature>`.

Features must not import presentation components from another feature. Promote shared behavior first and expose role-specific actions through props or composition.
