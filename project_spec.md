# Libellus — Project Specification

## 1. Project Overview

**Libellus** is a lightweight, local-first desktop application built specifically for developers.

Its purpose is to combine several pieces of developer workflow that are commonly scattered across different applications into one fast, focused environment:

- Notes
- Code snippets
- Secrets and sensitive information
- Developer utilities
- Search and organization
- Project-specific information

Libellus is not intended to be a general-purpose productivity application or a generic note-taking application.

The core idea is:

> **Libellus turns a simple developer notebook into an actionable developer workspace.**

Instead of writing information in one application and then moving it to external tools to manipulate or use it, Libellus should allow developers to **store, transform, search, and work with their developer-related information in the same application.**

---

# 2. Problem

Developers regularly switch between many small tools during normal development.

A typical workflow might involve:

- A notes application for ideas
- A text editor for snippets
- A password manager for API keys
- A JSON formatter for API responses
- A Base64 encoder
- A UUID generator
- A JWT decoder
- A regex tester
- A browser for documentation
- A temporary text file for miscellaneous information

Each individual tool solves a small problem, but together they create unnecessary fragmentation.

Libellus aims to reduce this fragmentation by providing a single local workspace for common developer information and utilities.

The application should prioritize **speed, accessibility, privacy, and developer-focused functionality** rather than attempting to replace large applications such as IDEs, password managers, project-management platforms, or full productivity suites.

---

# 3. Core Goal

The primary goal of Libellus is to provide developers with a **fast, lightweight, local-first workspace for storing and working with developer information.**

A user should be able to open Libellus and quickly:

1. Write a note.
2. Save a code snippet.
3. Store sensitive information securely.
4. Organize information by project or category.
5. Search previously stored information.
6. Run common developer transformations and utilities.
7. Move information between notes and tools without unnecessary copying between applications.

The application should make these operations feel like parts of the same workflow rather than unrelated features.

---

# 4. Product Principles

## 4.1 Local-first

Libellus should work without requiring an account, remote server, or internet connection for its core functionality.

User data should primarily remain on the user's device.

The application should not depend on a backend service simply to:

- Open the application
- Create notes
- Edit notes
- Search local content
- Use developer tools
- Access locally stored snippets
- Access locally stored secrets

Future synchronization may be considered separately, but it must not be a requirement for the core product.

---

## 4.2 Fast

Libellus is intended to be a developer utility that can remain open throughout the development process.

Startup time, search performance, tool execution, and normal interactions should therefore be treated as important technical requirements.

Avoid unnecessary:

- Network requests
- Heavy dependencies
- Background services
- Large runtime requirements
- Expensive processing
- Repeated database operations

Operations that can be performed locally should generally be performed locally.

---

## 4.3 Lightweight

The application should use system resources responsibly.

Libellus should not require a large runtime or continuously consume significant CPU or memory while idle.

The technology stack and dependencies should be selected with this requirement in mind.

---

## 4.4 Privacy-focused

User data is potentially sensitive.

Libellus may contain:

- API keys
- Access tokens
- Passwords
- Database credentials
- Environment variables
- Private notes
- Internal URLs
- Development configuration

The application must therefore avoid treating sensitive information as ordinary unprotected text.

Sensitive data should have a dedicated storage and protection model.

---

## 4.5 Developer-focused

Features should solve real developer workflow problems.

A feature should not be added merely because it is technically possible.

The primary question for new functionality should be:

> **Does this meaningfully improve a developer's everyday workflow?**

---

## 4.6 Local functionality over unnecessary services

If a feature can be implemented locally, Libellus should prefer a local implementation over requiring a third-party API.

For example:

- JSON formatting should happen locally.
- UUID generation should happen locally.
- Base64 encoding/decoding should happen locally.
- Search should happen against the local database.
- Note editing should not require a server.

External services may be integrated when they provide clear value, but they should not become unnecessary dependencies.

---

# 5. Target Users

The primary target audience is developers and technically-oriented users who regularly work with code, configuration, APIs, credentials, and structured data.

Potential users include:

