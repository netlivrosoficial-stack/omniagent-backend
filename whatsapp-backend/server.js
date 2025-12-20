const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai');

// --- Configuration ---
const PORT = process.env.PORT || 8080; 
const HOST = '0.0.0.0'; 

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

// Evolution API Config
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;

// AI Config
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;

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
    }
];

async function handleToolCall(name, args) {
    switch (name) {
        case 'save_lead':
            const { name: leadName, phone, origin, interestLevel } = args;
            const { data, error } = await supabase
                .from('leads')
                .insert([{ 
                    name: leadName, 
                    phone: phone, 
                    origin: origin || 'whatsapp', 
                    interest_level: interestLevel || 'Médio' 
                }])
                .select();
            if (error) return `Erro ao salvar lead: ${error.message}`;
            return `Lead salvo com sucesso. ID: ${data[0].id}`;
        default:
            return `Ferramenta desconhecida: ${name}`;
    }
}

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
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[EVOLUTION API ERROR] ${method} ${endpoint}:`, error.message);
        throw error;
    }
}

async function updateSessionStatus(userId, status, qrCodeData = null) {
    const { error } = await supabase
        .from('whatsapp_sessions')
        .upsert({ 
            user_id: userId, 
            status: status, 
            last_updated: new Date().toISOString(),
            qr_code_data: qrCodeData 
        }, { onConflict: 'user_id' });
    if (error) console.error(`[DB ERROR]`, error);
}

async function getAgentConfig(userId) {
    const { data } = await supabase
        .from('agent_configs')
        .select('config')
        .eq('user_id', userId)
        .single();
    return data ? data.config : null;
}

// --- API Endpoints para Conexão ---

app.post('/api/whatsapp/start', async (req, res) => {
	const { userId } = req.body;
	if (!userId) return res.status(400).json({ error: 'Missing userId' });
	try {
		const evolutionResponse = await callEvolutionApi('/connect', 'POST');
		let qrCodeData = evolutionResponse.qrcode || evolutionResponse.code || null;
		let status = evolutionResponse.state === 'CONNECTED' ? 'connected' : 'connecting';
		await updateSessionStatus(userId, status, qrCodeData);
		return res.json({ status: 'starting', evolutionResponse });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
	const { userId } = req.body;
	if (!userId) return res.status(400).json({ error: 'Missing userId' });
	try {
		await callEvolutionApi('/disconnect', 'DELETE');
		await updateSessionStatus(userId, 'disconnected', null);
		const evolutionResponse = await callEvolutionApi('/connect', 'POST');
		let qrCodeData = evolutionResponse.qrcode || evolutionResponse.code || null;
		let status = evolutionResponse.state === 'CONNECTED' ? 'connected' : 'connecting';
		await updateSessionStatus(userId, status, qrCodeData);
		return res.json({ status: 'restarting' });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

// --- Funções de Processamento de IA ---

async function processMessageWithOpenAI(messageBody, agentConfig) {
    const apiKey = OPENAI_API_KEY_ENV || agentConfig.openAIApiKey;
    const openai = new OpenAI({ apiKey });
    
    let finalSystemInstruction = agentConfig.systemInstruction;
    if (agentConfig.trainingData?.length > 0) {
        const kb = agentConfig.trainingData.map(item => `- ${item.content}`).join('\n');
        finalSystemInstruction += `\n\n# BASE DE CONHECIMENTO ADICIONAL\nUse as informações a seguir para responder a perguntas relevantes. Estas são as fontes de verdade primárias:\n${kb}`;
    }
    
    let messages = [
        { role: "system", content: finalSystemInstruction },
        { role: "user", content: messageBody }
    ];
    
    let aiResponseText = "";
    
    // Loop de Tool Calling (máximo 5 iterações)
    for (let i = 0; i < 5; i++) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: toolsDefOpenAI,
        });
        
        const responseMessage = response.choices[0].message;
        
        if (responseMessage.tool_calls) {
            messages.push(responseMessage);
            
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                const toolResult = await handleToolCall(functionName, functionArgs);
                
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult,
                });
            }
        } else {
            aiResponseText = responseMessage.content;
            break;
        }
    }
    return { response: aiResponseText };
}

