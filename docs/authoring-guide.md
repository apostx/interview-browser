# Authoring guide — assembling interview-prep pages

This is a reference for building pages for **Interview Browser** from a library
of reusable *concepts*. Hand it to an AI (or a person) that needs to assemble a
targeted study page, or to add new job-specific material.

Live app: https://interviewbrowser.sallai.cc/ · Repo: https://github.com/apostx/interview-browser

---

## 1. The model

Every page is a list of **concepts**. A concept is one self-contained,
**bilingual** (English + Hungarian) block: a definition, the interview questions
+ model answers, and a "watch out". Pages are just *selections* of concepts.

Concepts live in **collections**. `general` holds the general full-stack
concepts; job-specific material goes into its own collection so it stays
separate but is still selectable. A concept's id is:

    <collection>/<topic>/<n>          e.g.  general/api/1

## 2. Assemble a page (a "spec")

A page is described by a small JSON **spec**:

```json
{
  "title": "Backend / API focus",
  "eyebrow": "Role-targeted set",
  "lede": "A cross-topic selection for a senior backend interview…",
  "pageSize": 6,
  "concepts": [
    "general/api/1",
    "general/api/2",
    "@general/authentication",
    "custom-acme/backend/3"
  ]
}
```

- **`concepts`** — the ordered list. Each entry is one concept id, or a
  shorthand: `"@<collection>/<topic>"` pulls a whole topic in order,
  `"@<collection>"` pulls an entire collection. Concepts are renumbered 1..N on
  the page and an index is generated automatically. **Mix collections freely.**
- **`title` / `eyebrow` / `lede`** — page header text. May contain bilingual
  markup: `<span lang="en">…</span><span lang="hu">…</span>`.
- **`hero`** *(optional)* — `"@<collection>/<topic>"` reuses that topic's
  original hero instead of building one from title/eyebrow/lede.
- **`pageSize`** *(optional, default 6)* — concepts shown per page; the reader
  can change it in-app. `0` = one long page.

Build it with the pipeline in the repo (`authoring/`):

```sh
# put the spec in authoring/pages/<name>.json, then:
node authoring/build.js        # -> content/@assembled/<name>.html (a material in the app)
```

## 3. Add new (job-specific) concepts

Create `authoring/collections/<collection>/<topic>.json`. Same shape as the
general ones; its concepts become selectable as `<collection>/<topic>/<n>`:

```json
{
  "collection": "custom-acme",
  "topic": "backend",
  "hero": "",
  "concepts": [
    { "n": 1, "title": "…", "titleHtml": "…", "bodyHtml": "…" }
  ]
}
```

Per concept:
- **`title`** — plain-text English title (for reference/ids).
- **`titleHtml`** — the heading, bilingual, e.g.
  `HTTP <span lang="en">Methods</span><span lang="hu">metódusok</span>`.
- **`bodyHtml`** — the concept body as HTML. Use these building blocks, and
  wrap every piece of prose in a `<span lang="en">…</span><span lang="hu">…</span>`
  pair so it works in both languages:
  - `<p class="def">…</p>` — one-line definition (bold the key sentence).
  - `<div class="qa"> <p class="q">question</p> <ul class="a"><li>point</li>…</ul> … </div>` — Q&A.
  - `<p class="watch"><span class="watch__tag"><span lang="en">Watch out</span><span lang="hu">Buktató</span></span> …</p>` — the trap.
  - Optional: `<table class="t">…</table>`, or an SVG diagram in `<div class="dia">…</div>`.
  - Inline: `<code>…</code>`, `<strong>…</strong>`, `<em>…</em>`.

### A real concept, verbatim (general/api/1)

