import { SecurityAnalysis } from '../utils/security.js';

const securityMiddleware = async (req, res, next) => {
    // Only encrypt messages if they contain sensitive data markers
    if (req.body.messages && req.body.messages.some(msg => msg.sensitive === true)) {
        const security = new SecurityAnalysis();
        
        // Encrypt sensitive messages
        req.body.messages = req.body.messages.map(msg => {
            if (msg.sensitive) {
                const encrypted = security.encrypt_message(msg.content);
                return {
                    ...msg,
                    content: encrypted,
                    encrypted: true
                };
            }
            return msg;
        });
    }
    next();
};

export default securityMiddleware;
