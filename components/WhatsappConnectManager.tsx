import React, { useState, useEffect } from 'react';
import { QrCode, Loader2, CheckCircle2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PROJECT_ID = "puyiyelqirhnzbcgiamf";
const EDGE_FUNCTION_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-connect`;

interface SessionData {
    status: 'disconnected' | 'connecting' | 'connected';
    qr_code_data: string | null;
    last_updated: string;
}

interface WhatsappConnectManagerProps {
    isConnected: boolean;
    onUpdateStatus: (status: boolean) => void;
}

const WhatsappConnectManager: React.FC<WhatsappConnectManagerProps> = ({ isConnected, onUpdateStatus }) => {
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSession();
    }, []);
    
    // Função para buscar o estado atual da sessão no Supabase
    const fetchSession = async () => {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError("Usuário não autenticado.");
            setLoading(false);
            return;
        }
        
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
            setError(error.message);
        } else if (data) {
            setSession(data as SessionData);
            onUpdateStatus(data.status === 'connected');
        } else {
            setSession(null);
            onUpdateStatus(false);
        }
        setLoading(false);
    };

    // Função para iniciar a conexão (chama a Edge Function)
    const startConnection = async () => {
        setLoading(true);
        setError(null);
        
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
            setError("Sessão de usuário não encontrada. Faça login novamente.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authSession.access_token}`,
                },
                body: JSON.stringify({ action: 'start' }),
            });

            const data = await response.json();

            if (response.ok) {
                // Simulação: Atualiza o estado local com o QR Code simulado
                setSession({
                    status: 'connecting',
                    qr_code_data: data.qrCode,
                    last_updated: new Date().toISOString()
                });
                // Simula a conexão automática após 5 segundos para fins de demonstração
                setTimeout(() => {
                    simulateConnectionSuccess(authSession.access_token);
                }, 5000);
            } else {
                setError(data.error || 'Falha ao iniciar a conexão.');
            }

        } catch (err) {
            setError('Erro de rede ao chamar a Edge Function.');
        } finally {
            setLoading(false);
        }
    };
    
    // Função para simular a mudança de status para 'connected'
    const simulateConnectionSuccess = async (token: string) => {
        // Em um ambiente real, isso seria um webhook do provedor de WhatsApp
        // Aqui, atualizamos o Supabase diretamente para simular o sucesso
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .update({ status: 'connected' })
            .eq('user_id', supabase.auth.getUser().then(res => res.data.user?.id))
            .select()
            .single();
            
        if (error) {
            console.error("Simulação de conexão falhou:", error);
            setError("Falha na simulação de conexão.");
        } else if (data) {
            setSession(data as SessionData);
            onUpdateStatus(true);
        }
    }
    
    const disconnect = async () => {
        setLoading(true);
        const { error } = await supabase
            .from('whatsapp_sessions')
            .update({ status: 'disconnected', qr_code_data: null })
            .eq('user_id', supabase.auth.getUser().then(res => res.data.user?.id));
            
        if (error) {
            setError("Falha ao desconectar.");
        } else {
            setSession(prev => prev ? { ...prev, status: 'disconnected', qr_code_data: null } : null);
            onUpdateStatus(false);
        }
        setLoading(false);
    }

    const currentStatus = session?.status || 'disconnected';
    const qrCodeData = session?.qr_code_data;

    const renderContent = () => {
        if (loading && !session) {
            return (
                <div className="flex justify-center items-center py-10 text-blue-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Carregando status da sessão...
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="p-4 bg-red-900/30 text-red-400 rounded-lg flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-3" />
                    Erro: {error}
                </div>
            );
        }

        if (currentStatus === 'connected') {
            return (
                <div className="text-center py-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-white">Conectado com Sucesso!</p>
                    <p className="text-slate-400 text-sm mt-1">Seu agente está ativo e pronto para responder no WhatsApp.</p>
                    <button 
                        onClick={disconnect}
                        disabled={loading}
                        className="mt-4 flex items-center justify-center mx-auto space-x-2 bg-red-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:bg-slate-600"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Desconectar</span>
                    </button>
                </div>
            );
        }
        
        if (currentStatus === 'connecting' && qrCodeData) {
            // Em um ambiente real, você usaria uma biblioteca para renderizar o QR Code a partir do Base64
            return (
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4 text-center">
                    <h3 className="text-lg font-semibold text-white flex items-center justify-center">
                        <QrCode className="w-5 h-5 mr-2 text-blue-400" />
                        Escaneie o QR Code
                    </h3>
                    <p className="text-slate-400 text-sm">
                        Use o aplicativo WhatsApp no seu celular para escanear o código abaixo e conectar a sessão.
                    </p>
                    
                    {/* Placeholder para o QR Code (simulando a exibição do Base64) */}
                    <div className="w-40 h-40 bg-white mx-auto flex items-center justify-center rounded-md p-2">
                        <p className="text-xs text-slate-800 break-all">
                            {qrCodeData.substring(0, 50)}...
                        </p>
                    </div>
                    <p className="text-xs text-amber-400 mt-1">Aguardando conexão... (Simulação: Conecta em 5s)</p>
                    <button 
                        onClick={fetchSession}
                        disabled={loading}
                        className="mt-2 flex items-center justify-center mx-auto space-x-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Verificar Status</span>
                    </button>
                </div>
            );
        }

        // Status: disconnected
        return (
            <div className="text-center py-4">
                <p className="text-slate-400 text-sm mb-4">Inicie o processo de conexão para gerar um novo QR Code.</p>
                <button 
                    onClick={startConnection}
                    disabled={loading}
                    className="flex items-center justify-center mx-auto space-x-2 bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    <span>{loading ? 'Iniciando...' : 'Gerar QR Code'}</span>
                </button>
            </div>
        );
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
            <div className="p-3 bg-amber-900/30 text-amber-400 rounded-lg text-sm flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                    **Aviso:** Esta arquitetura de QR Code é gratuita por mensagem, mas requer um servidor de longa duração (não Edge Function) para manter a sessão ativa. A função aqui é apenas para simulação e gerenciamento de estado.
                </p>
            </div>
            {renderContent()}
        </div>
    );
};

export default WhatsappConnectManager;