# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# 依存だけ先に入れてキャッシュ効率UP
COPY package*.json ./
RUN npm ci

# ソース投入 & ビルド
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

# 本番に必要な最低限をコピー
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Cloud Run は $PORT を割り当てる。あなたのコードは PORT を読んでるのでOK
ENV NODE_ENV=production

# 健康チェックは /health が200を返すのでOK
EXPOSE 8080
CMD ["npm", "start"]

