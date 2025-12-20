const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai');

// --- Configuration ---
// ALTERADO: Porta padrão agora é 8080 para alinhar com o Easypanel
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

const BACKEND_PUBLIC_URL = process.env.FLY_APP_URL; 

// AI Config
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID || !BACKEND_PUBLIC_URL) {
	console.error("Missing required environment variables.");
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

// --- ROTA DE DIAGNÓSTICO (NOVA) ---
// Isso remove o erro "Cannot GET /" e confirma que o backend está vivo
app.get('/', (req, res) => {
    res.status(200).json({
        status: "online",
        message: "Omniagent Backend is running",
        timestamp: new Date().toISOString()
    });
});

// --- Tool Definitions (OpenAI format) ---
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
                .insert([{ 
                    name: leadName, 
                    phone: phone, 
                    origin: origin || 'whatsapp', 
                    interest_level: interestLevel || 'Médio' 
                }])
                .select();
            if (error) return `Erro ao salvar lead: ${error.message}`;
            return `Lead salvo com sucesso. ID: ${data[0].id}`;
        case 'create_ticket':
            return `Ticket de suporte criado com sucesso na categoria ${args.category}.`;
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
		const errorMessage = error.response?.data?.message || error.message;
		console.error(`[EVOLUTION API ERROR] ${method} ${endpoint}:`, errorMessage);
		throw new Error(`Evolution API call failed: ${errorMessage}`);
	}
}

async function updateSessionStatus(userId, status, qrCodeData = null) {
	const updatePayload = {
		status: status,
		last_updated: new Date().toISOString(),
		qr_code_data: qrCodeData,
	};
	const { data, error } = await supabase
		.from('whatsapp_sessions')
		.upsert({ user_id: userId, ...updatePayload }, { onConflict: 'user_id' });
	if (error) console.error(`[DB ERROR]`, error);
	return { success: !error };
}

async function getAgentConfig(userId) {
	const { data, error } = await supabase
		.from('agent_configs')
		.select('config')
		.eq('user_id', userId)
		.single();
	return data ? data.config : null;
}

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

async function processMessageWithOpenAI(messageBody, agentConfig) {
    const apiKey = OPENAI_API_KEY_ENV || agentConfig.openAIApiKey;
    const openai = new OpenAI({ apiKey });
    let finalSystemInstruction = agentConfig.systemInstruction;
    if (agentConfig.trainingData?.length > 0) {
        const kb = agentConfig.trainingData.map(item => `- ${item.content}`).join('\n');
        finalSystemInstruction += `\n\n# CONHECIMENTO:\n${kb}`;
    }
    let messages = [
        { role: "system", content: finalSystemInstruction },
        { role: "user", content: messageBody }
    ];
    let aiResponseText = "";
    for (let i = 0; i < 5; i++) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: toolsDefOpenAI,
        });
        const msg = response.choices[0].message;
        if (msg.tool_calls) {
            messages.push(msg);
            for (const tool of msg.tool_calls) {
                const result = await handleToolCall(tool.function.name, JSON.parse(tool.function.arguments));
                messages.push({ tool_call_id: tool.id, role: "tool", name: tool.function.name, content: result });
            }
        } else {
            aiResponseText = msg.content;
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

app.post('/webhook/evolution', async (req, res) => {
	const events = req.body;
	if (!Array.isArray(events)) return res.sendStatus(200);
	for (const event of events) {
		const { event: eventName, instance, data } = event;
		const userId = instance.instanceName;
		if (!userId) continue;

		if (eventName === 'QRCODE_UPDATED' || eventName === 'CONNECTION_UPDATE') {
			let status = data.state === 'CONNECTED' ? 'connected' : (data.state === 'DISCONNECTED' ? 'disconnected' : 'connecting');
			await updateSessionStatus(userId, status, data.qrcode || data.code || null);
		}

		if (eventName === 'MESSAGES_UPDATE' && data.messages) {
			for (const msg of data.messages) {
				if (msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;
				const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
				if (!messageBody) continue;

				const agentConfig = await getAgentConfig(userId);
				if (!agentConfig) continue;

				try {
					const aiData = agentConfig.aiProvider === 'openai' 
						? await processMessageWithOpenAI(messageBody, agentConfig)
						: await processMessageWithGemini(messageBody, agentConfig);
					
					await callEvolutionApi('/send/text', 'POST', {
						number: msg.key.remoteJid.split('@')[0],
						textMessage: { text: aiData.response || "Sem resposta da IA." }
					});
				} catch (err) {
					console.error("Webhook processing error:", err);
				}
			}
		}
	}
	return res.status(200).send('OK');
});

app.listen(PORT, HOST, () => {
    console.log(`Server is up on http://${HOST}:${PORT}`);
});