```json
{
  "n": 1,
  "title": "Endpoint",
  "titleHtml": "Endpoint",
  "bodyHtml": "<p class=\"def\"><span lang=\"en\"><strong>An endpoint is a specific URL that exposes a resource or collection a client can act on</strong> — base URL + a resource path (e.g. <code>https://api.shop.com/orders/42</code>).</span><span lang=\"hu\"><strong>Az endpoint egy konkrét URL, ami egy resource-t vagy collection-t tesz elérhetővé a kliens számára</strong> — base URL + resource path (pl. <code>https://api.shop.com/orders/42</code>).</span></p>\n    <div class=\"qa\">\n      <p class=\"q\"><span lang=\"en\">How does REST resource design differ from RPC-style endpoints?</span><span lang=\"hu\">Miben tér el a REST resource-design az RPC-stílusú endpointoktól?</span></p>\n      <ul class=\"a\">\n        <li><span lang=\"en\">REST models <em>nouns</em>: <code>/orders/42</code>, and the HTTP method carries the verb.</span><span lang=\"hu\">A REST <em>főneveket</em> modellez: <code>/orders/42</code>, az igét pedig a HTTP metódus hordozza.</span></li>\n        <li><span lang=\"en\">RPC bakes the action into the path: <code>/getOrder?id=42</code>, <code>/cancelOrder</code>.</span><span lang=\"hu\">Az RPC a műveletet a path-ba égeti: <code>/getOrder?id=42</code>, <code>/cancelOrder</code>.</span></li>\n      </ul>\n      <p class=\"q\"><span lang=\"en\">How should endpoints be named?</span><span lang=\"hu\">Hogyan érdemes elnevezni az endpointokat?</span></p>\n      <ul class=\"a\">\n        <li><span lang=\"en\">Plural nouns for collections (<code>/orders</code>), path params for identity (<code>/orders/42</code>).</span><span lang=\"hu\">Többes számú főnév a collection-ökhöz (<code>/orders</code>), path param az azonosításhoz (<code>/orders/42</code>).</span></li>\n        <li><span lang=\"en\">No verbs in the path; filtering / sorting go in the query string (<code>/orders?status=paid&amp;sort=-created</code>).</span><span lang=\"hu\">Ige ne legyen a path-ban; a szűrés és a rendezés a query stringbe megy (<code>/orders?status=paid&amp;sort=-created</code>).</span></li>\n        <li><span lang=\"en\">Nest to show relationships (<code>/users/7/orders</code>), but avoid going much deeper than two levels.</span><span lang=\"hu\">A kapcsolatokat nesteléssel jelezd (<code>/users/7/orders</code>), de két szintnél sokkal mélyebbre ne menj.</span></li>\n      </ul>\n    </div>\n    <p class=\"watch\"><span class=\"watch__tag\"><span lang=\"en\">Watch out</span><span lang=\"hu\">Buktató</span></span><span lang=\"en\">The endpoint is the URL; the <em>operation</em> is endpoint + method. <code>GET /orders</code> and <code>POST /orders</code> are two different operations on one endpoint.</span><span lang=\"hu\">Az endpoint maga az URL; a <em>művelet</em> az endpoint + metódus. A <code>GET /orders</code> és a <code>POST /orders</code> két külön művelet ugyanazon az endpointon.</span></p>"
}
```

---

## 4. Catalog — every available concept

`general` · 197 concepts total. Reference concepts by their id.

### Collection: `general`

<details><summary><b>api</b> — 20 concepts</summary>

- `general/api/1` — Endpoint
- `general/api/2` — HTTP Methods
- `general/api/3` — Request–Response
- `general/api/4` — Status Codes
- `general/api/5` — Authentication
- `general/api/6` — Authorization
- `general/api/7` — Access Tokens
- `general/api/8` — OAuth 2.0
- `general/api/9` — Rate-Limiting
- `general/api/10` — Throttling
- `general/api/11` — Pagination
- `general/api/12` — Caching
- `general/api/13` — Idempotency
- `general/api/14` — Webhooks
- `general/api/15` — API Versioning
- `general/api/16` — OpenAPI
- `general/api/17` — REST vs GraphQL
- `general/api/18` — API Gateway
- `general/api/19` — Microservices
- `general/api/20` — Error Handling

</details>

<details><summary><b>architecture</b> — 14 concepts</summary>

