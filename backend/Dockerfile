FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5501

CMD ["npm", "start"]
