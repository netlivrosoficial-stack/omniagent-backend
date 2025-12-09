# Use a imagem base Node.js
FROM node:20-slim

# Instalar dependências do sistema necessárias para o Puppeteer (Chrome Headless)
# Estas são as dependências mínimas para rodar o Chrome em um ambiente Linux sem cabeça.
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgconf-2-4 \
    libgtk-3-0 \
    libxkbcommon-x11-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    libasound2 \
    libxss1 \
    libglib2.0-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Definir o diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar o restante do código
COPY . .

# Comando para iniciar o servidor
CMD ["npm", "start"]