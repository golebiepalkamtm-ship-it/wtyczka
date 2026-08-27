FROM ubuntu:22.04

# Avoid prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies: Git, Python 3, venv, build-essential
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install npm dependencies
COPY package*.json ./
RUN npm install

# Copy configuration, source code, and bundled sub-servers
COPY tsconfig.json ./
COPY src/ ./src/
COPY servers/ ./servers/

# Build TypeScript
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
