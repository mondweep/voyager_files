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
        swaggerUrl: process.env.SWAGGER_URL || 'http://ec2-174-129-177-105.compute-1.amazonaws.com:8000'
    };
    console.log('Config:', config);
    res.json(config);
});

// Mount the router
app.use('/', router);

// Swagger setup
if(isRouteEnabled("index", "docs")) {
    console.log('Documentation route is enabled');
    
    // Add root route to redirect to docs
    app.get('/', (req, res) => {
        console.log('Root route accessed, redirecting to /docs');
        res.redirect('/docs');
    });

    app.get('/swagger.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        
        const modifiedSpec = {
            ...swaggerSpec,
            servers: [{
                url: 'http://ec2-174-129-177-105.compute-1.amazonaws.com:8000',
                description: 'EC2 Server'
            }]
        };
        res.json(modifiedSpec);
    });

    const swaggerDocument = require('./swagger.json');
    swaggerDocument.servers = [{
        url: 'http://ec2-174-129-177-105.compute-1.amazonaws.com:8000',
        description: 'EC2 Server'
    }];

    app.use('/docs', swaggerUi.serve);
    app.get('/docs', swaggerUi.setup(swaggerDocument));
}

console.log('Checking embedding route:', {
    isEnabled: isRouteEnabled("embedding"),
    apis: process.env.ENABLED_APIS
});

//Commenting out as this is redundant. It is already set up in routes/index.js
/*if (isRouteEnabled("embedding")) {
    console.log('Setting up embedding route');
    api_router.use('/embeddings', embeddingRoute());
}*/

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

function generateAPIRouters() {
    const api_router = Router();
    
    // Add debug logging
    console.log('Checking embedding route status:', {
        isEnabled: isRouteEnabled("embedding"),
        routeExists: typeof embeddingRoute === 'function'
    });

    isRouteEnabled("embedding") && api_router.use('/embeddings', embeddingRoute());
    isRouteEnabled("inference") && api_router.use('/chat', inferenceRoute());
    isRouteEnabled("token") && api_router.use('/token', tokenRoute());
    // api_router.use('/tracing', tracingRoute());
    // api_router.use('/encoder', encoderRoute());
    // api_router.use('/decoder', decoderRoute());
    isRouteEnabled("version") && api_router.use('/version', versionRoute());
    isRouteEnabled("file") && api_router.use('/files', fileRoute());

    return api_router;
}
