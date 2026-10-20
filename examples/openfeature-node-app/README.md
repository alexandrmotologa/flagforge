# OpenFeature Node.js Example

This example demonstrates how to evaluate feature flags in Node.js using the official `@openfeature/server-sdk` and the FlagForge provider.

## How it works

1. FlagForge runs as a local daemon at `http://localhost:4900`.
2. The Node.js application sets `FlagForgeProvider` as the OpenFeature provider.
3. Feature evaluations happen with zero cloud latency using the CNCF OFREP standard or in-process engine.

## Running the example

Start the FlagForge daemon in one terminal:
```bash
npm run dev
```

In another terminal, run the sample script:
```bash
cd examples/openfeature-node-app
npx tsx app.ts
```
