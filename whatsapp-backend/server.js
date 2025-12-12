const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- Configuration ---
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Evolution Config
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const FLY_APP_URL = process.env.FLY_APP_URL; // Nova variável para a URL pública do Fly.io
const WEBHOOK_URL = FLY_APP_URL ? `${FLY_APP_URL}/webhook/evolution` : 'http://localhost:8080/webhook/evolution';

console.log(`[CONFIG] Evolution Config Status: ${!!EVOLUTION_API_KEY && !!EVOLUTION_INSTANCE_ID && !!EVOLUTION_BASE_URL ? 'OK' : 'MISSING'}`);
console.log(`[CONFIG] Webhook Target URL: ${WEBHOOK_URL}`);


if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID || !EVOLUTION_BASE_URL || !FLY_APP_URL) {
    console.error("Missing required environment variables (Supabase or Evolution/FLY_APP_URL).");
    process.exit(1);
}

// Initialize Supabase client with Service Role Key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
    }
});

const app = express();
app.use(express.json());

// CORS setup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
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

// Função para buscar a AgentConfig do Supabase
async function getAgentConfig(userId) {
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
    
    console.warn(`[DB WARNING] Agent config not found for user ${userId}.`);
    return null; 
}

// Função para enviar mensagem via Evolution API
async function sendEvolutionMessage(number, text) {
    const url = `${EVOLUTION_BASE_URL}/message/send/text/${EVOLUTION_INSTANCE_ID}`;
    
    const payload = {
        number: number.replace('@c.us', ''), // Evolution expects number without suffix
        options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
        },
        textMessage: {
            text: text
        }
    };
    
    console.log(`[EVOLUTION] Sending message to ${number}`);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EVOLUTION ERROR] Failed to send message: ${response.status} - ${errorText}`);
        throw new Error(`Evolution API failed to send message: ${response.status}`);
    }
    
    console.log(`[EVOLUTION] Message sent successfully.`);
}

// --- Evolution API Connection Management (CORRIGIDO) ---

async function startConnectionEvolution(userId) {
    const url = `${EVOLUTION_BASE_URL}/instance/connect/${EVOLUTION_INSTANCE_ID}`;
    
    console.log(`[EVOLUTION] Requesting connection start for instance ${EVOLUTION_INSTANCE_ID}`);
    
    // CORREÇÃO CRÍTICA: Enviar a URL do Webhook no payload
    const payload = {
        "webhook": WEBHOOK_URL,
        "instanceName": EVOLUTION_INSTANCE_ID 
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify(payload) 
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EVOLUTION ERROR] Failed to start connection: ${response.status} - ${errorText}`);
        throw new Error(`Evolution API failed to start connection: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Evolution retorna o QR code data diretamente na interface, ou no retorno.
    const qrCodeData = data.qrcode?.base64 || data.qrcode?.code || 'Verificar QR na Interface Evolution'; 
    
    // Update DB status to connecting and store QR data
    await updateSessionStatus(userId, 'connecting', qrCodeData);
    
    return { success: true, data: data };
}

async function disconnectEvolution(userId) {
    const url = `${EVOLUTION_BASE_URL}/instance/disconnect/${EVOLUTION_INSTANCE_ID}`;
    
    console.log(`[EVOLUTION] Requesting disconnection for instance ${EVOLUTION_INSTANCE_ID}`);
    
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EVOLUTION ERROR] Failed to disconnect: ${response.status} - ${errorText}`);
    }
    
    // Update DB status to disconnected
    await updateSessionStatus(userId, 'disconnected', null);
    
    return { success: true };
}

// --- API Endpoints (Frontend Calls) ---

// Endpoint to start the connection process
app.post('/api/whatsapp/start', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    try {
        const result = await startConnectionEvolution(userId);
        return res.json({ 
            status: 'starting', 
            message: 'Evolution connection process started. Check Supabase for QR code updates.',
            details: result.data
        });
    } catch (e) {
        console.error("Failed to start Evolution connection:", e);
        return res.status(500).json({ error: e.message || 'Failed to start Evolution connection.' });
    }
});