- Web developers
- Backend developers
- Frontend developers
- Full-stack developers
- Students learning software development
- DevOps engineers
- Software engineers
- Hobbyist programmers

Libellus should remain useful for both beginners and experienced developers without becoming a specialized enterprise platform.

---

# 6. Core Feature Areas

## 6.1 Notes

Users should be able to create and manage developer-oriented notes.

Notes may contain:

- Plain text
- Markdown
- Code blocks
- Links
- Lists
- Structured information

The note system should prioritize developer workflows rather than attempting to reproduce every feature found in general-purpose productivity software.

---

## 6.2 Code Snippets

Users should be able to store reusable pieces of code.

A snippet should support metadata such as:

- Name
- Description
- Programming language
- Tags
- Creation date
- Modification date

Examples:

```text
React hooks
Docker commands
Git commands
SQL queries
API examples
Regular expressions
Configuration snippets
```

Snippets should be searchable and easily copied.

---

## 6.3 Secrets

Libellus should provide a dedicated mechanism for storing sensitive developer information.

Examples include:

- API keys
- Access tokens
- Passwords
- Database credentials
- Environment variables
- Private configuration values

Secrets must not be stored as ordinary plaintext application data.

The architecture should use appropriate operating-system security facilities and encryption mechanisms where applicable.

The application should clearly separate normal notes/snippets from sensitive secret data.

---

## 6.4 Developer Tools

Libellus should contain a collection of small, frequently useful developer utilities.

### Data Format Utilities

#### JSON

- Format / prettify
- Minify
- Validate
- Sort keys
- Remove duplicates
- JSON → TypeScript
- JSON → YAML
- JSON → XML
- JSON → CSV
- Diff/compare JSON

#### YAML

- Format / prettify
- Minify
- Validate
- YAML → JSON
- YAML → XML
- YAML → CSV
- Merge YAML files

#### XML

- Format / prettify
- Minify
- Validate
- XML → JSON
- XML → YAML
- XML → CSV
- XPath query/selection
- Pretty-print with indentation

#### ENV

- Format / prettify
- Validate
- Parse and view as key-value pairs
- ENV → JSON
- Check for duplicates
- Export/convert to JSON
- Environment variable linter

#### CSV

- Format / prettify
- Validate
- CSV → JSON
- CSV → YAML
- CSV → XML
- Sort by column
- Filter/select columns
- Table preview/viewer
- Column analysis (data types, unique values)

### Encoding & Identifiers

- Base64 encode/decode
- URL encode/decode
- UUID generation
- Timestamp generation/conversion

### Web/API

- JWT inspection/decoding
- HTTP-related utilities where appropriate

### Text

- Regex testing
- Text transformation
- Character/line statistics

### Implementation Notes

The initial implementation should prioritize high-value tools rather than attempting to provide every utility. Format/validate operations and bidirectional conversions between common formats are core utilities. Tools should integrate seamlessly with the note and snippet systems, allowing developers to work with structured data without leaving Libellus.

---

# 7. Search

Search should be a fundamental part of Libellus.

Users should be able to quickly search across their locally stored:

- Notes
- Snippets
- Projects
- Metadata

Sensitive secrets should be handled carefully during indexing and searching so that plaintext secret values are not unnecessarily exposed through search indexes or logs.

The search system should be optimized for local usage and fast response.

SQLite full-text search may be used where appropriate.

---

# 8. Projects and Organization

Libellus should allow users to organize information around projects.

A project may contain:

```text
Project
├── Notes
├── Snippets
├── Secrets
└── Related information
```

For example:

```text
BuildDeck
├── API notes
├── React snippets
├── Environment variables
└── Deployment information
```

The organization system should remain lightweight.

It should not evolve into a complex project-management system.

---

# 9. Command System

Libellus should support a centralized command/search mechanism.

A command palette may eventually provide access to actions such as:

```text
Create note
Create snippet
Create secret
Search notes
Search snippets
Format JSON
Generate UUID
Encode Base64
Open project
```

The purpose is to make frequently used operations accessible without requiring the user to navigate through multiple screens.

Keyboard accessibility should be treated as an important part of the application's functionality.

