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

configDotenv()
configDotenv({path: ".env.production", override:true})
decodeEnabledAPIs();

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

buildRoutes(app);

/*if(isRouteEnabled("index", "docs")) {
    console.log('Original Swagger Spec:', JSON.stringify(swaggerSpec, null, 2));

    const options = {
        customSiteTitle: "Voyager APIs",
        swaggerOptions: {
            url: undefined,
            persistAuthorization: true,
            displayRequestDuration: true,
            tryItOutEnabled: true,
            defaultModelsExpandDepth: -1,
            filter: true,
            defaultServerUrl: 'http://ec2-3-89-232-12.compute-1.amazonaws.com:8000'
        }
    };

    // Add a route to explicitly serve the swagger spec
    app.get('/swagger.json', (req, res) => {
        // Force the server URL in the spec
        const modifiedSpec = {
            ...swaggerSpec,
            servers: [{
                url: 'http://ec2-3-89-232-12.compute-1.amazonaws.com:8000',
                description: 'EC2 server'
            }],
	    host: 'ec2-3-89-232-12.compute-1.amazonaws.com:8000',
            schemes: ['http']
        };
	console.log('Modified Swagger Spec:', JSON.stringify(modifiedSpec, null, 2));
        res.json(modifiedSpec);
    });
    app.use('/', swaggerUi.serve, swaggerUi.setup(null, {
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
}*/

if(isRouteEnabled("index", "docs")) {
    console.log('Initializing Swagger documentation...');
    
    app.get('/swagger.json', (req, res) => {
        console.log('Swagger spec requested');
        const modifiedSpec = {
            ...swaggerSpec,
            servers: [{
                url: 'http://ec2-3-89-232-12.compute-1.amazonaws.com:8000',
                description: 'EC2 server'
            }]
        };
        console.log('Sending modified Swagger spec:', JSON.stringify(modifiedSpec.servers, null, 2));
        res.json(modifiedSpec);
    });

    // Add middleware logging
    app.use((req, res, next) => {
        console.log('Incoming request:', {
            url: req.url,
            method: req.method,
            headers: req.headers
        });
        next();
    });

    app.use('/', swaggerUi.serve, swaggerUi.setup(null, {
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
