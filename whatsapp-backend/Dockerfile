# Use a imagem base Node.js
FROM node:18-slim

# =======================================================
# INÍCIO: Correção de Dependências do Chromium (CRÍTICO)
# Implementação da lista completa de dependências de sistema para garantir a execução estável do Puppeteer/Chrome Headless.
# =======================================================

RUN apt-get update && apt-get install -y \
    # Dependências de Núcleo (Core Dependencies)
    gconf-service \
    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    # Dependências que já estavam na sua lista (mantidas e organizadas)
    libdrm2 \
    libgbm1 \
    libgconf-2-4 \
    libxkbcommon-x11-0 \
    libglib2.0-0 \
    libsecret-1-0 \
    libappindicator3-1 \
    xdg-utils \
    wget \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# =======================================================
# FIM: Correção de Dependências do Chromium
# =======================================================

# Definir o diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar o restante do código
COPY . .

# Comando para iniciar o servidor
CMD ["npm", "start"]