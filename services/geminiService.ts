import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { AgentConfig } from "../types";

// Tool Definitions based on the user's prompt
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

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelName = "gemini-2.5-flash";

  constructor(apiKey: string) {
    if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey: apiKey });
    }
  }

  async sendMessage(
    history: { role: string; parts: { text: string }[] }[],
    message: string,
    config: AgentConfig,
    onToolCall: (name: string, args: any) => void
  ) {
    if (!this.ai) {
        throw new Error("O serviço Gemini não foi inicializado. Verifique a chave de API.");
    }
    
    try {
      let finalSystemInstruction = config.systemInstruction;
      
      // A lógica de adicionar trainingData foi removida daqui, pois o RAG será externo.
      // if (config.trainingData && config.trainingData.length > 0) {
      //   const knowledgeBase = config.trainingData
      //     .map(item => `- ${item.content}`)
      //     .join('\n');
      //   
      //   finalSystemInstruction += `\n\n# BASE DE CONHECIMENTO ADICIONAL\nUse as informações a seguir para responder a perguntas relevantes. Estas são as fontes de verdade primárias:\n${knowledgeBase}`;
      // }

      const chat = this.ai.chats.create({
        model: this.modelName,
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
          tools: [{ functionDeclarations: toolsDef }],
        },
        history: history
      });

      const result = await chat.sendMessage({ message });
      
      const responseText = result.text || "";
      let toolCallsData: any[] = [];

      if (result.functionCalls) {
        for (const fc of result.functionCalls) {
           onToolCall(fc.name, fc.args);
           toolCallsData.push({ name: fc.name, args: fc.args });
        }
      }
      
      return {
        text: responseText,
        toolCalls: toolCallsData
      };

    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  // Helper to send tool response back if we were doing a full loop
  // (Not fully implemented for this simple UI demo, but structure is here)
}