- `general/architecture/1` — Coupling & Cohesion
- `general/architecture/2` — SOLID Principles
- `general/architecture/3` — Layered Architecture
- `general/architecture/4` — Dependency Injection
- `general/architecture/5` — Hexagonal & Clean Architecture
- `general/architecture/6` — Monolith vs Microservices
- `general/architecture/7` — Domain-Driven Design
- `general/architecture/8` — Strangler Fig Migration
- `general/architecture/9` — Dual Writes & Data Backfill
- `general/architecture/10` — Zero-Downtime Schema Migration
- `general/architecture/11` — Contract Evolution & Consumer Tests
- `general/architecture/12` — Rollout, Flags & Rollback
- `general/architecture/13` — Design Patterns
- `general/architecture/14` — Trade-offs & Communicating Design

</details>

<details><summary><b>authentication</b> — 10 concepts</summary>

- `general/authentication/1` — Authentication vs Authorization
- `general/authentication/2` — Password Storage
- `general/authentication/3` — Sessions vs Tokens
- `general/authentication/4` — Cookie Security
- `general/authentication/5` — JSON Web Tokens (JWT)
- `general/authentication/6` — Access & Refresh Tokens
- `general/authentication/7` — OAuth 2.0
- `general/authentication/8` — OpenID Connect (OIDC)
- `general/authentication/9` — Multi-Factor Authentication
- `general/authentication/10` — Session Lifecycle & Account Security

</details>

<details><summary><b>css_layout</b> — 9 concepts</summary>

- `general/css_layout/1` — Box Model & Sizing
- `general/css_layout/2` — Specificity & the Cascade
- `general/css_layout/3` — Flexbox
- `general/css_layout/4` — CSS Grid
- `general/css_layout/5` — Positioning
- `general/css_layout/6` — Stacking Context & z-index
- `general/css_layout/7` — Responsive Design
- `general/css_layout/8` — CSS Performance
- `general/css_layout/9` — Semantic HTML & Accessibility

</details>

<details><summary><b>data_structures_&_coding</b> — 16 concepts</summary>

- `general/data_structures_&_coding/1` — Big-O & Complexity Analysis
- `general/data_structures_&_coding/2` — Arrays & Strings
- `general/data_structures_&_coding/3` — Hash Maps & Sets
- `general/data_structures_&_coding/4` — Stacks & Queues
- `general/data_structures_&_coding/5` — Linked Lists
- `general/data_structures_&_coding/6` — Trees & Binary Search Trees
- `general/data_structures_&_coding/7` — Heaps & Priority Queues
- `general/data_structures_&_coding/8` — Graphs
- `general/data_structures_&_coding/9` — Two Pointers
- `general/data_structures_&_coding/10` — Sliding Window
- `general/data_structures_&_coding/11` — Binary Search
- `general/data_structures_&_coding/12` — Sorting
- `general/data_structures_&_coding/13` — Recursion & Backtracking
- `general/data_structures_&_coding/14` — Dynamic Programming
- `general/data_structures_&_coding/15` — Greedy Algorithms
- `general/data_structures_&_coding/16` — Interview Strategy

</details>

<details><summary><b>devops_&_cloud</b> — 10 concepts</summary>

- `general/devops_&_cloud/1` — Containers & Docker
- `general/devops_&_cloud/2` — Orchestration & Kubernetes
- `general/devops_&_cloud/3` — CI/CD Pipelines
- `general/devops_&_cloud/4` — Deployment Strategies
- `general/devops_&_cloud/5` — Infrastructure as Code
- `general/devops_&_cloud/6` — Cloud Service Models
- `general/devops_&_cloud/7` — Scaling & Load Balancing
- `general/devops_&_cloud/8` — Monitoring & Observability
- `general/devops_&_cloud/9` — Incidents & Postmortems
- `general/devops_&_cloud/10` — Pipeline & Runtime Security

</details>

<details><summary><b>distributed_systems</b> — 21 concepts</summary>

