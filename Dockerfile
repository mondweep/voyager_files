FROM node:20

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

RUN npm install

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt; fi

COPY . .

RUN chmod +x /app/GenAI_CyberSecurity/src/challenge_2/analysis.py

EXPOSE 8000

HEALTHCHECK --interval=300s --timeout=30s --start-period=5s --retries=3 CMD [ "node", "healthy-check.js" ]

ENTRYPOINT [ "npm", "start" ]