# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build-time environment variables for Vite
ARG VITE_PIPELINE_API_URL=https://us-central1-waffle-mm.cloudfunctions.net
ARG VITE_API_BASE_URL=https://us-central1-waffle-mm.cloudfunctions.net
ARG VITE_GMAIL_API_URL=https://us-central1-waffle-mm.cloudfunctions.net
ARG VITE_AUTH_API_URL=https://us-central1-waffle-mm.cloudfunctions.net

ENV VITE_PIPELINE_API_URL=$VITE_PIPELINE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GMAIL_API_URL=$VITE_GMAIL_API_URL
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL

RUN npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
