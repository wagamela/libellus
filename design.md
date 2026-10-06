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

Prefer solid backgrounds, soft rounded geometry, typography, spacing, and
simple state indicators.

Avoid heavy shadows, glassmorphism, large gradients, excessive blur,
decorative backgrounds, floating cards everywhere, and excessive depth
effects.

Flat is about **depth**, not about shape. Surfaces stay unlit and
un-outlined, but their corners are generously rounded: softness costs
nothing in density and makes a block legible against a surface almost the
same colour as it. See §10.

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

### The menu at the pointer

A right-click is answered by the application, never by the webview's own
menu: that menu belongs to a web page, and libellus is a desktop tool. The
one exception is a text field, where the platform knows things the app does
not — spelling, input methods, the clipboard it will not hand a page
unprompted — and keeps its own menu.

The context menu is the *same surface* the menu bar drops: one panel, one
set of item states, placed against the cursor instead of under a title. It
is short and local — what can be done to the thing under the pointer, not a
second copy of the menu bar — and its items are built from the same
callbacks the menus and the command palette are built from, so a command
never behaves one way in a menu and another at the pointer.

Placement is measured rather than guessed: the panel opens down and to the
right, flips to the other side when that is where the room is, and sits
against the window edge only as a last resort. It is keyboard-navigable
(arrows, `Home`/`End`, `Enter`, `Escape`) because every other way through
the app is, and an irreversible item arms on the first press and runs on
the second.

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
-   Tabs are rounded blocks (`--radius-lg`) inset from every edge of the
    strip and held apart by a small gap, so the strip reads as the surface
    they sit on rather than a row they are cut out of.
-   Avoid excessive icons.
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
Application chrome   #161B23
Tab surface          #12161D
Workspace            #1C222B
Primary text         #FFFFFF
Secondary text       #8B97A8
Muted text           #5D6878
Content surface      #232A34
Raised surface       #2B333F
```

These values are starting points, not immutable requirements.

### Accent color

Use one restrained accent color for active tab, focus, selection,
important interactive states, and links when necessary. Do not use the
accent as decoration. Avoid rainbow interfaces and excessive semantic
colors.

The interface is achromatic by decision: the surfaces are dark blue-greys,
the content is white, and the accent is a near-white `#DBE4F0` rather than a
hue. Emphasis — the active tab, the caret, focus rings, the unsaved dot —
comes from brightness, not colour, and states such as errors are brighter
rather than red. Do not reintroduce a coloured accent or semantic hues.

Code is the one exception. Syntax tokens inside code — a snippet document, and
the inside of a fenced block in a note — carry real hues, because with every
token in one hue the steps between a keyword, a name, a string and a number are
not perceptible as different, which is the whole job of highlighting them. The
palette is few and desaturated (violet keywords, green strings, amber numbers,
cyan types, blue callables; names and punctuation stay grey) and lives in
`TOKEN_STYLES` in `src/lib/editor.ts`. It stops at the edge of the code: prose
tokens, chrome, tabs, menus, the status bar and error affordances stay
achromatic, and these hues must never become interface accents.

------------------------------------------------------------------------

## 9. Borders and Separators

Libellus uses **no separator lines**. There are no borders between the menu
bar, tab strip, document header, editor and status bar, none around menus,
panels, inputs or the command palette, and no rules inside menus.

Structure is carried entirely by small differences between the dark blue-grey
surfaces, which is why they form a close but distinguishable ramp: tab strip
darkest, then chrome, then the workspace the content sits on, then raised
surfaces for fields and selections. Menu groups are separated by spacing, the
active tab by sharing the editor's surface, and a selected row by a slightly
lighter background.

The overall look should stay very plain: flat blocks of near-identical colour,
no outlines, no decorative depth. What a border would have done is done by the
corner radius instead — a rounded edge is enough to read a block as a block,
with no line drawn anywhere. Shadows are used only to lift a floating layer (a
menu, the command palette) off the surface beneath it. Focus rings and the text
caret are not separators and remain; a focus ring follows the radius of what it
surrounds.

------------------------------------------------------------------------

## 10. Shapes and Corners

Libellus uses **soft, generously rounded geometry**. Corners are the one
piece of shape the interface allows itself: with no borders and surfaces only
a few steps apart in brightness, the radius is what gives a tab, a snippet, a
menu or a selected row a readable edge.

The scale lives in `@theme` in `src/styles.css` and grows with the thing it
rounds, so a control is always rounded less than the surface holding it:

``` text
--radius-xs   4px   micro affordances inside text — a search match
--radius-sm   6px   small inline controls — snippet title field, copy, delete
--radius-md   8px   blocks and rows — code blocks, images, menu and list items
--radius-lg  12px   chrome blocks — tabs, the new-tab button, menu titles
--radius-xl  16px   floating layers — menus, the context menu, the palette
```

Rules:

-   Use the tokens (`rounded-sm` … `rounded-xl`); never a one-off pixel
    radius in a component.
-   A child is rounded one step below its parent, and is inset far enough
    that its corners never fight the parent's. Floating layers carry
    `p-1.5` for exactly this reason.
-   Where a control *is* the edge of a panel rather than something sitting on
    it — the command palette's query field — it takes the panel's corners via
    `overflow-hidden` instead of a radius of its own.
-   Softness is not roominess: radii went up, padding did not. Density (§16)
    is unchanged.

Still avoided: full pill shapes on anything that is not a dot, bubble-like
or card-like containers, and rounding used as decoration rather than as the
edge of a real surface.

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

Emphasis (bold, italic, underline) is written into the document as markdown
rather than stored as formatting. The markers themselves are not drawn: bold
text simply reads as bold, and the characters that say so come back — dimmed,
the standing a code fence has — as soon as the selection touches the span. A
note is still its text, and nothing is hidden that the caret can reach without
seeing it.

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
Soft-cornered
    +
Quiet
```

The design should be recognizable because of its **restraint and
coherence**, not because of decorative branding.
