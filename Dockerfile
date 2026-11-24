FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node server.mjs railkit.mjs assistant.mjs storage.mjs commerce.mjs payments.mjs http-utils.mjs rail-mcp.mjs mcp-stdio.mjs ./
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
