const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises'); // Importando o módulo fs/promises
const path = require('path'); // Importando o módulo path

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // ESSENCIAL para o Fly.io
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
        qr_code_data: qrCodeData, // Usado para QR Code OU Código de 8 dígitos
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

// Função para buscar a AgentConfig do Supabase
async function getAgentConfig(userId) {
    // Adicionando validação para evitar que strings inválidas (como 'null') cheguem ao DB
    // Um UUID tem 36 caracteres. Se for muito curto ou não for string, ignoramos.
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
    return null; // Retorna null se não encontrar
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
    
    // Argumentos do Puppeteer ajustados para máxima compatibilidade em ambientes Fly.io/Docker
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
        // O QR Code é o dado que o frontend usa para renderizar
        updateSessionStatus(userId, 'connecting', qr);
    });
    
    // NOVO: Evento para Code Linking (conexão por número de telefone)
    client.on('code', (code) => {
        console.log('[WWEB] CODE RECEIVED:', code);
        // Usamos o campo qr_code_data para armazenar o código de 8 dígitos
        updateSessionStatus(userId, 'connecting', code);
    });
    
    // NOVO: Evento para tela de carregamento (útil para feedback)
    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN', percent, message);
        // Não atualizamos o DB aqui, apenas logamos
    });

    client.on('ready', () => {
        console.log('[WWEB] Client is ready!');
        // Limpa o qr_code_data/code quando conectado
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
                    // Não precisamos de Authorization aqui, pois a Edge Function não verifica JWT
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
        // Garante que o status seja atualizado no DB em caso de falha crítica
        updateSessionStatus(userId, 'disconnected', null); 
        // Limpa o cliente global para permitir uma nova tentativa
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
    
    try {
        // Limpa a sessão local antes de iniciar para garantir um estado limpo
        await clearLocalSession(userId); 
        
        initializeClient(userId);
        // O backend irá atualizar o Supabase de forma assíncrona com o QR code ou o código de 8 dígitos.
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