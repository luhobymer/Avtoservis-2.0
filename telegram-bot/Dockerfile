FROM node:18-alpine

# Встановлення робочої директорії
WORKDIR /app

# Копіювання package.json та package-lock.json
COPY package*.json ./

# Встановлення залежностей
RUN npm ci --only=production

# Копіювання всіх файлів
COPY . .

# Створення директорії для логів
RUN mkdir -p logs

# Встановлення прав доступу
RUN chown -R node:node /app
USER node

# Відкриття порту
EXPOSE 3001

# Запуск бота
CMD ["node", "bot.js"]