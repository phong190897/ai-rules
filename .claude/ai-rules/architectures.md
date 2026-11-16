<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Architecture catalog

Last reviewed: 2026-11-16

A starting point, not a limit: propose a style from outside this list when none here fits, and say that it is outside. A project often combines two entries (for example a modular monolith whose modules are layered inside).

### Modular monolith
- What it is: one deployable application split into modules by business area, each with a small public surface.
- Fits when: one team or a few people; one deployment is acceptable; business areas are known but may still move.
- Does not fit when: parts must scale, deploy or fail independently, or separate teams need separate release schedules.
- Typical modules and rule: `src/<area>/` per business area plus `shared/`; a module is used only through its public entry file.

### N-Layer
- What it is: code split by technical role, usually presentation, business logic and data access.
- Fits when: a small or CRUD-heavy application with simple rules; the team already knows the pattern.
- Does not fit when: business rules are rich and change often, because one feature ends up spread across every layer.
- Typical modules and rule: `api/`, `services/`, `repositories/`; a layer calls only layers below it, usually the one directly below.

### Clean / Hexagonal
- What it is: business rules at the centre with no knowledge of frameworks, databases or transport; adapters plug in around them.
- Fits when: long-lived products with complex rules; infrastructure is likely to change; rules must be tested without a database.
- Does not fit when: a short-lived or simple CRUD project, where the extra interfaces cost more than they return.
- Typical modules and rule: `domain/`, `application/`, `infrastructure/`, `interfaces/`; dependencies point inward, and `domain` imports nothing from the outer rings.

### Vertical slice
- What it is: code organized by feature, each slice holding its own handler, logic and data access.
- Fits when: features are largely independent; the team wants a change to touch one folder; request and response style applications.
- Does not fit when: much logic is shared between features, which pushes code into a growing shared area.
- Typical modules and rule: `features/<feature>/`; a slice does not import another slice, and shared code lives in one small common folder.

### Microservices
- What it is: independently deployed services, each owning its data and talking over the network.
- Fits when: several teams need independent releases; parts have very different load or reliability needs; operations skills and tooling exist.
- Does not fit when: one small team, an unsettled domain, or no capacity to run deployment, monitoring and distributed debugging.
- Typical modules and rule: one folder or repository per service; a service never reads another service's database, only its API or events.

### Microfrontend
- What it is: a web interface assembled from separately built and deployed parts owned by different teams.
- Fits when: several teams ship parts of one large interface on separate schedules; parts can be isolated by route or region of the page.
- Does not fit when: one team owns the whole interface, or a consistent look and small bundle size matter more than independent releases.
- Typical modules and rule: `apps/<area>/` plus a shell and a shared design system; an app does not import another app, only shared packages.

### Event-driven
- What it is: components that communicate by publishing and reacting to events instead of calling each other directly.
- Fits when: work is naturally asynchronous; several consumers react to the same fact; producers must not wait for consumers.
- Does not fit when: flows need an immediate, consistent answer, or the team cannot yet trace and replay asynchronous flows.
- Typical modules and rule: `producers/`, `consumers/`, `events/` for schemas; components share event contracts only, never each other's internals.

### Serverless
- What it is: functions run by a cloud platform on demand, with managed services for storage and messaging.
- Fits when: load is spiky or low; the team wants no servers to run; work fits short, stateless units.
- Does not fit when: long-running or stateful work, strict latency needs that cold starts would break, or a need to stay independent of one cloud.
- Typical modules and rule: `functions/<name>/` plus `lib/` for shared logic; a function does not call another function directly, only through a queue or an API.

## Boundary tools

Tools that turn the dependency rules into a check. Run the check together with lint.

| Stack | Tool | How it runs |
|---|---|---|
| JavaScript / TypeScript | `dependency-cruiser`, or `eslint-plugin-boundaries` when the repo already uses ESLint | command-line tool, or lint plugin |
| Python | `import-linter` | command-line tool |
| Java / Kotlin | ArchUnit | test library: rules run as unit tests |
| .NET | NetArchTest | test library: rules run as unit tests |
| Go | `depguard` (through `golangci-lint`) | lint plugin |

Any other stack has no listed tool yet: rely on the rule, and say so.
