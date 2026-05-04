# ra-browser/Dockerfile
#
# Uses the official Playwright image which includes Chromium and all required
# system dependencies. No separate browser install step needed.
#
# Build: docker build -t ra-browser .
# Run:   docker run -e EGRESS_SHARED_SECRET=<secret> -p 8081:8081 ra-browser

FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 8081

CMD ["node", "server.js"]
