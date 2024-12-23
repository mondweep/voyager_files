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

COPY scripts/analysis.py /app/scripts/
RUN chmod +x /app/scripts/analysis.py

COPY . .

# Create input directory and copy data
COPY input/cyber-security-incidents/incidents.csv /input/cyber-security-incidents/

EXPOSE 8000

HEALTHCHECK --interval=300s --timeout=30s --start-period=5s --retries=3 CMD [ "node", "healthy-check.js" ]

ENTRYPOINT [ "npm", "start" ]