---

# 10. Desktop Architecture

Libellus will be developed as a desktop application.

## Recommended stack

### Desktop Runtime

**Tauri 2**

Tauri provides the native desktop layer while allowing the application interface to be developed using web technologies.

### Frontend

- React
- TypeScript
- Vite

### Styling

- Tailwind CSS

### Local Database

**SQLite**

SQLite should be used for structured local application data such as:

- Notes
- Snippets
- Projects
- Metadata
- Tags
- Relationships

### State Management

A lightweight state-management solution such as **Zustand** may be used where React state alone is insufficient.

### Editor

A capable code/text editor such as:

- CodeMirror 6
- Monaco Editor

The final choice should depend on bundle size, performance, functionality, and integration complexity.

### Search

SQLite FTS5 or another lightweight local search solution should be considered for full-text search.

### Native functionality

Rust/Tauri should primarily be responsible for functionality requiring native operating-system access, such as:

- Filesystem operations
- Secure credential/keychain access
- Native dialogs
- System integration
- Application lifecycle
- Other security-sensitive functionality

The frontend should remain responsible for normal application logic and user interaction wherever practical.

---

# 11. Data Architecture

A simplified conceptual data model:

```text
User
 │
 └── Local Application
       │
       ├── Projects
       │     ├── Notes
       │     ├── Snippets
       │     └── Secrets
       │
       ├── Notes
       │
       ├── Snippets
       │
       └── Secrets
```

The exact database schema should be designed during implementation.

The schema should support:

- Stable identifiers
- Creation timestamps
- Modification timestamps
- Relationships between projects and content
- Tags
- Search
- Future migrations

Database migrations must be versioned and reproducible.

---

# 12. Security Requirements

Security is a core requirement because Libellus can contain sensitive information.

## 12.1 Secret storage

Secrets must never be stored as ordinary plaintext database fields.

The implementation should investigate and use appropriate platform-native secure storage mechanisms.

Where encryption is required, cryptographic operations should use established, well-reviewed libraries rather than custom cryptographic implementations.

---

## 12.2 No custom cryptography

Libellus must not implement its own cryptographic algorithms.

Use established cryptographic primitives and libraries.

Do not invent custom encryption formats or security protocols.

---

## 12.3 Logging

Sensitive values must never be written to:

- Application logs
- Debug logs
- Error messages
- Analytics
- Crash reports
- Console output

This includes API keys, passwords, access tokens, and decrypted secret values.

---

## 12.4 Clipboard

Copying a secret to the clipboard should be treated as a sensitive operation.

Where practical, Libellus should provide mechanisms such as:

- Automatic clipboard clearing after a configurable period
- Explicit warnings for sensitive clipboard operations
- Avoiding unnecessary clipboard persistence

---

## 12.5 Backups and exports

Export functionality involving secrets must be explicitly designed.

The application must not accidentally export sensitive information as plaintext through normal backup/export operations.

---

# 13. Offline Requirements

Core Libellus functionality must work without an internet connection.

Offline functionality should include:

- Creating notes
- Editing notes
- Reading notes
- Creating snippets
- Reading snippets
- Searching
- Managing projects
- Using local developer tools
- Managing locally stored secrets

Internet connectivity should only be required for explicitly network-dependent features that may be added later.

---

# 14. Performance Requirements

Performance should be considered throughout development.

Important targets include:

- Fast application startup
- Fast navigation
- Immediate local search
- Low idle CPU usage
- Reasonable memory usage
- No unnecessary background network activity
- No unnecessary re-rendering
- Efficient database queries

Large collections of notes and snippets should remain usable without significant degradation.

Developer utilities should execute locally whenever possible.

---

# 15. Reliability

Libellus is intended to store potentially important developer information.

The application should therefore prioritize data integrity.

Requirements include:

- Safe database writes
- Transactional operations where appropriate
- Database migrations
- Graceful error handling
- Recovery from interrupted operations
- Avoiding destructive operations without confirmation
- Clear handling of corrupted or inaccessible local data

The application must not silently discard user data.

---

# 16. Privacy

