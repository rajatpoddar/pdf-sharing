# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application files
COPY . .

# Build the Next.js application
# The standalone output will be in .next/standalone
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
# Optionally, set the port, though Next.js standalone usually uses 3000 by default or PORT env var
# ENV PORT=3000

# Copy the standalone application from the builder stage
COPY --from=builder /app/.next/standalone ./

# Copy the public folder from the builder stage for static assets
# The standalone output includes a public folder, but ensure it has everything if you have custom assets.
# The PDF uploads will go into a volume mounted at /app/public/uploads/pdfs
COPY --from=builder /app/public ./public

# Copy the static assets from .next/static
COPY --from=builder /app/.next/static ./.next/static

# Expose the port the app runs on
EXPOSE 3000

# Set the user to non-root for better security
USER node

# Command to run the application
# The server.js file is created by the standalone output
CMD ["node", "server.js"]
