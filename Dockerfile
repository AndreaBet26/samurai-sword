FROM node:22-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy full application code
COPY . .

# Build client production bundle
RUN npm run build

# Run tests to ensure build integrity
RUN npm test

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
