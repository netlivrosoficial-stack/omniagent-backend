const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// --- Configuration ---
const PORT = process.env.PORT || 3000; // Usando 3000 como padrão para EasyPanel/Hostinger
const HOST = '0.0.0.0'; 

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

// Evolution API Config
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;

// Public URL of this backend (used for Evolution webhooks)
const BACKEND_PUBLIC_URL = process.env.FLY_APP_URL; 

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID || !BACKEND_PUBLIC_URL) {
    console.error("Missing required environment variables for Supabase or Evolution API.");
    // Não saímos do processo para permitir que o Hostinger/EasyPanel inicie o container, mas logamos o erro.
}

// Initialize Supabase client with Service Role Key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
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

// --- Evolution API Helpers ---

const evolutionHeaders = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY,
};

async function callEvolutionApi(endpoint, method = 'GET', data = null) {
    const url = `${EVOLUTION_BASE_URL}/instance/${EVOLUTION_INSTANCE_ID}${endpoint}`;
    try {
        const response = await axios({
            method,
            url,
            headers: evolutionHeaders,
            data,
            timeout: 10000 // 10 seconds timeout
        });
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`[EVOLUTION API ERROR] ${method} ${endpoint}:`, errorMessage);
        throw new Error(`Evolution API call failed for ${endpoint}: ${errorMessage}`);
    }
}

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
    return { success: true, data: data };
}

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
    
    return data ? data.config : null;
}

// Function to register the webhook URL with Evolution API
async function registerWebhook() {
    const webhookUrl = `${BACKEND_PUBLIC_URL}/webhook`;
    console.log(`[EVOLUTION] Registering webhook URL: ${webhookUrl}`);
    
    try {
        // Evolution API endpoint to set webhooks
        const response = await callEvolutionApi('/webhook', 'POST', {
            webhookUrl: webhookUrl,
            // Eventos essenciais para o fluxo:
            enabledEvents: ["MESSAGES_UPDATE", "QRCODE_UPDATED", "CONNECTION_UPDATE"] 
        });
        console.log("[EVOLUTION] Webhook registered successfully.");
        return response;
    } catch (e) {
        console.error("[EVOLUTION] Failed to register webhook. This might prevent message reception.", e.message);
    }
}

// --- API Endpoints ---

// Endpoint to start the connection process (Get QR Code)
app.post('/api/whatsapp/start', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    try {
        // 1. Call Evolution API to start the instance connection
        const evolutionResponse = await callEvolutionApi('/connect', 'POST');
        
        // 2. Check if QR code or status is immediately available
        let qrCodeData = evolutionResponse.qrcode || evolutionResponse.code || null;
        let status = 'connecting';
        
        if (evolutionResponse.state === 'CONNECTED') {
            status = 'connected';
            qrCodeData = null;
        }
        
        // 3. Update Supabase session status
        await updateSessionStatus(userId, status, qrCodeData);
        
        return res.json({ 
            status: 'starting', 
            message: 'Evolution API connection process started.',
            evolutionResponse: evolutionResponse
        });
    } catch (e) {
        console.error("Failed to start Evolution API client:", e);
        return res.status(500).json({ error: e.message });
    }
});

// Endpoint to disconnect the session (Logout)
app.post('/api/whatsapp/disconnect', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }
    
    try {
        // 1. Call Evolution API to disconnect/logout
        await callEvolutionApi('/disconnect', 'DELETE');
        console.log(`Evolution instance ${EVOLUTION_INSTANCE_ID} disconnected.`);
        
        // 2. Update Supabase status to disconnected
        const dbUpdateResult = await updateSessionStatus(userId, 'disconnected', null);
        
        if (dbUpdateResult.success) {
            // 3. Immediately restart the connection process to generate a new QR code
            console.log(`[DISCONNECT] Successfully disconnected. Starting new session for user ${userId}.`);
            
            // Call the start endpoint logic internally
            const evolutionResponse = await callEvolutionApi('/connect', 'POST');
            
            let qrCodeData = evolutionResponse.qrcode || evolutionResponse.code || null;
            let status = 'connecting';
            
            if (evolutionResponse.state === 'CONNECTED') {
                status = 'connected';
                qrCodeData = null;
            }
            
            await updateSessionStatus(userId, status, qrCodeData);
            
            return res.json({ status: 'restarting', message: 'Session disconnected and new connection process started.' });
        } else {
            return res.status(500).json({ error: `Failed to update session status in database: ${dbUpdateResult.error}` });
        }
    } catch (e) {
        console.error("Failed to disconnect Evolution API client:", e);
        return res.status(500).json({ error: e.message });
    }
});

