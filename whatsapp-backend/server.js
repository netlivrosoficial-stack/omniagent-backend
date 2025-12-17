const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai'); // Importando o SDK do OpenAI

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

// Public URL of this backend (used for Evolution webhooks)
const BACKEND_PUBLIC_URL = process.env.FLY_APP_URL; 

// AI Config (Variáveis de ambiente para chaves de API)
const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_ID || !BACKEND_PUBLIC_URL) {
	console.error("Missing required environment variables for Supabase or Evolution API.");
}

// Initialize Supabase client with Service Role Key
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

// --- Tool Definitions (OpenAI format) ---
const toolsDefOpenAI = [
    {
        type: "function",
        function: {
            name: "save_lead",
            description: "Salva um novo lead no banco de dados quando um usuário demonstra interesse ou fornece informações de contato.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Nome do lead" },
                    phone: { type: "string", description: "Número de telefone" },
                    origin: { type: "string", description: "Fonte do lead (ex: whatsapp, instagram)" },
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
            description: "Cria um ticket de suporte quando um usuário tem um problema técnico que não pode ser resolvido imediatamente.",
            parameters: {
                type: "object",
                properties: {
                    category: { type: "string", description: "Categoria do problema (ex: login, pagamento, bug)" },
                    message: { type: "string", description: "Descrição do problema" },
                    priority: { type: "string", description: "Nível de urgência" }
                },
                required: ["category", "message"]
            }
        }
    }
];

// --- Centralized Tool Execution Function ---
async function handleToolCall(name, args) {
    switch (name) {
        case 'save_lead':
            const { name: leadName, phone, origin, interestLevel } = args;
            
            // Usando o cliente Supabase com a chave de serviço (Service Role Key)
            const { data, error } = await supabase
                .from('leads')
                .insert([{ 
                    name: leadName, 
                    phone: phone, 
                    origin: origin || 'whatsapp', 
                    interest_level: interestLevel || 'Médio' 
                }])
                .select();

            if (error) {
                console.error("Supabase Error (save_lead):", error);
                return `Erro ao salvar lead: ${error.message}`;
            }
            
            return `Lead salvo com sucesso. ID: ${data[0].id}`;

        case 'create_ticket':
            // Lógica de simulação para criação de ticket
            return `Ticket de suporte criado com sucesso na categoria ${args.category}.`;
            
        default:
            return `Ferramenta desconhecida: ${name}`;
    }
}


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

// --- API Endpoints ---

app.post('/api/whatsapp/start', async (req, res) => {
	const { userId } = req.body;
	
	if (!userId) {
		return res.status(400).json({ error: 'Missing userId' });
	}
	
	try {
		const evolutionResponse = await callEvolutionApi('/connect', 'POST');
		
		let qrCodeData = evolutionResponse.qrcode || evolutionResponse.code || null;
		let status = 'connecting';
		
		if (evolutionResponse.state === 'CONNECTED') {
			status = 'connected';
			qrCodeData = null;
		}
		
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

app.post('/api/whatsapp/disconnect', async (req, res) => {
	const { userId } = req.body;
	
	if (!userId) {
		return res.status(400).json({ error: 'Missing userId' });
	}
	
	try {
		await callEvolutionApi('/disconnect', 'DELETE');
		console.log(`Evolution instance ${EVOLUTION_INSTANCE_ID} disconnected.`);
		
		const dbUpdateResult = await updateSessionStatus(userId, 'disconnected', null);
		
		if (dbUpdateResult.success) {
			console.log(`[DISCONNECT] Successfully disconnected. Starting new session for user ${userId}.`);
			
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

// --- OpenAI Logic ---

async function processMessageWithOpenAI(messageBody, agentConfig) {
    const apiKey = OPENAI_API_KEY_ENV || agentConfig.openAIApiKey;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY não configurada no ambiente ou no painel.");
    }
    
    const openai = new OpenAI({ apiKey });
    const model = "gpt-4o-mini"; // Modelo eficiente para funções
    
    let finalSystemInstruction = agentConfig.systemInstruction;
    
    if (agentConfig.trainingData && agentConfig.trainingData.length > 0) {
        const knowledgeBase = agentConfig.trainingData
          .map(item => `- ${item.content}`)
          .join('\n');
        
        finalSystemInstruction += `\n\n# BASE DE CONHECIMENTO ADICIONAL\nUse as informações a seguir para responder a perguntas relevantes. Estas são as fontes de verdade primárias:\n${knowledgeBase}`;
    }
    
    let messages = [
        { role: "system", content: finalSystemInstruction },
        { role: "user", content: messageBody }
    ];
    
    let aiResponseText = "";
    let toolCallsExecuted = false;
    
    for (let i = 0; i < 5; i++) { // Loop de Tool Calling
        const response = await openai.chat.completions.create({
            model: model,
            messages: messages,
            tools: toolsDefOpenAI,
            tool_choice: "auto",
        });
        
        const responseMessage = response.choices[0].message;
        
        if (responseMessage.tool_calls) {
            toolCallsExecuted = true;
            messages.push(responseMessage); // Adiciona a resposta do assistente com as chamadas de função
            
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`[OPENAI TOOL CALL] Executing tool: ${functionName} with args: ${JSON.stringify(functionArgs)}`);
                const toolResult = await handleToolCall(functionName, functionArgs);
                console.log(`[OPENAI TOOL RESULT] Result for ${functionName}: ${toolResult}`);
                
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult,
                });
            }
        } else {
            aiResponseText = responseMessage.content || "O agente processou a mensagem, mas não gerou uma resposta de texto.";
            break;
        }
    }
    
    return { response: aiResponseText, toolCallsExecuted };
}

// --- Gemini Logic (Chama a Edge Function) ---

async function processMessageWithGemini(messageBody, agentConfig) {
    const apiKey = GEMINI_API_KEY_ENV || agentConfig.apiKey;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY não configurada no ambiente ou no painel.");
    }
    
    // Chama a Edge Function do Supabase, passando a chave e a configuração
    const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: messageBody,
            sender: 'whatsapp-backend', // Identificador
            agentConfig: { ...agentConfig, apiKey: apiKey }, // Passa a chave para a Edge Function
        }),
    });

    const aiData = await response.json();

    if (!response.ok) {
        throw new Error(aiData.error || 'Erro desconhecido na Edge Function do Gemini.');
    }
    
    return { response: aiData.response, toolCallsExecuted: aiData.toolCallsExecuted };
}


