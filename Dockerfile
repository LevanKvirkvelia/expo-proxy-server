FROM oven/bun:latest
WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./
COPY apps/expo-server/package.json ./apps/expo-server/

RUN bun install

COPY . .

EXPOSE 2228/tcp
ENTRYPOINT [ "bun", "run", "./apps/expo-server/index.ts" ]