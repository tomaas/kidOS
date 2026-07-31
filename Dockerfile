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
# LEGACY-OPTIONNEL (env→DB, v0.6) : la marque se règle désormais à
# /parents/reglages (table app_settings) ; ces args ne servent plus que de
# SECOURS pour un déploiement existant qui n'a rien posé en base. Gardés une
# release, suppression envisagée ensuite (TODOS.md).
ARG VITE_CHILD_NAME
ARG VITE_APP_NAME
ARG VITE_APP_DESCRIPTION
ARG VITE_STORY_LABEL
# env.ts validates server secrets at import time; skip during build.
RUN SKIP_ENV_VALIDATION=1 bun run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3009
# Secours legacy runtime (mêmes valeurs que les build args) : le serveur lit
# process.env.VITE_* quand aucune ligne branding:* n'existe en base.
ARG VITE_CHILD_NAME
ARG VITE_APP_NAME
ARG VITE_APP_DESCRIPTION
ARG VITE_STORY_LABEL
ENV VITE_CHILD_NAME=$VITE_CHILD_NAME \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION \
    VITE_STORY_LABEL=$VITE_STORY_LABEL
COPY --from=build /app/.output ./.output
# Migrations auto-apply at startup (src/server/db/index.ts) and are resolved
# from the CWD — ship the folder next to the server bundle.
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3009
CMD ["node", ".output/server/index.mjs"]
