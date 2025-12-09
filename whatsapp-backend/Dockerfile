FROM node:20-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de definição do projeto e instala as dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos da sua aplicação (incluindo server.js)
COPY . .

# Expõe a porta que o app usa
EXPOSE 8080