import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@1.31.0"

// Configuração de CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Definições de Ferramentas (Tools) - Replicadas do GeminiService do frontend
const toolsDef = [
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // O payload agora inclui a mensagem, o remetente e a configuração do agente
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

    // 1. Chamar o Gemini
    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: toolsDef }],
        },
        // Em um cenário real, o histórico de conversas seria carregado do banco de dados
        history: [] 
    });

    const result = await chat.sendMessage({ message });
    
    let aiResponseText = result.text || "O agente processou a mensagem, mas não gerou uma resposta de texto.";
    
    // 2. Retornar a resposta do Gemini
    return new Response(
      JSON.stringify({ 
        status: 'success', 
        response: aiResponseText,
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