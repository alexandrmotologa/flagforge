# FlagForge Architecture

FlagForge provides an in-process and daemon-backed feature flag engine built around the CNCF OpenFeature standard. It evaluates rules locally without remote network hops, calculates rollout distributions with MurmurHash3, and identifies dead flags through AST analysis.

```mermaid
flowchart TD
    ClientApp[Client Application] -->|OpenFeature Server SDK| FlagForgeProvider[FlagForgeProvider]
    FlagForgeProvider -->|Direct In-Process| Engine[FeatureFlagEngine]
    FlagForgeProvider -->|HTTP / OFREP Protocol| Daemon[FlagForge Daemon :4900]

    subgraph FlagForge Daemon
        Daemon --> Router[REST & OFREP Router]
        Router --> Engine
        Engine --> Murmur[MurmurHash3 Bucketing]
        Engine --> Matcher[Rule Condition Matcher]
        Engine --> YamlStorage[YAML Hot-Reload Storage]
        Engine --> SqliteStorage[SQLite Audit & Metrics]
        Daemon --> SSE[SSE Broadcast Stream]
    end

    subgraph Studio & Analysis
        Simulator[Blast-Radius Cohort Simulator] --> Engine
        Scanner[AST Dead Flag Scanner] --> AST[@babel/parser & traverse]
        Codemod[AST Codemod Engine] --> Generator[@babel/generator]
        UI[Rollout Studio React 19] --> Router
    end
```

## Core Components

### 1. OpenFeature Evaluation Engine (`src/core`)
The evaluation engine implements the OpenFeature specification across four data types: `boolean`, `string`, `number`, and `object`.

Evaluation sequence:
1. Flag existence check. If absent, returns default value with reason `ERROR` and error code `FLAG_NOT_FOUND`.
2. Killswitch check. If `enabled === false`, returns default value with reason `DISABLED`.
3. Targeting rules. Rules evaluate in order. Each rule contains conditions joined by logical AND. If a rule matches, returns target variant or value with reason `TARGETING_MATCH`.
4. Percentage rollout. Uses MurmurHash3 32-bit bucketing (`hash(flagKey + ":" + targetingKey + ":" + salt) % 10000 / 100`). Produces uniform values between 0.00% and 99.99%. If within percentage, serves treatment variant with reason `SPLIT`.
5. Fallback default. Serves defaultVariant with reason `DEFAULT`.

### 2. CNCF OpenFeature Remote Evaluation Protocol (`src/provider/ofrep.ts`)
The daemon exposes standard OFREP endpoints:
- `POST /ofrep/v1/evaluate/flags/:key`
- `POST /ofrep/v1/evaluate/flags`

This allows any language SDK implementing OFREP (Python, Go, Java, Rust) to evaluate flags against FlagForge without custom client libraries.

### 3. Blast-Radius Simulator (`src/simulator`)
The simulator evaluates candidate rollout percentages against synthetic cohorts (1,000 to 50,000 profiles) generated with weighted distributions across countries, subscription tiers, and device operating systems.

It computes:
- Blast radius percentage (`affected / total`)
- Segment breakdown matrices
- Chi-Square goodness-of-fit test across 10 deciles to verify hash distribution uniformity before production rollouts

### 4. AST Dead Flag Scanner and Codemod (`src/scanner`)
The scanner parses JavaScript and TypeScript source trees with `@babel/parser`. It locates call sites for `client.getBooleanValue`, `client.getStringValue`, and related SDK methods.

Flags rolled out at 100% or marked dead can be refactored via `ASTCodemodEngine`:
- Branch unrolling: transforms `if (flag) { A } else { B }` into `A` or `B`.
- Variable cleanup: removes dead variable declarations and unused imports.
- Generates unified diffs and writes backups (`.bak`) before applying modifications.
