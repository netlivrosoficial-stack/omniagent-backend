import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AgentConfig } from '../types';

const SUPABASE_PROJECT_ID = "puyiyelqirhnzbcgiamf";
const EDGE_FUNCTION_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

interface WhatsappTestButtonProps {
    agentName: string;
    agentConfig: AgentConfig; // Novo prop para a configuração completa
}

const WhatsappTestButton: React.FC<WhatsappTestButtonProps> = ({ agentName, agentConfig }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [responseMessage, setResponseMessage] = useState('');
    
    const handleTest = async () => {
        setIsLoading(true);
        setStatus('idle');
        setResponseMessage('');
        
        const testPayload = {
            message: `Teste de conexão do agente ${agentName}.`,
            sender: 'Dyad Test User',
            agentConfig: agentConfig, // Enviando a configuração completa
        };

        try {
            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Em um ambiente real, você enviaria o token de autenticação aqui
                },
                body: JSON.stringify(testPayload),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setResponseMessage(data.response || 'Webhook testado com sucesso!');
            } else {
                setStatus('error');
                setResponseMessage(data.error || 'Erro desconhecido ao testar o webhook.');
            }

        } catch (error) {
            console.error("Erro ao chamar Edge Function:", error);
            setStatus('error');
            setResponseMessage('Falha na conexão de rede ou Edge Function indisponível.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4">
            <h3 className="text-lg font-semibold text-white">Teste de Conexão Real</h3>
            <p className="text-slate-400 text-sm">
                Envie uma mensagem de teste para a Edge Function do Supabase para verificar se o webhook está ativo e respondendo.
            </p>
            
            <button
                onClick={handleTest}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Send className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Enviando Teste...' : 'Enviar Mensagem de Teste'}</span>
            </button>
            
            {status !== 'idle' && (
                <div className={`p-3 rounded-lg text-sm ${status === 'success' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                    <div className="flex items-start space-x-2">
                        {status === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                        <p className="whitespace-pre-wrap">{responseMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsappTestButton;