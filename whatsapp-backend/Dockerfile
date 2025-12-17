# Use a imagem base do Node.js
FROM node:20-slim

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de manifesto e instala as dependências
COPY whatsapp-backend/package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código da aplicação
COPY whatsapp-backend/server.js .

# Expõe a porta que o aplicativo usa
EXPOSE 3000

# Comando para iniciar o aplicativo
CMD ["node", "server.js"]

# Versão 1.0.1 para forçar sincronização