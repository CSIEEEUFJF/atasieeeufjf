FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV ATAS_DIR=/atas

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

RUN mkdir -p /atas && chown -R node:node /atas /app

USER node

EXPOSE 3001
VOLUME ["/atas"]

CMD ["node", "server.js"]
