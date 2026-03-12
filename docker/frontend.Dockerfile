FROM node:22-alpine AS build
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --include=dev

COPY frontend ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --include=dev

COPY --from=build /app/frontend/.next ./.next
COPY --from=build /app/frontend/public ./public
COPY --from=build /app/frontend/next.config.ts ./next.config.ts
COPY --from=build /app/frontend/next-env.d.ts ./next-env.d.ts
COPY --from=build /app/frontend/tsconfig.json ./tsconfig.json
COPY --from=build /app/frontend/postcss.config.js ./postcss.config.js
COPY --from=build /app/frontend/tailwind.config.ts ./tailwind.config.ts
COPY --from=build /app/frontend/src ./src

EXPOSE 3000
CMD ["npm", "run", "start"]
