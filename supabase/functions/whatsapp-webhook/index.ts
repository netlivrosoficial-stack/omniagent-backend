import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { GoogleGenAI, Type, FunctionDeclaration, Part } from "https://esm.sh/@google/genai@1.31.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Configuração de CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Inicializa o cliente Supabase
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
  },
  {
    name: "check_stock",
    description: "Verifica o status do inventário de um produto.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "Nome do produto" }
      },
      required: ["productName"]
    }
  },
  {
    name: "send_file",
    description: "Envia um arquivo (PDF, Imagem) para o usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileType: { type: Type.STRING, description: "pdf, imagem, áudio, vídeo" },
        fileName: { type: Type.STRING, description: "Nome do arquivo a ser enviado" }
      },
      required: ["fileType", "fileName"]
    }
  }
];

// Função para executar a chamada de ferramenta
async function handleToolCall(name: string, args: any): Promise<string> {
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

            if (error) {
                console.error("Supabase Error (save_lead):", error);
                return `Erro ao salvar lead: ${error.message}`;
            }
            
            return `Lead salvo com sucesso. ID: ${data[0].id}`;

        case 'create_ticket':
            // Lógica de simulação para criação de ticket
            return `Ticket de suporte criado com sucesso na categoria ${args.category}.`;
            
        case 'check_stock':
            // Lógica de simulação para checagem de estoque
            return `O produto ${args.productName} está em estoque.`;
            
        case 'send_file':
            // Lógica de simulação para envio de arquivo
            return `Arquivo ${args.fileName} do tipo ${args.fileType} enviado ao usuário.`;

        default:
            return `Ferramenta desconhecida: ${name}`;
    }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { message, sender, agentConfig } = await req.json();
    
    if (!agentConfig) {
        throw new Error("Agent configuration is missing in the request body.");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set.");
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    let finalSystemInstruction = agentConfig.systemInstruction;
    
    // Adicionar dados de treinamento ao prompt do sistema
    if (agentConfig.trainingData && agentConfig.trainingData.length > 0) {
        const knowledgeBase = agentConfig.trainingData
          .map((item: any) => `- ${item.content}`)
          .join('\n');
        
        finalSystemInstruction += `\n\n# BASE DE CONHECIMENTO ADICIONAL\nUse as informações a seguir para responder a perguntas relevantes. Estas são as fontes de verdade primárias:\n${knowledgeBase}`;
    }

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
    
    // Primeira chamada: Envia a mensagem de texto
    result = await chat.sendMessage({ message: message });
    
    // Loop de Tool Calling (máximo 5 iterações para evitar loops infinitos)
    for (let i = 0; i < 5; i++) {
        
        if (!result) {
            aiResponseText = "Erro: Resposta vazia do modelo.";
            break;
        }
        
        if (result.functionCalls && result.functionCalls.length > 0) {
            toolCallsExecuted = true;
            const toolResponses: Part[] = [];
            
            for (const fc of result.functionCalls) {
                const toolResult = await handleToolCall(fc.name, fc.args);
                
                toolResponses.push({
                    functionResponse: {
                        name: fc.name,
                        response: {
                            result: toolResult, // CORRIGIDO: Usando 'result' em vez de 'content'
                        },
                    },
                });
            }
            
            // Envia as respostas das ferramentas de volta ao Gemini
            result = await chat.sendMessage({ parts: toolResponses });
            
        } else {
            // O Gemini respondeu com texto final
            aiResponseText = result.text || "O agente processou a mensagem, mas não gerou uma resposta de texto.";
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})