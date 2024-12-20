// coding=utf-8

// Copyright [2024] [SkywardAI]
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//        http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from "https"
import { configDotenv } from 'dotenv';

import { initDB } from './database/index.js';
import buildRoutes from './routes/index.js'

import swStats from 'swagger-stats';
import * as swaggerUi from 'swagger-ui-express'
import swaggerSpec from "./swagger.json" with { type: "json" };
import { decodeEnabledAPIs, isRouteEnabled } from './tools/enabledApiDecoder.js';
import { loadDefaultDataset } from './tools/plugin.js';
import { loadDataset } from './database/rag-inference.js';
import { readFileSync } from 'fs';

console.log('Starting Voyager server...');

// Add heartbeat check
setInterval(() => {
    console.log('Heartbeat check:', new Date().toISOString());
}, 5000);

configDotenv()
configDotenv({path: ".env.production", override:true})
decodeEnabledAPIs();
console.log('Enabled APIs:', process.env.ENABLED_APIS);

const force_load = false;
await initDB(force_load)
if(+process.env.LOAD_DEFAULT_DATASET) {
    const loader = await loadDataset(process.env.DEFAULT_DATASET_NAME || "production_dataset", force_load)
    loader && await loader(await loadDefaultDataset())
}

const app = express();
//app.use(cors({origin: process.env.ALLOW_ORIGIN || '*'}));
app.use(cors({
    /*origin: process.env.ALLOW_ORIGIN || '*',*/
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    /*allowedHeaders: ['Content-Type', 'Authorization', 'Accept','api-key','access-control-allow-origin'],
    exposedHeaders: ['access-control-allow-origin'],*/
    allowedHeaders: '*',
    exposedHeaders: '*',
    credentials: false,
    //perflightContinue: false
    perflightContinue: true
}));
app.use(bodyParser.json());

if(isRouteEnabled("index", "stats")) {
    app.use(swStats.getMiddleware({
        name: "Voyager Swagger Monitor",
        uriPath: '/stats',
        swaggerSpec
    }))
}

// Add test route here
app.get('/test-docs', (req, res) => {
    console.log('Test docs route hit');
    res.json({
        isDocsEnabled: isRouteEnabled("index", "docs"),
        enabledApis: process.env.ENABLED_APIS
    });
});

buildRoutes(app);

const router = express.Router();

// Test endpoint
router.get('/api/test-config', (req, res) => {
    console.log('Test config route hit');
    const config = {
        isDocsEnabled: isRouteEnabled("index", "docs"),
        enabledApis: process.env.ENABLED_APIS,
        currentUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
        swaggerUrl: process.env.SWAGGER_URL || 'http://ec2-3-89-232-12.compute-1.amazonaws.com:8000'
    };
    console.log('Config:', config);
    res.json(config);
});

// Mount the router
app.use('/', router);

// Swagger setup
if(isRouteEnabled("index", "docs")) {
    console.log('Documentation route is enabled');
    console.log('Initializing Swagger documentation...');
    
    // Add debug logging middleware before swagger routes
    app.use((req, res, next) => {
        console.log('Incoming request:', {
            path: req.path,
            method: req.method,
            headers: req.headers
        });
        next();
    });
    
    app.get('/swagger.json', (req, res) => {
        console.log('Swagger spec requested from:', req.get('host'));
        const modifiedSpec = {
            ...swaggerSpec,
            servers: [{
                url: 'http://ec2-3-89-232-12.compute-1.amazonaws.com:8000',
                description: 'EC2 server'
            }]
        };
        console.log('Modified swagger spec:', {
            servers: modifiedSpec.servers,
            paths: Object.keys(modifiedSpec.paths || {})
        });
        res.json(modifiedSpec);
    });

    app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, {
        customSiteTitle: "Voyager APIs",
        swaggerOptions: {
            url: '/swagger.json',
            persistAuthorization: true,
            displayRequestDuration: true,
            tryItOutEnabled: true,
            defaultModelsExpandDepth: -1,
            filter: true
        }
    }));
    console.log('Swagger UI setup complete');
}

const PORT = process.env.PORT || 8000
console.log('About to start server on port:', PORT);
if(
    +process.env.ENABLE_HTTPS &&
    !process.env.HTTPS_KEY_PATH.startsWith("*") &&
    !process.env.HTTPS_CERT_PATH.startsWith("*")
) {
    const ssl_options = {
        key: readFileSync(process.env.HTTPS_KEY_PATH),
        cert: readFileSync(process.env.HTTPS_CERT_PATH)
    }
    if(process.env.HTTPS_CA_PATH && !process.env.HTTPS_CA_PATH.startsWith("*")) {
        ssl_options.ca = readFileSync(process.env.HTTPS_CA_PATH);
    }
    createServer(ssl_options, app).listen(PORT, '0.0.0.0', () => {
        console.log(`VOYAGER is running on port ${PORT}, happy sailing!`)
    })
} else {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`VOYAGER is running on port ${PORT}, happy sailing!`)
    })
}
