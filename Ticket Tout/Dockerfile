FROM node:26.1.0-bookworm-slim AS base

WORKDIR /Ticket Tout

COPY package*.json ./

RUN npm ci

COPY . .

FROM base AS dev-stage

WORKDIR /Ticket Tout

EXPOSE 3000

RUN npm run db:generate
    
CMD ["npm", "run", "dev"]

FROM base AS prod-stage

WORKDIR /Ticket Tout

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

RUN chmod +x docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost/:' + process.env.PORT, (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
