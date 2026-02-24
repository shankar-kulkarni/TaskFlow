```markdown
# 📦 Reusable Component Library – Build Spec

## 0. Purpose (Read First)

This document defines **how to build, structure, and extend a reusable UI component library** for this SaaS application.

**Primary goals:**
- Consistency across the app
- Reusability without over-engineering
- Predictable AI-generated UI code
- Zero visual or behavioral drift

This library is **not a design playground**.  
It is a **stable system**.

---

## 1. Tech Stack & Constraints

```

Framework: React + Next.js (App Router)
Language: TypeScript
Styling: Tailwind CSS
Base Components: shadcn/ui
Icons: lucide-react
Animations: none by default (explicit only)

```

### Hard Constraints

```

* No custom CSS files
* No inline styles
* No new UI libraries without approval
* Tailwind utilities only

```

---

## 2. Component Categories (Strict)

All components MUST belong to exactly one category.

```

/components
├── ui/           # Primitive, design-system components
├── shared/       # Reusable domain components
├── layouts/      # Structural components

```

### 2.1 UI Primitives (`/components/ui`)

- Lowest-level building blocks
- Stateless or minimally stateful
- No business logic
- No API calls

Examples:
```

Button
Input
Textarea
Select
Card
Dialog
Tabs
Badge
Toast
Skeleton

```

✅ Can be reused anywhere  
❌ Must not know about app domain

---

### 2.2 Shared Components (`/components/shared`)

- Combine UI primitives
- Represent domain concepts
- May accept data as props
- No direct API calls

Examples:
```

UserAvatar
PricingCard
EmptyState
ConfirmDeleteDialog
StatusBadge

```

---

### 2.3 Layout Components (`/components/layouts`)

- Page or section structure only
- No data fetching
- No business logic

Examples:
```

AppShell
DashboardLayout
AuthLayout

```

---

## 3. Component Design Rules (Critical)

### 3.1 Single Responsibility

Each component must do **one thing well**.

❌ Bad:
```

UserCard that fetches data, formats it, and submits updates

```

✅ Good:
```

UserCard that only displays user data passed via props

```

---

### 3.2 Explicit Props (No Implicit Behavior)

All props must be:
- Typed
- Optional only when truly optional
- Clearly named

Example:
```

<Card
title="Project Name"
description="Short summary"
footerActions={<Button />}
/>

```

No hidden assumptions.

---

### 3.3 Controlled States Only

Allowed internal states:
- open / closed
- loading
- selected
- expanded

Forbidden:
- Fetching data
- Mutating global state
- Side effects

---

## 4. Component States (Required)

Every interactive component MUST define states.

Example: `Button`

```

States:

* default
* hover
* focus
* loading
* disabled

```

Rules:
```

* Loading replaces content with spinner
* Disabled prevents interaction
* Loading implies disabled

```

---

## 5. Styling Rules

```

* Tailwind utility classes only
* Use design tokens via Tailwind config
* Spacing uses Tailwind scale
* Border radius: rounded-2xl
* Shadows: shadow-sm or shadow-md only

```

No visual creativity unless specified.

---

## 6. Accessibility (Minimum Standard)

All components must:
```

* Use semantic HTML
* Support keyboard navigation
* Include aria-* where appropriate
* Have visible focus states

```

If unsure → copy shadcn/ui behavior.

---

## 7. File Structure & Naming

```

components/
ui/
button.tsx
input.tsx
card.tsx
shared/
empty-state.tsx
confirm-dialog.tsx
layouts/
app-shell.tsx

```

Rules:
```

* One component per file
* File name = component name (kebab-case)
* Component name = PascalCase

```

---

## 8. Versioning & Change Rules

```

* Do not break existing component APIs
* Extend via new props
* If behavior changes → create a new variant

```

No silent breaking changes.

---

## 9. When to Create a New Component

Create a new reusable component ONLY if:
```

* Used in 2+ places
* Has a clear, stable responsibility
* Can be parameterized via props

```

Otherwise → keep it local.

---

## 10. When NOT to Create a Component

Do NOT create reusable components for:
```

* One-off layouts
* Page-specific logic
* Experiments
* Temporary UI

```

---

## 11. AI-Specific Rules (Very Important)

```

AI COMPONENT RULES:

* Do not invent new components
* Reuse existing components whenever possible
* Follow this spec strictly
* Ask before adding a new reusable component
* Prefer composition over abstraction

```

---

## 12. Example: Proper Component Creation Flow

```

1. Need a repeated UI pattern
2. Check /components/ui
3. Check /components/shared
4. If missing → define spec first
5. Then create component

```

Never skip step 4.

---

## 13. Definition of “Done” for a Component

A component is complete when:
```

* Props are typed
* States are defined
* Styling matches rules
* Accessibility considered
* No business logic included

```

---

## Final Note

This component library exists to:

> **Reduce decisions, not increase flexibility.**

Consistency > customization.
```
