# CONVENTIONS.md — ABF e-Requisition Coding Conventions

> Detailed examples and rules referenced from `CLAUDE.md`. Read the relevant section
> before writing code that touches it.

---

## 1. Clean Code Examples

### Guard Clauses (Max 3 Levels of Nesting)

```ts
// BAD — deep nesting
function getLabel(item) {
  if (item) {
    if (item.isActive) {
      if (item.label) {
        return item.label;
      }
    }
  }
  return 'Unknown';
}

// GOOD — early returns
function getLabel(item: IItem): string {
  if (!item || !item.isActive) return 'Unknown';
  return item.label ?? 'Unknown';
}
```

### No Magic Numbers or Strings

```ts
// BAD
if (items.length > 50) { /* ... */ }

// GOOD
const MAX_ITEMS_PER_PAGE = 50;
if (items.length > MAX_ITEMS_PER_PAGE) { /* ... */ }
```

Extract domain constants (fiscal month count, CBU total, status codes) into
`src/webparts/<name>/constants/index.ts` with descriptive names.

### Pure Functions and Predictable Logic
- Business logic lives in utility/helper functions, not inside JSX or component bodies.
- Avoid side effects inside render logic.
- Prefer `const` over `let`; never use `var`.

---

## 2. Naming Conventions

| Element            | Rule                                      | Example                       |
|--------------------|-------------------------------------------|-------------------------------|
| Component          | PascalCase, one per file                  | `RequisitionForm.tsx`         |
| Hook               | camelCase, prefix `use`                   | `useRequisitions.ts`          |
| Service            | PascalCase, suffix `Service`              | `RequisitionService.ts`       |
| Interface          | PascalCase, prefix `I`                     | `IRequisition`                |
| Type alias         | PascalCase, prefix `T`                     | `TApprovalStatus`             |
| Enum               | PascalCase                                | `ExpenseType`                 |
| Boolean variable   | prefix `is`/`has`/`can`/`should`          | `isLoading`, `hasError`       |
| Event handler      | prefix `handle`                           | `handleSubmit`, `handleClick` |
| SCSS module class  | camelCase                                 | `errorMessage`, `cardWrapper` |
| Util function      | camelCase, descriptive verb               | `formatFiscalYear`            |

---

## 3. File Splitting Rules

Split a file when **any** of these is true:
- A component file exceeds ~150 lines.
- A file contains more than one exported component.
- Props/interfaces are reused by more than one component.
- A function is used in more than one place.
- Business/data logic is mixed into a UI component.

Placement:
- Types for a single component go in `<ComponentName>.types.ts` beside it.
- Types shared across components go in `src/webparts/<name>/types/index.ts`.
- Every component directory exports via an `index.ts` barrel.

### Barrel Export Example

```ts
// components/MyList/index.ts
export { MyList } from './MyList';
export type { IMyListProps } from './MyList.types';
```

---

## 4. SCSS Module Rules

- Every component has its own `.module.scss` named to match the component.
- Use **camelCase** class names (`errorMessage`, `cardWrapper`).
- Use SPFx theme tokens / CSS custom properties for colors, fonts, and spacing —
  never hardcode hex values or pixel sizes for theme-sensitive values.
- Avoid global class names; all classes must be scoped to the module.
- Group styles by component section; comment non-obvious rules.

```scss
// GOOD SCSS module structure
.container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  font-size: var(--ms-font-size-large);
  color: var(--ms-color-themePrimary);
}

.errorMessage {
  color: var(--ms-color-error);
  font-weight: 600;
}
```

---

## 5. Fluent UI Styling

- Customize Fluent UI components through their `styles` prop using style objects or
  `mergeStyles` / `mergeStyleSets` — not inline `style` attributes on wrapper divs.
- Use `mergeStyles` for dynamic/conditional class generation.

```ts
import { mergeStyles } from '@fluentui/react';

const activeClass = mergeStyles({
  backgroundColor: theme.palette.themePrimary,
  color: theme.palette.white,
});
```

---

## 6. Data Flow Pattern

Components never fetch data directly. Follow this chain:

```
Component  ->  Hook (use*)  ->  Service (*Service.ts)  ->  SharePoint
```

- Components render UI and handle user events only.
- Hooks own state and orchestration.
- Services own all SharePoint REST/Graph calls and return typed results.
- Services catch errors and return typed error objects — never throw raw errors into components.
- Pass `WebPartContext` into services, not into components.
- Always handle loading, error, and empty states in data-fetching components.