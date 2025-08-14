FROM node:24-alpine3.21

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy source code
COPY . .

ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003

CMD ["npm", "run", "start"]
