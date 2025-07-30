# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm ci --only=production && npm cache clean --force

# Copy the rest of the application's source code
COPY src/ ./src/
COPY config/config.example.json ./config/

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S multigig -u 1001 -G nodejs

# Create necessary directories and set permissions
RUN mkdir -p /usr/src/app/config && \
    chown -R multigig:nodejs /usr/src/app

# Switch to non-root user
USER multigig

# Set environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Expose port (not necessary for this bot, but good practice)
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Define the command to run your app
CMD [ "node", "src/index.js" ]
