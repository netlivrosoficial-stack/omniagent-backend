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
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

// Evolution API Config
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;

const BACKEND_PUBLIC_URL = process.env.FLY_APP_URL; 

// AI Config
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID) {
	console.error("Missing required environment variables for Supabase or Evolution API.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

const app = express();
app.use(express.json({ limit: '50mb' }));

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

// --- Tool Definitions ---
const toolsDefOpenAI = [
    {
        type: "function",
        function: {
            name: "save_lead",
            description: "Salva um novo lead no banco de dados quando um usuário demonstra interesse.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Nome do lead" },
                    phone: { type: "string", description: "Número de telefone" },
                    origin: { type: "string", description: "Fonte do lead" },
                    interestLevel: { type: "string", description: "Alto, Médio ou Baixo" }
                },
                required: ["name", "phone"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_ticket",
            description: "Cria um ticket de suporte para problemas técnicos.",
            parameters: {
                type: "object",
                properties: {
                    category: { type: "string", description: "Categoria do problema" },
                    message: { type: "string", description: "Descrição do problema" }
                },
                required: ["category", "message"]
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
            if (error) return `Erro ao salvar lead: ${error.message}`;
            return `Lead salvo com sucesso. ID: ${data[0].id}`;
        case 'create_ticket':
            return `Ticket de suporte criado com sucesso na categoria ${args.category}.`;
        default:
            return `Ferramenta desconhecida: ${name}`;
    }
}

// --- Evolution API Helpers ---
const evolutionHeaders = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

async function callEvolutionApi(endpoint, method = 'GET', data = null) {
	const url = `${EVOLUTION_BASE_URL}/instance/${EVOLUTION_INSTANCE_ID}${endpoint}`;
	try {
		const response = await axios({ method, url, headers: evolutionHeaders, data, timeout: 10000 });
		return response.data;
	} catch (error) {
		console.error(`[EVOLUTION API ERROR] ${method} ${endpoint}:`, error.response?.data?.message || error.message);
		throw error;
	}
}

// --- DB Functions ---
async function updateSessionStatus(userId, status, qrCodeData = null) {
	await supabase.from('whatsapp_sessions').upsert({ user_id: userId, status, qr_code_data: qrCodeData, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
}

async function getAgentConfig(userId) {
	const { data } = await supabase.from('agent_configs').select('config').eq('user_id', userId).single();
	return data ? data.config : null;
}

// --- OpenAI Logic ---
async function processMessageWithOpenAI(messageBody, agentConfig) {
    const apiKey = OPENAI_API_KEY_ENV || agentConfig.openAIApiKey;
    if (!apiKey) throw new Error("API Key não encontrada.");
    const openai = new OpenAI({ apiKey });
    let messages = [
        { role: "system", content: agentConfig.systemInstruction },
        { role: "user", content: messageBody }
    ];
    let aiResponseText = "";
    for (let i = 0; i < 5; i++) {
        const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, tools: toolsDefOpenAI });
        const resMsg = response.choices[0].message;
        if (resMsg.tool_calls) {
            messages.push(resMsg);
            for (const toolCall of resMsg.tool_calls) {
                const result = await handleToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
                messages.push({ tool_call_id: toolCall.id, role: "tool", name: toolCall.function.name, content: result });
            }
        } else {
            aiResponseText = resMsg.content;
            break;
        }
    }
    return { response: aiResponseText };
}

// --- Gemini Logic ---
async function processMessageWithGemini(messageBody, agentConfig) {
    const apiKey = GEMINI_API_KEY_ENV || agentConfig.apiKey;
    const response = await axios.post(EDGE_FUNCTION_URL, { message: messageBody, agentConfig: { ...agentConfig, apiKey } });
    return response.data;
}

// --- Evolution API Webhook Receiver (CORREÇÃO DE ROTA E EVENTO) ---
app.post(['/', '/webhook', '/webhook/evolution'], async (req, res) => {
    console.log("-----------------------------------------");
    console.log("!!! WEBHOOK RECEBIDO DO EVOLUTION !!!");
    
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
        const { event: eventName, instance, data } = event;
        
        // Extração robusta do nome da instância
        const userId = typeof instance === 'string' ? instance : (instance?.instanceName || instance?.name);
        
        if (!userId) {
            console.error("[WEBHOOK] Falha ao identificar instância.");
            continue;
        }

        console.log(`[WEBHOOK] Evento: ${eventName} | Instância: ${userId}`);

        // 1. Conexão
        if (eventName === 'QRCODE_UPDATED' || eventName === 'CONNECTION_UPDATE' || eventName === 'connection.update') {
            const state = data.state || data.status;
            let status = (state === 'CONNECTED' || state === 'open') ? 'connected' : 'connecting';
            await updateSessionStatus(userId, status, data.qrcode || data.code);
        }

        // 2. Mensagens (Normalizando formatado v2 e v1)
        if (eventName === 'MESSAGES_UPDATE' || eventName === 'messages.upsert' || eventName === 'messages.update') {
            const messages = data.messages ? data.messages : [data];
            
            for (const msg of messages) {
                if (!msg.key || msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;

                const senderNumber = msg.key.remoteJid;
                const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.text || '';
                
                if (!messageBody) continue;
                console.log(`[WEBHOOK] Mensagem de ${senderNumber}: ${messageBody}`);

                const agentConfig = await getAgentConfig(userId);
                if (!agentConfig) continue;

                try {
                    let aiData = (agentConfig.aiProvider === 'openai') 
                        ? await processMessageWithOpenAI(messageBody, agentConfig)
                        : await processMessageWithGemini(messageBody, agentConfig);

                    if (aiData.response) {
                        await callEvolutionApi('/send/text', 'POST', {
                            number: senderNumber.split('@')[0],
                            textMessage: { text: aiData.response }
                        });
                    }
                } catch (err) {
                    console.error("[WEBHOOK AI ERROR]:", err.message);
                }
            }
        }
    }
    res.status(200).send('OK');
});

// --- Server Initialization ---
app.listen(PORT, HOST, () => {
    console.log(`Backend Ativo na porta ${PORT} - Escutando Evolution API`);
});