// --- Evolution API Webhook Receiver ---
app.post('/webhook', async (req, res) => {
    const events = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
        return res.status(200).send('No events received.');
    }
    
    for (const event of events) {
        const { event: eventName, instance, data } = event;
        
        // Evolution API usa 'instanceName' para identificar a instância, que deve ser o userId
        const userId = instance.instanceName; 
        
        if (!userId) {
            console.error("[WEBHOOK] Event received without instanceName (userId). Skipping.");
            continue;
        }

        console.log(`[WEBHOOK] Received event: ${eventName} for user: ${userId}`);

        // 1. Handle Connection Status Updates (QR Code, Connected, Disconnected)
        if (eventName === 'QRCODE_UPDATED' || eventName === 'CONNECTION_UPDATE') {
            let status = 'connecting';
            let qrCodeData = null;
            
            if (data.state === 'CONNECTED') {
                status = 'connected';
            } else if (data.state === 'DISCONNECTED') {
                status = 'disconnected';
            } else if (data.qrcode) {
                qrCodeData = data.qrcode;
            } else if (data.code) {
                qrCodeData = data.code; // Code linking
            }
            
            await updateSessionStatus(userId, status, qrCodeData);
        }

        // 2. Handle Incoming Messages
        if (eventName === 'MESSAGES_UPDATE' && data.messages && data.messages.length > 0) {
            for (const msg of data.messages) {
                // Ignora mensagens de status, grupos, ou mensagens enviadas pelo bot
                if (msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;
                
                const senderNumber = msg.key.remoteJid;
                const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                
                if (!messageBody) continue; // Apenas processa mensagens de texto

                console.log(`[WEBHOOK] Message received from ${senderNumber}: ${messageBody}`);

                // A Evolution API usa o número completo (ex: 5511999999999@s.whatsapp.net)
                const senderNumberClean = senderNumber.split('@')[0]; 

                // 2.1. Buscar a configuração do agente
                const agentConfig = await getAgentConfig(userId);
                
                if (!agentConfig) {
                    console.error(`[WEBHOOK] Agent config not available for user ${userId}. Cannot process message.`);
                    // Envia mensagem de erro de volta via Evolution API
                    await callEvolutionApi('/send/text', 'POST', {
                        number: senderNumberClean, 
                        textMessage: {
                            text: "Desculpe, a configuração do agente não está disponível. Por favor, verifique o painel de controle."
                        }
                    });
                    continue;
                }
                
                // 2.2. Chamar a Edge Function do Supabase
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

                    const aiData = await response.json();

                    if (response.ok && aiData.response) {
                        console.log(`[WEBHOOK] Edge Function Response: ${aiData.response}`);
                        // 2.3. Enviar a resposta de volta usando a Evolution API
                        await callEvolutionApi('/send/text', 'POST', {
                            number: senderNumberClean,
                            textMessage: {
                                text: aiData.response
                            }
                        });
                    } else {
                        console.error(`[WEBHOOK] Edge Function failed or returned no text response. Error: ${aiData.error || 'No response text.'}`);
                        await callEvolutionApi('/send/text', 'POST', {
                            number: senderNumberClean,
                            textMessage: {
                                text: "Desculpe, o agente de IA encontrou um erro interno ao processar sua mensagem."
                            }
                        });
                    }

                } catch (error) {
                    console.error("[WEBHOOK ERROR] Failed to call Edge Function or send message:", error);
                    await callEvolutionApi('/send/text', 'POST', {
                        number: senderNumberClean,
                        textMessage: {
                            text: "Desculpe, houve um erro de comunicação com o servidor de IA."
                        }
                    });
                }
            }
        }
    }
    
    return res.status(200).send('Webhook processed.');
});


// --- Server Initialization ---

function shutdown(signal) {
    console.log(`[SHUTDOWN] Received signal: ${signal}. Shutting down...`);
    setTimeout(() => {
        process.exit(0);
    }, 500); 
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, HOST, async () => {
    console.log(`Evolution API Backend running on http://${HOST}:${PORT}`);
    // Register webhook on startup
    if (BACKEND_PUBLIC_URL) {
        await registerWebhook();
    } else {
        console.warn("BACKEND_PUBLIC_URL (FLY_APP_URL) is missing. Webhook registration skipped. Please set this variable.");
    }
});