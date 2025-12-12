# Use a imagem oficial do Node.js
FROM node:20-slim

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Expõe a porta que o aplicativo escuta
EXPOSE 8080

# Comando para rodar o aplicativo
CMD [ "node", "server.js" ]