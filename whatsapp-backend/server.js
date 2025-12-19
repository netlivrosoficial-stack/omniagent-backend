const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai');

// --- Configuration ---
const PORT = process.env.PORT || 80; 
const HOST = '0.0.0.0'; 

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Evolution API Config
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;

// AI Config
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID) {
    console.error("⚠️ [AVISO] Faltam variáveis de ambiente essenciais.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const app = express();
app.use(express.json({ limit: '50mb' }));

// --- ROTAS DE SAÚDE (Para acabar com o 404 do Easypanel) ---
app.get('/', (req, res) => {
    res.status(200).send('🚀 Backend Omniagente Ativo!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", instance: EVOLUTION_INSTANCE_ID });
});

// CORS setup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// --- Tool Definitions ---
const toolsDefOpenAI = [
    {
        type: "function",
        function: {
            name: "save_lead",
            description: "Salva um novo lead no banco de dados.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    origin: { type: "string" },
                    interestLevel: { type: "string" }
                },
                required: ["name", "phone"]
            }
        }
    }
];

async function handleToolCall(name, args) {
    switch (name) {
        case 'save_lead':
            const { name: leadName, phone, origin, interestLevel } = args;
            const { data, error } = await supabase
                .from('leads')
                .insert([{ name: leadName, phone, origin: origin || 'whatsapp', interest_level: interestLevel || 'Médio' }])
                .select();
            if (error) return `Erro: ${error.message}`;
            return `Lead salvo. ID: ${data[0].id}`;
        default:
            return `Ferramenta desconhecida.`;
    }
}

// --- Evolution API Helpers ---
async function callEvolutionApi(endpoint, method = 'GET', data = null) {
    const url = `${EVOLUTION_BASE_URL}/instance/${EVOLUTION_INSTANCE_ID}${endpoint}`;
    try {
        const response = await axios({ 
            method, 
            url, 
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY }, 
            data, 
            timeout: 15000 
        });
        return response.data;
    } catch (error) {
        console.error(`[EVOLUTION ERROR]:`, error.response?.data || error.message);
        throw error;
    }
}

// --- DB Functions ---
async function updateSessionStatus(userId, status, qrCodeData = null) {
    await supabase.from('whatsapp_sessions').upsert({ 
        user_id: userId, 
        status, 
        qr_code_data: qrCodeData, 
        last_updated: new Date().toISOString() 
    }, { onConflict: 'user_id' });
}

async function getAgentConfig(userId) {
    const { data } = await supabase.from('agent_configs').select('config').eq('user_id', userId).single();
    return data ? data.config : null;
}

// --- OpenAI Logic ---
async function processMessageWithOpenAI(messageBody, agentConfig) {
    const apiKey = OPENAI_API_KEY_ENV || agentConfig.openAIApiKey;
    if (!apiKey) throw new Error("API Key ausente.");
    const openai = new OpenAI({ apiKey });
    
    let messages = [
        { role: "system", content: agentConfig.systemInstruction },
        { role: "user", content: messageBody }
    ];

    for (let i = 0; i < 3; i++) {
        const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, tools: toolsDefOpenAI });
        const resMsg = response.choices[0].message;

        if (resMsg.tool_calls) {
            messages.push(resMsg);
            for (const toolCall of resMsg.tool_calls) {
                const result = await handleToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                messages.push({ tool_call_id: toolCall.id, role: "tool", name: toolCall.function.name, content: result });
            }
        } else {
            return { response: resMsg.content };
        }
    }
}

// --- Webhook Receiver ---
app.post(['/', '/webhook', '/webhook/evolution'], async (req, res) => {
    console.log("📥 [WEBHOOK] Recebido da Evolution API");
    
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
        const { event: eventName, instance, data } = event;
        const userId = typeof instance === 'string' ? instance : (instance?.instanceName || instance?.name);
        
        if (!userId) continue;

        // 1. Conexão
        if (eventName.includes('connection.update') || eventName.includes('QRCODE')) {
            const state = data.state || data.status;
            let status = (state === 'open' || state === 'CONNECTED') ? 'connected' : 'connecting';
            await updateSessionStatus(userId, status, data.qrcode || data.code);
            console.log(`[STATUS] Instância ${userId}: ${status}`);
        }

        // 2. Mensagens
        if (eventName.includes('messages.upsert') || eventName.includes('MESSAGES_UPSERT')) {
            const msg = data.messages ? data.messages[0] : data;
            if (!msg.key || msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;

            const sender = msg.key.remoteJid;
            const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            if (!body) continue;
            console.log(`[MSG] De ${sender}: ${body}`);

            const agentConfig = await getAgentConfig(userId);
            if (!agentConfig) continue;

            try {
                const aiData = (agentConfig.aiProvider === 'openai') 
                    ? await processMessageWithOpenAI(body, agentConfig)
                    : (await axios.post(EDGE_FUNCTION_URL, { message: body, agentConfig })).data;

                if (aiData.response) {
                    await callEvolutionApi('/send/text', 'POST', {
                        number: sender.split('@')[0],
                        textMessage: { text: aiData.response }
                    });
                }
            } catch (err) {
                console.error("[ERRO AI]:", err.message);
            }
        }
    }
    res.status(200).send('OK');
});

app.listen(PORT, HOST, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});