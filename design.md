# Libellus Design System

## 1. Design Direction

Libellus is a **minimal dark developer workstation**.

The visual direction is inspired by serious desktop developer tools,
code editors, terminals, and lightweight technical applications. It
should feel like a real tool built for developers rather than a
web-based SaaS dashboard.

### Core aesthetic

**Minimal dark developer workstation**

The interface should feel:

-   Quiet
-   Technical
-   Precise
-   Dense but not cluttered
-   Fast
-   Focused
-   Professional
-   Slightly utilitarian
-   Keyboard-friendly

The provided `designidea.png` is the primary visual reference for the
project's overall visual direction.

------------------------------------------------------------------------

## 2. Core Design Principles

### 2.1 Desktop application first

Libellus should look and behave like a native desktop application.

Prefer:

-   Application menus
-   Tabs
-   Panels
-   Documents
-   Keyboard shortcuts
-   Command palettes
-   Compact controls
-   Persistent workspace state

Avoid:

-   Marketing-style layouts
-   Hero sections
-   Dashboard grids
-   SaaS-style navigation
-   Excessive onboarding UI

### 2.2 Content and workspace first

The application should prioritize the user's current work.

> **Content first, chrome second.**

Do not add interface elements merely because there is empty space. Empty
space is acceptable when it improves focus.

### 2.3 Flat visual language

Prefer solid backgrounds, thin borders, subtle separators, typography,
spacing, and simple state indicators.

Avoid heavy shadows, glassmorphism, large gradients, excessive blur,
decorative backgrounds, floating cards everywhere, and excessive depth
effects.

### 2.4 No generic card-based dashboard

Cards should not be the fundamental layout primitive. Prefer documents,
lists, tabs, panels, and simple separators.

The application should feel like one coherent workspace rather than a
collection of independent widgets.

------------------------------------------------------------------------

## 3. Application Structure

The main Libellus window should follow a lightweight code-editor-like
structure:

``` text
┌──────────────────────────────────────────────────────────────┐
│ File   Edit   View   ...                            libellus │
├──────────────────────────────────────────────────────────────┤
│  Notes       snippet.ts       API Notes                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                         Workspace                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Primary areas:

1.  Application menu
2.  Tab/workspace bar
3.  Main workspace
4.  Optional contextual panels

The main workspace should receive most of the available space.

------------------------------------------------------------------------

## 4. Application Menu

A traditional desktop-style menu should be available. Initial structure:
`File`, `Edit`, `View`.

Additional menus should only be added when they provide real
functionality.

Menus should remain subtle and compact.

------------------------------------------------------------------------

## 5. Tabs

Tabs are a fundamental part of Libellus. Different types of content can
be opened as tabs:

-   Notes
-   Snippets
-   Secrets
-   Utilities
-   Future workspace documents

Tab rules:

-   Keep tabs compact.
-   Make active tabs distinguishable without making them excessively
    bright.
-   Avoid large rounded tab containers.
-   Avoid excessive icons.
-   Use subtle separators.
-   Truncate long titles gracefully.
-   Support closing tabs.
-   Preserve open tabs when appropriate.

Tabs should make Libellus feel like a persistent workspace rather than a
sequence of pages.

------------------------------------------------------------------------

## 6. Navigation

Libellus should **not rely on a permanent large sidebar**.

Navigation should primarily happen through:

-   Command palette
-   Quick switcher
-   Search
-   Recent items
-   Tabs
-   Keyboard shortcuts

### Command palette

The command palette is a core interaction pattern and should allow users
to search content, open and create documents, run utilities, execute
commands, and navigate the application.

`Ctrl/Cmd + K` should be considered the primary entry point. A
quick-open shortcut such as `Ctrl/Cmd + P` can be used for direct
resource navigation.

------------------------------------------------------------------------

## 7. Typography

Typography is a major part of Libellus's identity.

The application should use a technical, readable type system with strong
monospace influence.

Consider:

-   JetBrains Mono
-   IBM Plex Mono
-   Geist Mono
-   A high-quality system monospace font

The final choice should prioritize readability, character distinction,
rendering quality, and good support for code and technical content.

Monospace typography can be used throughout the interface, not only
inside code blocks.

Avoid excessive font-size variation, huge headings, and decorative
display fonts. Use weight and spacing to establish hierarchy, keep
interface labels compact, and use stronger contrast for primary content
and subdued contrast for metadata.

------------------------------------------------------------------------

## 8. Color System

The color palette should be restrained and predominantly dark. Use
several closely related neutral dark surfaces rather than many colors.

Conceptual layers:

``` text
Application chrome
      ↓
Tab / navigation surface
      ↓
Workspace background
      ↓
