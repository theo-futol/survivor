FROM node:26.1.0-bookworm-slim AS base

WORKDIR /CartePro

COPY package*.json ./

RUN npm ci

COPY . .

FROM base AS dev-stage

WORKDIR /CartePro

EXPOSE 3000

RUN npm run db:generate
    
CMD ["npm", "run", "dev"]

FROM base AS prod-stage

WORKDIR /CartePro

RUN npm run build \
    && cp -r public .next/standalone/public \
    && cp -r .next/static .next/standalone/.next/static

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