- `general/distributed_systems/1` — CAP Theorem
- `general/distributed_systems/2` — PACELC
- `general/distributed_systems/3` — Consistency Models
- `general/distributed_systems/4` — Replication
- `general/distributed_systems/5` — Partitioning / Sharding
- `general/distributed_systems/6` — Consistent Hashing
- `general/distributed_systems/7` — Quorums (R + W &gt; N)
- `general/distributed_systems/8` — Consensus & Raft
- `general/distributed_systems/9` — Leader Election
- `general/distributed_systems/10` — Clocks & Ordering
- `general/distributed_systems/11` — Idempotency & Exactly-Once
- `general/distributed_systems/12` — Retries, Backoff & Jitter
- `general/distributed_systems/13` — Circuit Breaker
- `general/distributed_systems/14` — Timeouts & Bulkheads
- `general/distributed_systems/15` — Distributed Transactions & Saga
- `general/distributed_systems/16` — Two-Phase Commit
- `general/distributed_systems/17` — Outbox Pattern
- `general/distributed_systems/18` — Message Queues & Pub/Sub
- `general/distributed_systems/19` — Delivery Semantics
- `general/distributed_systems/20` — Event Sourcing & CQRS
- `general/distributed_systems/21` — Failure Detection & Heartbeats

</details>

<details><summary><b>nodejs_&_backend_topics</b> — 26 concepts</summary>

- `general/nodejs_&_backend_topics/1` — Event Loop (Node)
- `general/nodejs_&_backend_topics/2` — libuv & Thread Pool
- `general/nodejs_&_backend_topics/3` — nextTick / setImmediate / setTimeout
- `general/nodejs_&_backend_topics/4` — Blocking the Event Loop
- `general/nodejs_&_backend_topics/5` — Workers, Cluster & Child Process
- `general/nodejs_&_backend_topics/6` — CommonJS vs ES Modules
- `general/nodejs_&_backend_topics/7` — Streams & Backpressure
- `general/nodejs_&_backend_topics/8` — EventEmitter
- `general/nodejs_&_backend_topics/9` — Callbacks → Promises → async/await
- `general/nodejs_&_backend_topics/10` — Async Error Handling
- `general/nodejs_&_backend_topics/11` — Concurrency Control
- `general/nodejs_&_backend_topics/12` — SQL vs NoSQL
- `general/nodejs_&_backend_topics/13` — Database Indexing
- `general/nodejs_&_backend_topics/14` — Transactions & ACID
- `general/nodejs_&_backend_topics/15` — N+1 Query Problem
- `general/nodejs_&_backend_topics/16` — Query Plans & EXPLAIN
- `general/nodejs_&_backend_topics/17` — JOINs, Aggregation & CTEs
- `general/nodejs_&_backend_topics/18` — Locking & Deadlocks
- `general/nodejs_&_backend_topics/19` — PostgreSQL vs Oracle
- `general/nodejs_&_backend_topics/20` — Connection Pooling
- `general/nodejs_&_backend_topics/21` — Caching Strategies
- `general/nodejs_&_backend_topics/22` — WebSockets vs SSE
- `general/nodejs_&_backend_topics/23` — gRPC
- `general/nodejs_&_backend_topics/24` — Graceful Shutdown
- `general/nodejs_&_backend_topics/25` — Logging & Observability
- `general/nodejs_&_backend_topics/26` — Env Config & 12-Factor

</details>

<details><summary><b>react_&_frontend_topics</b> — 23 concepts</summary>