Content surface
```

Example starting palette:

``` text
Application chrome   #1F1F27
Tab surface          #1B1B22
Workspace            #202028
Primary text         #E6E6EA
Secondary text       #92929B
Muted text           #666873
Border               #2A2A33
```

These values are starting points, not immutable requirements.

### Accent color

Use one restrained accent color for active tab, focus, selection,
important interactive states, and links when necessary. Do not use the
accent as decoration. Avoid rainbow interfaces and excessive semantic
colors.

------------------------------------------------------------------------

## 9. Borders and Separators

Thin separators should be one of the primary methods of structuring the
interface.

Borders should be thin, low contrast, consistent, and used to establish
structure. Avoid thick decorative borders.

------------------------------------------------------------------------

## 10. Shapes and Corners

Libellus should generally use square or very slightly rounded geometry.

Avoid large pill shapes, excessive rounded corners, bubble-like
controls, and highly rounded cards.

Buttons, tabs, inputs, menus, and panels should feel like parts of a
technical desktop application.

------------------------------------------------------------------------

## 11. Icons

Icons should be used sparingly. Do not use an icon simply because an
action exists. Use icons when they improve recognition or reduce
ambiguity.

Avoid decorative icon grids, large colorful icons, emoji as UI
decoration, and mixed icon styles.

If an icon system is introduced, it should remain visually consistent
and restrained.

------------------------------------------------------------------------

## 12. Notes

Notes should feel like developer documents rather than generic
productivity cards.

A note should provide a clean reading and editing environment. The
content should dominate the interface.

Avoid turning notes into a large visual block editor unless a real
feature requires it.

------------------------------------------------------------------------

## 13. Snippets

Snippets should feel like a developer code library.

A snippet can contain:

-   Title
-   Language
-   Code
-   Description
-   Tags
-   Metadata

Code should receive appropriate syntax highlighting, while the
surrounding interface remains restrained.

------------------------------------------------------------------------

## 14. Secrets

Secrets require a distinct but consistent visual treatment. The
interface should make sensitive information clearly identifiable without
turning the application into a warning-heavy interface.

Important interactions should include:

-   Masking by default
-   Explicit reveal
-   Copy
-   Clear sensitive-state indication
-   Confirmation where destructive or risky actions require it

Avoid displaying secrets unnecessarily.

------------------------------------------------------------------------

## 15. Utilities

Utilities should open inside the same workspace system rather than
looking like separate web applications.

Utilities should share typography, colors, spacing, controls, tabs, and
menus. The user should always feel that they are still inside Libellus.

------------------------------------------------------------------------

## 16. Spacing and Density

Libellus should be relatively compact. It should not use excessive
padding simply to create a modern "airy" appearance.

Prefer tight but readable spacing, consistent vertical rhythm, compact
navigation, and efficient use of screen space.

However, density must not reduce readability.

> **High information density without visual clutter.**

------------------------------------------------------------------------

## 17. Interaction Design

Interactions should be fast and predictable.

Prefer immediate feedback, small transitions, clear focus states,
keyboard shortcuts, and familiar desktop conventions.

Avoid long animations, elaborate entrance animations, bouncy UI,
excessive hover effects, and decorative motion.

### Animation principle

Animations should communicate a state change, not entertain the user.

Good examples:

-   Tab opening/closing
-   Panel appearing
-   Command palette opening
-   Selection changes
-   Saving state

Avoid elements flying across the screen, large scaling effects, constant
background motion, and decorative particle effects.

------------------------------------------------------------------------

## 18. Keyboard-first Interaction

Libellus is a developer tool, so keyboard interaction should be a major
design consideration.

Examples:

``` text
Ctrl/Cmd + K    Command palette
Ctrl/Cmd + P    Quick open
Ctrl/Cmd + N    New document
Ctrl/Cmd + W    Close tab
Ctrl/Cmd + S    Save
Ctrl/Cmd + F    Search
```

The exact shortcuts should follow platform conventions. Keyboard focus
should always be visually clear.

------------------------------------------------------------------------

## 19. States

Every major interface should have deliberate states:

-   Empty
-   Loading
-   Saving
-   Saved
-   Error
-   Disabled
-   Focused
-   Selected
-   Hovered
-   Active
-   Modified / unsaved

States should be communicated primarily through typography, borders,
subtle background changes, and small indicators. Do not rely on color
alone.

------------------------------------------------------------------------

## 20. Window Behavior

Although Libellus is a desktop application, it should behave well at
different window sizes.

### Large windows

Use additional space to expand the workspace rather than introducing
unnecessary UI.

### Small windows

Prioritize:

1.  Main content
2.  Tabs
3.  Essential controls

Secondary panels should be collapsible or temporarily hidden.

The application should never feel like a responsive website squeezed
into a desktop window.

------------------------------------------------------------------------

## 21. Design Anti-Patterns

The following should generally be avoided unless there is a strong
functional reason:

-   Generic SaaS dashboard layouts
-   Large hero sections
-   Excessive cards
-   Glassmorphism
-   Heavy gradients
-   Excessive shadows
-   Huge rounded corners
-   Pill-shaped UI everywhere
-   Giant colorful icons
-   Excessive accent colors
-   Decorative illustrations
-   Excessive whitespace
-   Persistent large sidebars
-   Overly complex navigation
-   Unnecessary animations
-   Gamification
-   AI-chat-style interfaces for ordinary functionality

Libellus should never look like a template generated from a generic SaaS
UI kit.

------------------------------------------------------------------------

## 22. Design Decision Test

When introducing a new UI element, ask:

1.  Does it improve the user's workflow?
2.  Does it fit the desktop-tool aesthetic?
3.  Is it necessary?
4.  Could the same information be communicated more simply?
5.  Does it introduce unnecessary visual noise?
6.  Does it preserve the workspace as the primary focus?
7.  Does it work well with keyboard interaction?

If an element fails these tests, reconsider it.

------------------------------------------------------------------------

## 23. Design Identity Summary

Libellus should ultimately feel like:

> **A small, precise, dark developer workstation where notes, snippets,
> secrets, and utilities live together in one persistent workspace.**

Its visual identity is:

``` text
Minimal
    +
Dark
    +
Monospace
    +
Desktop-tool
    +
Tab-based
    +
Keyboard-first
    +
Flat
    +
Quiet
```

The design should be recognizable because of its **restraint and
coherence**, not because of decorative branding.
