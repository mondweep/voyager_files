import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your Python script - adjust the path to point to your analysis.py
const PYTHON_SCRIPT = path.join(__dirname, '..', '..', 'GenAI_CyberSecurity', 'src', 'challenge_2', 'analysis.py');

router.post('/encrypt', async (req, res) => {
    const { data, password } = req.body;
    
    const pythonProcess = spawn('python3', [
        PYTHON_SCRIPT,
        '--mode', 'encrypt',
        '--data', JSON.stringify(data),
        '--password', password
    ]);

    let result = '';
    
    pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'Encryption failed' });
        }
        try {
            const parsedResult = JSON.parse(result);
            res.json(parsedResult);
        } catch (error) {
            res.status(500).json({ error: 'Failed to parse encryption result' });
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
    
    pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'Chat encryption failed' });
        }
        try {
            const parsedResult = JSON.parse(result);
            res.json(parsedResult);
        } catch (error) {
            res.status(500).json({ error: 'Failed to parse encryption result' });
        }
    });
});

export default router; 