FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

# Run migrations (idempotent) then start the API server.
# Using sh -c so the shell expands the && chain correctly.
CMD ["sh", "-c", "node migrations/run.js && node src/app.js"]
