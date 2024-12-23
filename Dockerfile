FROM node:20

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

RUN npm install -g pnpm && pnpm install

COPY requirements.txt ./
RUN pip3 install -r requirements.txt

COPY . .

RUN chmod +x /app/GenAI_CyberSecurity/src/challenge_2/analysis.py

EXPOSE 8000

HEALTHCHECK --interval=300s --timeout=30s --start-period=5s --retries=3 CMD [ "node", "healthy-check.js" ]

ENTRYPOINT [ "npm", "start" ]