// --- Evolution API Webhook Receiver ---
// CORREÇÃO: Mapeando para o novo endpoint /webhook/evolution
app.post('/webhook/evolution', async (req, res) => {
	const events = req.body;
	
	if (!Array.isArray(events) || events.length === 0) {
		return res.status(200).send('No events received.');
	}
	
	for (const event of events) {
		const { event: eventName, instance, data } = event;
		
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
				if (msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;
				
				const senderNumber = msg.key.remoteJid;
				const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
				
				if (!messageBody) continue;

				console.log(`[WEBHOOK] Message received from ${senderNumber}: ${messageBody}`);

				const senderNumberClean = senderNumber.split('@')[0];	

				// 2.1. Buscar a configuração do agente
				const agentConfig = await getAgentConfig(userId);
				
				if (!agentConfig) {
					console.error(`[WEBHOOK] Agent config not available for user ${userId}. Cannot process message.`);
					await callEvolutionApi('/send/text', 'POST', {
						number: senderNumberClean,	
						textMessage: {
							text: "Desculpe, a configuração do agente não está disponível. Por favor, verifique o painel de controle."
						}
					});
					continue;
				}
				
				// 2.2. Chamar o provedor de IA selecionado
				let aiData = { response: null, toolCallsExecuted: false };
				try {
                    if (agentConfig.aiProvider === 'openai') {
                        console.log(`[WEBHOOK] Routing to OpenAI...`);
                        aiData = await processMessageWithOpenAI(messageBody, agentConfig);
                    } else {
                        console.log(`[WEBHOOK] Routing to Gemini Edge Function...`);
                        aiData = await processMessageWithGemini(messageBody, agentConfig);
                    }
                    
                    if (aiData.response) {
						console.log(`[WEBHOOK] AI Response: ${aiData.response}`);
						// 2.3. Enviar a resposta de volta usando a Evolution API
						await callEvolutionApi('/send/text', 'POST', {
							number: senderNumberClean,
							textMessage: {
								text: aiData.response
							}
						});
					} else {
						console.error(`[WEBHOOK] AI returned no text response.`);
						await callEvolutionApi('/send/text', 'POST', {
							number: senderNumberClean,
							textMessage: {
								text: "Desculpe, o agente de IA processou a mensagem, mas não gerou uma resposta de texto."
							}
						});
					}

				} catch (error) {
					console.error("[WEBHOOK ERROR] Failed to call AI or send message:", error);
					await callEvolutionApi('/send/text', 'POST', {
						number: senderNumberClean,
						textMessage: {
							text: `Desculpe, houve um erro de comunicação com o servidor de IA: ${error.message}`
						}
					});
				}
			}
		}
	}
	
	return res.status(200).send('Webhook processed.');
});


// --- Server Initialization ---

try {
    app.listen(PORT, HOST, async () => {
        console.log(`Evolution API Backend running on http://${HOST}:${PORT}`);
    });
} catch (error) {
    console.error('ERRO CRÍTICO NA INICIALIZAÇÃO DO SERVIDOR (ANTES DO LISTEN):', error); 
    process.exit(1); 
}