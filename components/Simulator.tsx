import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronsRight, AlertTriangle } from 'lucide-react';
import { AgentConfig, Message, ToolCallLog } from '../types';
import { GeminiService } from '../services/geminiService';

interface SimulatorProps {
  config: AgentConfig;
  geminiService: GeminiService | null; // Pode ser nulo se o provedor for OpenAI
}

const ToolCallDisplay: React.FC<{ toolCall: ToolCallLog }> = ({ toolCall }) => (
  <div className="bg-slate-700/50 rounded-lg p-3 my-2 border border-slate-600">
    <div className="flex items-center text-xs text-amber-400 font-mono">
      <ChevronsRight className="w-4 h-4 mr-2"/>
      <span>CHAMADA DE FERRAMENTA: {toolCall.name}</span>
    </div>
    <pre className="text-xs text-slate-300 bg-slate-800 p-2 rounded-md mt-2 overflow-x-auto">
      {JSON.stringify(toolCall.args, null, 2)}
    </pre>
  </div>
);


const Simulator: React.FC<SimulatorProps> = ({ config, geminiService }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: `Olá! Eu sou ${config.name}. Como posso te ajudar hoje?`, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleToolCall = (name: string, args: any) => {
    // This is a stub for UI display. In a real app, this would execute the tool.
    console.log(`Tool call intercepted for display: ${name}`, args);
  };
  
  const handleSend = async () => {
    if (!input.trim() || isLoading || !geminiService) return;
    
    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
      }));
      
      const { text, toolCalls } = await geminiService.sendMessage(history, userMessage.content, config, handleToolCall);
      
      const modelMessage: Message = { 
          role: 'model', 
          content: text || "...", 
          timestamp: new Date(),
          toolCalls: toolCalls.map(tc => ({name: tc.name, args: tc.args}))
      };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
        console.error("Simulation error:", error);
        const errorMessage: Message = { 
            role: 'model', 
            content: "Desculpe, encontrei um erro. Por favor, verifique o console ou sua chave de API.", 
            timestamp: new Date(),
            isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };
  
  if (config.aiProvider === 'openai') {
      return (
          <div className="max-w-4xl mx-auto p-8 bg-slate-800/50 rounded-xl border border-slate-700 shadow-2xl text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white">Simulador Indisponível</h2>
              <p className="text-slate-400 mt-2">O Simulador só é suportado quando o Provedor de IA selecionado é o **Google Gemini**.</p>
              <p className="text-slate-400 mt-1">Por favor, mude o provedor na tela de Configuração do Agente para usar o Simulador.</p>
          </div>
      );
  }
  
  if (!geminiService) {
      return (
          <div className="max-w-4xl mx-auto p-8 bg-slate-800/50 rounded-xl border border-slate-700 shadow-2xl text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white">Chave de API Ausente</h2>
              <p className="text-slate-400 mt-2">Por favor, insira sua chave de API do Gemini na tela de Configuração do Agente para iniciar a simulação.</p>
          </div>
      );
  }


  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto bg-slate-800/50 rounded-xl border border-slate-700 shadow-2xl animate-fade-in">
      <div className="p-4 border-b border-slate-700 flex items-center">
        <div className="w-3 h-3 rounded-full bg-emerald-500 mr-3 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
        <h2 className="text-lg font-semibold text-white">{config.name} - Simulação ao Vivo ({config.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'})</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-white" /></div>}
              
              <div className={`max-w-lg p-3 rounded-xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : `bg-slate-700 text-slate-200 rounded-bl-none ${msg.isError ? 'border border-red-500/50' : ''}`}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 border-t border-slate-600/50 pt-2">
                        {msg.toolCalls.map((tc, i) => <ToolCallDisplay key={i} toolCall={tc} />)}
                    </div>
                )}
              </div>
              
              {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-white" /></div>}
            </div>
          ))}
          {isLoading && (
              <div className="flex items-start gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-white" /></div>
                  <div className="max-w-lg p-3 rounded-xl bg-slate-700 text-slate-200 rounded-bl-none">
                      <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                      </div>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua mensagem..."
            disabled={isLoading || config.aiProvider !== 'gemini'}
            className="w-full bg-slate-900 border border-slate-600 rounded-full pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim() || config.aiProvider !== 'gemini'}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-blue-700 transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Simulator;