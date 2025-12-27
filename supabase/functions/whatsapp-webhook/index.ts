import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { GoogleGenAI, Type, FunctionDeclaration, Part } from "https://esm.sh/@google/genai@1.31.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Configuração de CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Inicializa o cliente Supabase (usando a chave anônima, mas o backend usa a Service Role Key)
const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Definições de Ferramentas (Tools)
const toolsDef: FunctionDeclaration[] = [
  {
    name: "save_lead",
    description: "Salva um novo lead no banco de dados quando um usuário demonstra interesse ou fornece informações de contato.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do lead" },
        phone: { type: Type.STRING, description: "Número de telefone" },
        origin: { type: Type.STRING, description: "Fonte do lead (ex: whatsapp, instagram)" },
        interestLevel: { type: Type.STRING, description: "Alto, Médio ou Baixo" }
      },
      required: ["name", "phone"]
    }
  },
  {
    name: "create_ticket",
    description: "Cria um ticket de suporte quando um usuário tem um problema técnico que não pode ser resolvido imediatamente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Categoria do problema (ex: login, pagamento, bug)" },
        message: { type: Type.STRING, description: "Descrição do problema" },
        priority: { type: Type.STRING, description: "Nível de urgência" }
      },
      required: ["category", "message"]
    }
  }
];

// Função para executar a chamada de ferramenta (SIMULAÇÃO para o Gemini)
// NOTA: Esta função é chamada APENAS pelo Simulador do Frontend.
// O backend Node.js (server.js) tem sua própria implementação de handleToolCall.
async function handleToolCall(name: string, args: any): Promise<string> {
    switch (name) {
        case 'save_lead':
            // No contexto da Edge Function, apenas simulamos o resultado para o Gemini continuar
            return `A função save_lead foi executada com sucesso no banco de dados.`;

        case 'create_ticket':
            return `Ticket de suporte criado com sucesso na categoria ${args.category}.`;
            
        default:
            return `Ferramenta desconhecida: ${name}`;
    }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const body = await req.json();
    const { message, sender, agentConfig } = body;
    
    console.log(`[WEBHOOK] Received message: "${message}" from sender: ${sender}`);
    
    if (!agentConfig) {
        throw new Error("Agent configuration is missing in the request body.");
    }

    // A Edge Function agora usa a chave de API passada no payload (do server.js ou do frontend)
    const GEMINI_API_KEY = agentConfig.apiKey;
    
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY não configurada no payload.");
    }
    
    console.log(`[GEMINI] API Key status: Present`);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    let finalSystemInstruction = agentConfig.systemInstruction;
    
    // A lógica de adicionar dados de treinamento foi removida daqui, pois o RAG será externo.
    // if (agentConfig.trainingData && agentConfig.trainingData.length > 0) {
    //     const knowledgeBase = agentConfig.trainingData
    //       .map((item: any) => `- ${item.content}`)
    //       .join('\n');
    //     
    //     finalSystemInstruction += `\n\n# BASE DE CONHECIMENTO ADICIONAL\nUse as informações a seguir para responder a perguntas relevantes. Estas são as fontes de verdade primárias:\n${knowledgeBase}`;
    // }

    // 1. Iniciar o chat com a configuração do agente
    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: toolsDef }],
        },
        history: [] 
    });

    let aiResponseText = "";
    let toolCallsExecuted = false;
    let result;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
        throw new Error("A mensagem de entrada está vazia ou inválida.");
    }
    
    console.log(`[GEMINI] Sending message to model: "${message}"`);
    
    // Chamada inicial
    result = await chat.sendMessage({ message: [{ text: message }] });
    
    // Loop de Tool Calling (máximo 5 iterações para evitar loops infinitos)
    for (let i = 0; i < 5; i++) {
        
        if (result.functionCalls && result.functionCalls.length > 0) {
            toolCallsExecuted = true;
            const toolResponses: Part[] = [];
            
            for (const fc of result.functionCalls) {
                console.log(`[TOOL CALL] Executing tool: ${fc.name} with args: ${JSON.stringify(fc.args)}`);
                // Usamos a função de simulação local, pois a execução real do Supabase
                // é feita pelo backend Node.js (server.js) para o OpenAI.
                const toolResult = await handleToolCall(fc.name, fc.args); 
                console.log(`[TOOL RESULT] Result for ${fc.name}: ${toolResult}`);
                
                toolResponses.push({
                    functionResponse: {
                        name: fc.name,
                        response: {
                            result: toolResult,
                        },
                    },
                });
            }
            
            // Envia as respostas das ferramentas de volta ao Gemini
            result = await chat.sendMessage({ message: toolResponses });
            
        } else {
            // O Gemini respondeu com texto final
            aiResponseText = result.text || "O agente processou a mensagem, mas não gerou uma resposta de texto.";
            console.log(`[GEMINI] Final response text: ${aiResponseText}`);
            break;
        }
    }

    // 2. Retornar a resposta final
    return new Response(
      JSON.stringify({ 
        status: 'success', 
        response: aiResponseText,
        toolCallsExecuted: toolCallsExecuted,
        processedBy: 'OmniAgent Edge Function (Gemini)'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    // Retorna o erro com status 400 e a mensagem de erro
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})