Libellus should follow a privacy-by-default approach.

The initial application should not require:

- User accounts
- User tracking
- Advertising
- Remote analytics
- Cloud storage

No user content should be transmitted to external services unless the user explicitly initiates a feature that requires such transmission.

If telemetry is ever introduced, it should be opt-in and documented.

---

# 17. Networking

Networking should not be required for core functionality.

When network functionality is introduced, it must be explicit and justified.

Potential future integrations could include:

- GitHub
- GitLab
- Cloud synchronization
- Documentation services
- API services

Such integrations should be optional rather than architectural requirements.

---

# 18. Extensibility

The architecture should allow new developer tools to be added without requiring major changes to unrelated parts of the application.

Tools should ideally follow a consistent internal model.

Conceptually:

```text
Tool
├── Metadata
├── Input
├── Processing
└── Output
```

A new utility such as a YAML formatter should be able to be introduced without modifying the core note, snippet, or secret systems.

---

# 19. Scope Control

Libellus should remain focused.

The following should **not** become primary goals:

- Full IDE functionality
- Full project management
- Team collaboration
- Enterprise administration
- Social networking
- General-purpose document editing
- Replacing Git
- Replacing a full password manager
- Replacing an operating-system terminal
- Becoming an all-in-one productivity suite

Features should be evaluated according to whether they strengthen the central concept of a **developer workspace**.

---

# 20. MVP

The initial MVP should focus on the smallest version that demonstrates the complete Libellus concept.

### Required

- Desktop application using Tauri
- React + TypeScript frontend
- Local SQLite database
- Notes
- Markdown/code editing
- Code snippets
- Secure secrets
- Basic project organization
- Global local search
- A small set of developer tools
- Command palette
- Offline operation

### Initial developer tools

Prioritize:

1. JSON formatter/validator
2. JSON minifier
3. Base64 encoder/decoder
4. UUID generator
5. Timestamp converter
6. JWT decoder/inspector
7. URL encoder/decoder

Additional tools should be added based on actual usefulness rather than quantity.

---

# 21. Future Possibilities

These features are intentionally outside the initial MVP but may be considered later:

- Optional cloud synchronization
- GitHub integration
- GitLab integration
- Project filesystem integration
- Import/export
- Backup management
- Plugin/tool system
- Cross-device synchronization
- Additional developer utilities
- Encrypted backup files
- Native system integrations

Future functionality must preserve the project's local-first and lightweight principles.

---

# 22. Technical Constraints

The project should follow these constraints:

1. **Local-first architecture**
2. **No mandatory backend**
3. **No mandatory account**
4. **No mandatory internet connection**
5. **Sensitive data must receive appropriate protection**
6. **No custom cryptography**
7. **Avoid unnecessary dependencies**
8. **Avoid unnecessary background processes**
9. **Prefer local computation**
10. **Keep the application lightweight**
11. **Maintain clear separation between frontend and native functionality**
12. **Do not sacrifice security for implementation convenience**
13. **Do not sacrifice data integrity for performance**
14. **Avoid feature bloat**
15. **Keep the architecture extensible**

---

# 23. Development Philosophy

Libellus should be developed incrementally.

Each feature should be:

1. Clearly defined.
2. Implemented independently where practical.
3. Tested locally.
4. Evaluated for performance.
5. Evaluated for security when handling user data.
6. Integrated without unnecessarily increasing architectural complexity.

Prefer simple, maintainable solutions over unnecessarily sophisticated architectures.

The application is intended to be maintainable by a small development team or a solo developer.

---

# 24. Definition of Success

Libellus succeeds if a developer can use it as their **quick-access personal developer workspace** without constantly switching to separate applications for common tasks.

A successful workflow should look like:

```text
Think
  ↓
Write a note
  ↓
Store useful code
  ↓
Save sensitive configuration securely
  ↓
Transform or inspect developer data
  ↓
Search it later
  ↓
Reuse it in another project
```

The application should make this workflow faster and more coherent than using a collection of unrelated tools.

The central product principle is:

> **Libellus should not merely store developer information. It should help developers work with it.**