- `general/react_&_frontend_topics/1` — Virtual DOM & Reconciliation
- `general/react_&_frontend_topics/2` — Keys in Lists
- `general/react_&_frontend_topics/3` — Rules of Hooks
- `general/react_&_frontend_topics/4` — State & Batching
- `general/react_&_frontend_topics/5` — useEffect & Dependencies
- `general/react_&_frontend_topics/6` — Stale Closures
- `general/react_&_frontend_topics/7` — Memoization
- `general/react_&_frontend_topics/8` — useRef
- `general/react_&_frontend_topics/9` — Context API
- `general/react_&_frontend_topics/10` — Custom Hooks
- `general/react_&_frontend_topics/11` — Controlled vs Uncontrolled
- `general/react_&_frontend_topics/12` — Client vs Server State
- `general/react_&_frontend_topics/13` — Data Fetching Patterns
- `general/react_&_frontend_topics/14` — Suspense & Error Boundaries
- `general/react_&_frontend_topics/15` — Code Splitting & Lazy Loading
- `general/react_&_frontend_topics/16` — List Virtualization
- `general/react_&_frontend_topics/17` — Re-render Optimization
- `general/react_&_frontend_topics/18` — Rendering Strategies
- `general/react_&_frontend_topics/19` — Core Web Vitals
- `general/react_&_frontend_topics/20` — Browser Event Loop
- `general/react_&_frontend_topics/21` — Reflow & Repaint
- `general/react_&_frontend_topics/22` — CORS
- `general/react_&_frontend_topics/23` — TypeScript + React

</details>

<details><summary><b>realtime_messaging</b> — 10 concepts</summary>

- `general/realtime_messaging/1` — WebSocket Handshake & Lifecycle
- `general/realtime_messaging/2` — Scaling WebSockets
- `general/realtime_messaging/3` — Presence, Rooms & Slow Consumers
- `general/realtime_messaging/4` — Acks, Nacks & Visibility Timeout
- `general/realtime_messaging/5` — Dead-Letter Queues & Poison Messages
- `general/realtime_messaging/6` — Consumer Groups & Partitions
- `general/realtime_messaging/7` — Message Ordering
- `general/realtime_messaging/8` — Backpressure & Backlog
- `general/realtime_messaging/9` — Broker Comparison
- `general/realtime_messaging/10` — Designing a Realtime Feature

</details>

<details><summary><b>system_design</b> — 8 concepts</summary>

- `general/system_design/1` — The Shape of the Hour
- `general/system_design/2` — Clarifying Requirements
- `general/system_design/3` — Estimation That Earns Its Time
- `general/system_design/4` — High-Level Design
- `general/system_design/5` — Deep Dive & Bottlenecks
- `general/system_design/6` — Failure Scenarios
- `general/system_design/7` — Common Failure Modes
- `general/system_design/8` — Practice Prompts

</details>

<details><summary><b>testing</b> — 8 concepts</summary>

- `general/testing/1` — The Test Pyramid
- `general/testing/2` — Unit Testing
- `general/testing/3` — Test Doubles: Mocks, Stubs & Fakes
- `general/testing/4` — Integration Testing
- `general/testing/5` — End-to-End Testing
- `general/testing/6` — Testing React Components
- `general/testing/7` — Test-Driven Development
- `general/testing/8` — CI & Quality Gates

</details>

<details><summary><b>typescript</b> — 12 concepts</summary>

- `general/typescript/1` — Structural Typing
- `general/typescript/2` — type vs interface
- `general/typescript/3` — Union & Intersection Types
- `general/typescript/4` — Narrowing & Type Guards
- `general/typescript/5` — unknown vs any vs never
- `general/typescript/6` — Generics & Constraints
- `general/typescript/7` — Utility Types
- `general/typescript/8` — Mapped & Conditional Types
- `general/typescript/9` — Runtime vs Compile-time
- `general/typescript/10` — Strictness & tsconfig
- `general/typescript/11` — Typing Node & Express
- `general/typescript/12` — Typing React

</details>

<details><summary><b>web-security</b> — 10 concepts</summary>

- `general/web-security/1` — SQL & NoSQL Injection
- `general/web-security/2` — Cross-Site Scripting (XSS)
- `general/web-security/3` — Cross-Site Request Forgery (CSRF)
- `general/web-security/4` — CORS & Same-Origin Policy
- `general/web-security/5` — Security Headers & CSP
- `general/web-security/6` — Broken Access Control & IDOR
- `general/web-security/7` — Server-Side Request Forgery (SSRF)
- `general/web-security/8` — Dependency & Supply-Chain Security
- `general/web-security/9` — Secrets Management
- `general/web-security/10` — Error Handling, Logging & DoS

</details>

