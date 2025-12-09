const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises'); // Importando o módulo fs/promises
const path = require('path'); // Importando o módulo path

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Needed if we move AI logic here later

console.log(`[CONFIG] SUPABASE_URL is set: ${!!SUPABASE_URL}`);
console.log(`[CONFIG] SUPABASE_SERVICE_ROLE_KEY is set: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

// Initialize Supabase client with Service Role Key to bypass RLS for server operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
    }
});

// Global WhatsApp Client instance
let client = null;
let currentUserId = null; // Tracks which user owns the current session

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

// --- Supabase Session Management Functions ---

async function updateSessionStatus(userId, status, qrCodeData = null) {
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
        // Retorna o erro para que a rota de API possa detalhar o problema
        return { success: false, error: error.message }; 
    }
    console.log(`[DB] Session updated successfully for user ${userId}.`);
    return { success: true, data: data };
}

// Função para limpar os arquivos de sessão local
async function clearLocalSession(userId) {
    // O whatsapp-web.js usa .wwebjs_auth no diretório de trabalho
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${userId}`);
    try {
        // Usamos force: true para garantir que não falhe se o diretório não existir
        await fs.rm(sessionPath, { recursive: true, force: true });
        console.log(`Local session data cleared for user ${userId} at ${sessionPath}`);
    } catch (e) {
        console.error(`Failed to clear local session data for user ${userId}:`, e);
    }
}

// --- WhatsApp Client Initialization ---

function initializeClient(userId) {
    if (client && client.state !== 'disconnected') {
        console.log(`Client already running for user ${currentUserId}. Destroying old session.`);
        // Destruição síncrona aqui, o erro será capturado no .catch() do initialize
        client.destroy(); 
    }
    
    currentUserId = userId;
    
    // Use LocalAuth to persist session data locally on the Fly.io volume
    client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        puppeteer: {
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Otimização de memória
                '--disable-accelerated-2d-canvas', // Otimização de GPU/Canvas
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Reduz o uso de memória
                '--disable-gpu'
            ],
        }
    });

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('[WWEB] QR RECEIVED');
        updateSessionStatus(userId, 'connecting', qr);
    });

    client.on('ready', () => {
        console.log('[WWEB] Client is ready!');
        updateSessionStatus(userId, 'connected');
    });

    client.on('authenticated', (session) => {
        console.log('[WWEB] AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        console.error('[WWEB] AUTHENTICATION FAILURE', msg);
        updateSessionStatus(userId, 'disconnected');
    });

    client.on('disconnected', (reason) => {
        console.log('[WWEB] Client was disconnected. Reason:', reason); // Adicionado log da razão
        updateSessionStatus(userId, 'disconnected');
        // Note: We do NOT clear local session here, only on explicit user disconnect request.
    });
    
    client.on('message', async msg => {
        if (msg.body === '!ping') {
            msg.reply('pong');
        } else {
            // --- Message Relay to AI (Simplified for now) ---
            // TODO: Implement call to Supabase whatsapp-webhook EF here
            // For now, we'll send a simple confirmation.
            // msg.reply(`[AI] Recebi sua mensagem: "${msg.body}". Processando...`);
        }
    });

    client.initialize().catch(err => {
        console.error("[WWEB ERROR] Error initializing WhatsApp client:", err);
        updateSessionStatus(userId, 'disconnected');
    });
}

// --- API Endpoints ---

// Endpoint to start the connection process
app.post('/api/whatsapp/start', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    try {
        initializeClient(userId);
        // O backend irá atualizar o Supabase de forma assíncrona com o QR code.
        return res.json({ 
            status: 'starting', 
            message: 'WhatsApp client initialization started. Check Supabase for QR code updates.' 
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
            // client.destroy() pode falhar se o cliente não estiver em um estado destrutível
            await client.destroy();
            console.log(`Client for user ${userId} destroyed.`);
        } catch (e) {
            console.error(`Error destroying client for user ${userId}:`, e);
            // Não retornamos 500 aqui, apenas logamos e continuamos a limpeza
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
        // Retorna o erro detalhado do Supabase
        return res.status(500).json({ error: `Failed to update session status in database: ${dbUpdateResult.error}` });
    }
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


app.listen(PORT, () => {
    console.log(`WhatsApp Backend running on port ${PORT}`);
    console.log(`GEMINI_API_KEY is set: ${!!GEMINI_API_KEY}`); // Log para debug
    // Note: We don't initialize the client here, only via the API call.
});