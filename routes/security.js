import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import securityMiddleware from '../middleware/securityMiddleware.js';
import cors from 'cors';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for all security routes
router.use(cors({
    origin: '*',  // Be more restrictive in production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'accept', 'Authorization']
}));

// Add debug logging
console.log('Current directory:', __dirname);

// Path to your Python script
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'analysis.py');
console.log('Python script path:', PYTHON_SCRIPT);

// Apply the middleware to all routes in this router
router.use(securityMiddleware);

router.post('/encrypt', async (req, res) => {
    const { data, password } = req.body;
    
    console.log('Encryption request received:', { data: data, passwordLength: password?.length });
    
    const pythonProcess = spawn('python3', [
        PYTHON_SCRIPT,
        '--mode', 'encrypt',
        '--data', JSON.stringify(data),
        '--password', password
    ]);

    let result = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
        console.log('Python stdout (raw):', data);
        console.log('Python stdout:', data.toString());
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.log('Python stderr:', data.toString());
        errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        console.log('Full result (pre-parse):', result);
        console.log('Full error:', errorOutput);
        
        if (code !== 0) {
            return res.status(500).json({ 
                error: 'Encryption failed',
                details: errorOutput
            });
        }
        try {
            console.log('Attempting to parse:', result);
            const parsedResult = JSON.parse(result);
            console.log('Successfully parsed:', parsedResult);
            res.json(parsedResult);
        } catch (error) {
            console.log('Parse error details:', error);
            res.status(500).json({ 
                error: 'Failed to parse encryption result',
                rawOutput: result,
                parseError: error.message
            });
        }
    });
});

router.post('/chat/encrypt', async (req, res) => {
    const { messages, password } = req.body;
    
    const pythonProcess = spawn('python3', [
        PYTHON_SCRIPT,
        '--mode', 'encrypt',
        '--data', JSON.stringify({ messages }),
        '--password', password
    ]);

    let result = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
        console.log('Python stdout:', data.toString());
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.log('Python stderr:', data.toString());
        errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        console.log('Full result:', result);
        console.log('Full error:', errorOutput);
        
        if (code !== 0) {
            return res.status(500).json({ 
                error: 'Chat encryption failed',
                details: errorOutput
            });
        }
        try {
            const parsedResult = JSON.parse(result);
            res.json(parsedResult);
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to parse encryption result',
                rawOutput: result,
                parseError: error.message
            });
        }
    });
});

export default router; 