# Stage 1: Build ESPConnect
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm

# Install dependencies
COPY package*.json ./
COPY pnpm*.json ./
RUN pnpm install

# Copy the rest of the source and build
COPY . .
RUN pnpm build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
