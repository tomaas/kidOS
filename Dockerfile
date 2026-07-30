# Build on node (not oven/bun): in oven/bun `node` is a bun shim, so vite/
# rolldown resolve with bun semantics — bun treats `ws` as a builtin, the
# bundle keeps a bare `import "ws"` and the node:22-slim runtime crashes with
# ERR_MODULE_NOT_FOUND. bun is only copied in for `bun install` + script runs.
FROM node:22-slim AS build
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
# VITE_* vars are compile-time (baked into the client bundle) → build args.
ARG VITE_CHILD_NAME
ARG VITE_APP_NAME
ARG VITE_APP_DESCRIPTION
ARG VITE_STORY_LABEL
# env.ts validates server secrets at import time; skip during build.
RUN SKIP_ENV_VALIDATION=1 bun run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3009
COPY --from=build /app/.output ./.output
# Migrations auto-apply at startup (src/server/db/index.ts) and are resolved
# from the CWD — ship the folder next to the server bundle.
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3009
CMD ["node", ".output/server/index.mjs"]
