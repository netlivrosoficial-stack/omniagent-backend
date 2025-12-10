const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises'); 
const path = require('path'); 

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // ESSENCIAL para o Fly.io
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

console.log(`[CONFIG] SUPABASE_URL is set: ${!!SUPABASE_URL}`);
console.log(`[CONFIG] SUPABASE_SERVICE_ROLE_KEY is set: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

// Inicializa o cliente Supabase (MANTIDO, mas não usado na inicialização crítica)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
    }
});

// Global WhatsApp Client instance
let client = null;
let currentUserId = null; 

const app = express();
app.use(express.json());

// CORS setup (essential for Fly.io to communicate with the frontend)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --- Supabase Session Management Functions (MANTIDAS, mas não chamadas na inicialização) ---

async function updateSessionStatus(userId, status, qrCodeData = null) {
    // ... (função mantida)
    const updatePayload = {
        status: status,
        last_updated: new Date().toISOString(),
        qr_code_data: qrCodeData, 
    };

    console.log(`[DB] Attempting to update session for user ${userId} to status: ${status}`);

    // Use upsert to handle both insert (if no session) and update
    const { data, error } = await supabase
        .from('whatsapp_sessions')
        .upsert({ user_id: userId, ...updatePayload }, { onConflict: 'user_id' })
        .select();

    if (error) {
        console.error(`[DB ERROR] Error updating session status for user ${userId}:`, error);
        return { success: false, error: error.message }; 
    }
    console.log(`[DB] Session updated successfully for user ${userId}.`);
    return { success: true, data: data };
}

async function getAgentConfig(userId) {
    // Adicionando validação para evitar que strings inválidas (como 'null') cheguem ao DB
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
        console.warn(`[DB WARNING] Invalid or missing userId (${userId}). Cannot fetch agent config.`);
        return null;
    }
    
    const { data, error } = await supabase
        .from('agent_configs')
        .select('config')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`[DB ERROR] Error fetching agent config for user ${userId}:`, error);
        return null;
    }
    
    if (data) {
        return data.config;
    }
    
    console.warn(`[DB WARNING] Agent config not found for user ${userId}. Using default/empty config.`);
    return null; 
}

async function clearLocalSession(userId) {
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
    try {
        await fs.rm(sessionPath, { recursive: true, force: true });
        console.log(`Local session data cleared for user ${userId} at ${sessionPath}`);
    } catch (e) {
        console.error(`Failed to clear local session data for user ${userId}:`, e);
    }
}

// --- WhatsApp Client Initialization (MANTIDO, mas não chamado na inicialização) ---

function initializeClient(userId) {
    if (client && client.state !== 'disconnected') {
        console.log(`Client already running for user ${currentUserId}. Destroying old session.`);
        client.destroy(); 
    }
    
    currentUserId = userId;
    
    const puppeteerArgs = [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', 
        '--disable-accelerated-2d-canvas', 
        '--no-first-run',
        '--no-zygote',
        '--single-process', 
        '--disable-gpu',
        '--unlimited-storage', 
        '--disable-web-security' 
    ];

    client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        puppeteer: {
            args: puppeteerArgs,
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('[WWEB] QR RECEIVED');
        updateSessionStatus(userId, 'connecting', qr);
    });
    
    client.on('code', (code) => {
        console.log('[WWEB] CODE RECEIVED:', code);
        updateSessionStatus(userId, 'connecting', code);
    });
    
    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN', percent, message);
    });

    client.on('ready', () => {
        console.log('[WWEB] Client is ready!');
        updateSessionStatus(userId, 'connected', null); 
    });

    client.on('authenticated', (session) => {
        console.log('[WWEB] AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        console.error('[WWEB] AUTHENTICATION FAILURE', msg);
        updateSessionStatus(userId, 'disconnected', null);
    });

    client.on('disconnected', (reason) => {
        console.log('[WWEB] Client was disconnected. Reason:', reason); 
        updateSessionStatus(userId, 'disconnected', null);
    });
    
    client.on('message', async msg => {
        // Ignora mensagens de status, grupos, ou do próprio agente
        if (msg.isStatus || msg.fromMe || msg.id.remote.endsWith('@g.us')) return;
        
        const senderNumber = msg.from;
        const messageBody = msg.body;
        
        console.log(`[WWEB] Message received from ${senderNumber}: ${messageBody}`);

        if (messageBody === '!ping') {
            msg.reply('pong');
            return;
        }
        
        // 1. Buscar a configuração do agente
        const agentConfig = await getAgentConfig(currentUserId);
        
        if (!agentConfig) {
            console.error(`[WWEB] Agent config not available for user ${currentUserId}. Cannot process message.`);
            msg.reply("Desculpe, a configuração do agente não está disponível. Por favor, verifique o painel de controle.");
            return;
        }
        
        console.log(`[WWEB] Agent config retrieved successfully for user ${currentUserId}.`);
        
        // 2. Chamar a Edge Function do Supabase
        const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
        
        try {
            console.log(`[WWEB] Calling Edge Function at: ${EDGE_FUNCTION_URL}`);
            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messageBody,
                    sender: senderNumber,
                    agentConfig: agentConfig,
                }),
            });

            console.log(`[WWEB] Edge Function responded with status: ${response.status}`);
            const data = await response.json();

            if (response.ok && data.response) {
                console.log(`[WWEB] Edge Function Response: ${data.response.substring(0, 50)}...`);
                // 3. Enviar a resposta de volta para o WhatsApp
                console.log(`[WWEB] Attempting to reply to message.`);
                msg.reply(data.response);
                console.log(`[WWEB] Reply sent successfully.`);
            } else {
                console.error(`[WWEB] Edge Function failed or returned no text response. Error: ${data.error || 'No response text.'}`);
                msg.reply("Desculpe, o agente de IA encontrou um erro interno ao processar sua mensagem.");
            }

        } catch (error) {
            console.error("[WWEB ERROR] Failed to call Edge Function:", error);
            msg.reply("Desculpe, houve um erro de comunicação com o servidor de IA.");
        }
    });

    // Tratamento de erro mais robusto na inicialização
    client.initialize().catch(err => {
        console.error("[WWEB ERROR] Critical error during WhatsApp client initialization:", err);
        updateSessionStatus(userId, 'disconnected', null); 
        client = null;
        currentUserId = null;
    });
}

// --- API Endpoints ---

// Endpoint to start the connection process
app.post('/api/whatsapp/start', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    // Verificação de variáveis de ambiente movida para dentro da rota
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" });
    }
    
    try {
        await clearLocalSession(userId); 
        
        initializeClient(userId);
        return res.json({ 
            status: 'starting', 
            message: 'WhatsApp client initialization started. Check Supabase for QR code/Code updates.' 
        });
    } catch (e) {
        console.error("Failed to start WhatsApp client:", e);
        return res.status(500).json({ error: 'Failed to start WhatsApp client.' });
    }
});

// Endpoint to disconnect the session
app.post('/api/whatsapp/disconnect', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    // 1. Tenta destruir o cliente WhatsApp se ele estiver ativo e for o cliente correto
    if (client && currentUserId === userId && client.state !== 'disconnected') {
        try {
            await client.destroy();
            console.log(`Client for user ${userId} destroyed.`);
        } catch (e) {
            console.error(`Error destroying client for user ${userId}:`, e);
        }
        client = null;
        currentUserId = null;
    } else if (currentUserId !== userId) {
        console.log(`Warning: Disconnect request for user ${userId}, but current active client is for ${currentUserId}. Only updating DB status.`);
    }
    
    // 2. Limpa os arquivos de sessão local para evitar reconexão automática
    await clearLocalSession(userId);
    
    // 3. Garante que o status no DB seja 'disconnected'
    const dbUpdateResult = await updateSessionStatus(userId, 'disconnected', null);
    
    if (dbUpdateResult.success) {
        return res.json({ status: 'disconnected', message: 'Session disconnected successfully.' });
    } else {
        return res.status(500).json({ error: `Failed to update session status in database: ${dbUpdateResult.error}` });
    }
});

// Endpoint de Health Check para o Fly.io
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'whatsapp-backend' });
});

// Endpoint to check status (optional, but useful)
app.get('/api/whatsapp/status/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .single();
        
    if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: error.message });
    }
    
    return res.json({ 
        status: data ? data.status : 'disconnected',
        qrCode: data ? data.qr_code_data : null,
        message: data ? 'Session status retrieved.' : 'No session found.'
    });
});


app.listen(PORT, HOST, () => {
    console.log(`WhatsApp Backend running on http://${HOST}:${PORT}`);
    console.log(`GEMINI_API_KEY is set: ${!!GEMINI_API_KEY}`); // Log para debug
});