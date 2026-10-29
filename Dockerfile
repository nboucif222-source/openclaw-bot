FROM node:18-slim

WORKDIR /app

RUN npm install telegraf@4.16.3 @google/genai@0.1.1

COPY . .

EXPOSE 10000
CMD ["node", "index.js"]