async function processMessageWithGemini(messageBody, agentConfig) {
    const apiKey = GEMINI_API_KEY_ENV || agentConfig.apiKey;
    const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageBody, sender: 'whatsapp-backend', agentConfig: { ...agentConfig, apiKey } }),
    });
    
    const aiData = await response.json();

    if (!response.ok) {
        throw new Error(aiData.error || 'Erro desconhecido na Edge Function do Gemini.');
    }
    
    return { response: aiData.response, toolCallsExecuted: aiData.toolCallsExecuted };
}

// --- Função centralizada para o Webhook ---
async function handleWebhook(req, res) {
    // Evolution envia um objeto único, não necessariamente um array
    const event = req.body;
    
    if (!event || !event.event) {
        return res.status(200).send('Event ignored');
    }

    const eventName = event.event;
    const instanceName = event.instance; // Em v2 o instance costuma vir como string ou objeto
    const userId = typeof instanceName === 'object' ? instanceName.instanceName : instanceName;
    const data = event.data;

    console.log(`[WEBHOOK] Evento recebido: ${eventName} para instância: ${userId}`);

    // Atualização de Conexão
    if (eventName === 'QRCODE_UPDATED' || eventName === 'CONNECTION_UPDATE') {
        let status = data.state === 'CONNECTED' ? 'connected' : (data.state === 'DISCONNECTED' ? 'disconnected' : 'connecting');
        await updateSessionStatus(userId, status, data.qrcode || data.code || null);
    }

    // Processamento de Mensagens
    if (eventName === 'MESSAGES_UPSERT' || eventName === 'MESSAGES_UPDATE') {
        const msg = data.message || (data.messages && data.messages[0]);
        
        if (msg && !msg.key.fromMe && !msg.key.remoteJid.endsWith('@g.us')) {
            const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            
            if (messageBody) {
                const agentConfig = await getAgentConfig(userId);
                if (agentConfig) {
                    try {
                        const aiData = agentConfig.aiProvider === 'openai' 
                            ? await processMessageWithOpenAI(messageBody, agentConfig)
                            : await processMessageWithGemini(messageBody, agentConfig);
                        
                        const aiResponse = aiData.response;

                        // Enviar resposta de volta para o WhatsApp
                        if (aiResponse) {
                            await callEvolutionApi('/send/text', 'POST', {
                                number: msg.key.remoteJid.split('@')[0],
                                textMessage: { text: aiResponse }
                            });
                        }
                    } catch (err) {
                        console.error("Erro ao processar IA:", err.message);
                        await callEvolutionApi('/send/text', 'POST', {
                            number: msg.key.remoteJid.split('@')[0],
                            textMessage: { text: "Desculpe, houve um erro interno ao processar sua solicitação de IA." }
                        });
                    }
                }
            }
        }
    }

    return res.status(200).send('OK');
}

// --- ROTA DE DIAGNÓSTICO E WEBHOOK RAIZ ---
// Isso resolve o erro 404 se a Evolution chamar a URL sem o final /webhook/evolution
app.get('/', (req, res) => {
    res.status(200).json({
        status: "online",
        message: "Omniagent Backend is running on Easypanel",
        timestamp: new Date().toISOString()
    });
});

// Espelho da rota de webhook na raiz para evitar 404
app.post('/', async (req, res) => {
    console.log("Recebido POST na raiz, redirecionando logicamente para handleWebhook");
    // Redireciona internamente para a função do webhook
    return handleWebhook(req, res);
});

// Mantenha a rota original também por segurança
app.post('/webhook/evolution', handleWebhook);

app.listen(PORT, HOST, () => {
    console.log(`Server is up on http://${HOST}:${PORT}`);
});