// Endpoint to disconnect the session (forces a restart/new QR code generation)
app.post('/api/whatsapp/disconnect', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    try {
        // 1. Disconnect via Evolution API
        await disconnectEvolution(userId);
        
        // 2. Start a new connection immediately (Gera novo QR)
        console.log(`[DISCONNECT] Successfully disconnected. Starting new connection process for user ${userId}.`);
        await startConnectionEvolution(userId);
        
        return res.json({ status: 'restarting', message: 'Session disconnected and new connection process started.' });
    } catch (e) {
        console.error("Failed to disconnect/restart Evolution connection:", e);
        return res.status(500).json({ error: e.message || 'Failed to disconnect/restart Evolution connection.' });
    }
});

// Endpoint to check status (still useful for frontend polling)
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

// --- Evolution Webhook Endpoint (Receiving Messages) ---

app.post('/webhook/evolution', async (req, res) => {
    const event = req.body;
    
    // 1. Handle Connection Status Updates (QR Code, Open, Close)
    if (event.event === 'qrcode' || event.event === 'connection.update') {
        const instanceId = event.instance;
        const userId = instanceId; 
        
        if (event.event === 'qrcode' && event.data.qrcode) {
            console.log(`[WEBHOOK] QR Code received for instance ${instanceId}`);
            await updateSessionStatus(userId, 'connecting', event.data.qrcode);
        } else if (event.event === 'connection.update') {
            const status = event.data.state; // 'open' or 'close'
            const statusMap = {
                'open': 'connected',
                'close': 'disconnected',
                'connecting': 'connecting'
            };
            const newStatus = statusMap[status] || 'disconnected';
            
            console.log(`[WEBHOOK] Connection status update for instance ${instanceId}: ${newStatus}`);
            await updateSessionStatus(userId, newStatus, null);
        }
        
        return res.sendStatus(200);
    }
    
    // 2. Handle Incoming Messages
    if (event.event !== 'message' || !event.data || !event.data.message) {
        return res.sendStatus(200); // Ignore non-message events or invalid format
    }
    
    const messageData = event.data;
    const senderNumber = messageData.key.remoteJid; // Ex: 5511999999999@c.us
    const messageBody = messageData.message.conversation || messageData.message.extendedTextMessage?.text || '';
    const instanceId = event.instance;
    const currentUserId = instanceId;

    console.log(`[WEBHOOK] Message received from ${senderNumber}: ${messageBody}`);

    if (!messageBody || messageBody.trim() === '') {
        return res.sendStatus(200); // Ignore empty messages
    }
    
    // 3. Buscar a configuração do agente
    const agentConfig = await getAgentConfig(currentUserId);
    
    if (!agentConfig) {
        console.error(`[WEBHOOK] Agent config not available for user ${currentUserId}. Cannot process message.`);
        await sendEvolutionMessage(senderNumber, "Desculpe, a configuração do agente não está disponível. Por favor, verifique o painel de controle.");
        return res.sendStatus(200);
    }
    
    // 4. Chamar a Edge Function do Supabase (AI Logic)
    const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
    
    try {
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

        const data = await response.json();

        if (response.ok && data.response) {
            console.log(`[WEBHOOK] Edge Function Response: ${data.response}`);
            // 5. Enviar a resposta de volta para o WhatsApp via Evolution API
            await sendEvolutionMessage(senderNumber, data.response);
        } else {
            console.error(`[WEBHOOK] Edge Function failed or returned no text response. Error: ${data.error || 'No response text.'}`);
            await sendEvolutionMessage(senderNumber, "Desculpe, o agente de IA encontrou um erro interno ao processar sua mensagem.");
        }

    } catch (error) {
        console.error("[WEBHOOK ERROR] Failed to call Edge Function or send message:", error);
        await sendEvolutionMessage(senderNumber, "Desculpe, houve um erro de comunicação com o servidor de IA.");
    }
    
    return res.sendStatus(200);
});

app.listen(PORT, HOST, () => {
    console.log(`WhatsApp Backend (Evolution API) running on http://${HOST}:${PORT}`);
});