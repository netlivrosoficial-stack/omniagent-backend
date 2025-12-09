import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Loader2, CheckCircle2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';
import * as QRCodeModule from 'qrcode.react'; // Importa tudo

// Acessa o componente QRCode, usando .default como fallback ou o módulo inteiro.
// Isso resolve o erro de 'default' export que estava causando a falha.
const QRCode = (QRCodeModule as any).default || QRCodeModule;

// Use environment variable for the real backend URL
const WHATSAPP_BACKEND_URL = import.meta.env.VITE_WHATSAPP_BACKEND_URL;

interface SessionData {
    status: 'disconnected' | 'connecting' | 'connected';
    qr_code_data: string | null;
    last_updated: string;
    user_id: string;
}

interface WhatsappConnectManagerProps {
    isConnected: boolean;
    onUpdateStatus: (status: boolean) => void;
}

const WhatsappConnectManager: React.FC<WhatsappConnectManagerProps> = ({ isConnected, onUpdateStatus }) => {
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollingIntervalId, setPollingIntervalId] = useState<number | null>(null); // Renomeado para clareza

    // Função para buscar o estado atual da sessão no Supabase
    const fetchSession = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError("Usuário não autenticado.");
            if (showLoading) setLoading(false);
            return;
        }
        
        // Fetch using the authenticated client (RLS is active)
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        if (error) {
            // Se o erro for "No rows found" (PGRST116), significa que a sessão foi limpa/desconectada.
            if (error.code === 'PGRST116') {
                setSession(null);
            } else {
                console.error("Error fetching session:", error);
                setError(error.message);
                setSession(null);
            }
        } else if (data) {
            setSession(data as SessionData);
        } else {
            // Caso data seja null (embora o erro PGRST116 deva capturar isso)
            setSession(null);
        }
        if (showLoading) setLoading(false);
    }, []);

    // --- Polling Setup ---
    useEffect(() => {
        fetchSession();
        
        // Função para iniciar o polling
        const startPolling = () => {
            // Limpa o intervalo anterior se existir
            if (pollingIntervalId) clearInterval(pollingIntervalId);
            
            const interval = setInterval(() => {
                // Só faz polling se não estiver conectado
                if (session?.status !== 'connected') {
                    fetchSession(false); 
                } else {
                    // Se estiver conectado, para o polling
                    if (pollingIntervalId) clearInterval(pollingIntervalId);
                }
            }, 5000);
            
            setPollingIntervalId(interval as unknown as number);
        };
        
        startPolling();

        return () => {
            if (pollingIntervalId) clearInterval(pollingIntervalId);
        };
    }, [fetchSession, session?.status]); // Depende do status da sessão para parar/continuar o polling
    
    // Update parent state when local session changes, ONLY IF IT ACTUALLY CHANGED
    useEffect(() => {
        const newStatus = session?.status === 'connected';
        if (newStatus !== isConnected) {
            onUpdateStatus(newStatus);
        }
    }, [session?.status, onUpdateStatus, isConnected]);


    // Função para iniciar a conexão (chama o Fly.io Backend)
    const startConnection = async () => {
        if (!WHATSAPP_BACKEND_URL) {
            setError("VITE_WHATSAPP_BACKEND_URL não configurada. Por favor, configure a URL do seu servidor Fly.io.");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError("Sessão de usuário não encontrada. Faça login novamente.");
            setLoading(false);
            return;
        }

        try {
            // Define o status localmente para 'connecting' imediatamente para feedback visual
            setSession(prev => ({
                ...(prev || {} as SessionData), // Garante que o objeto exista
                user_id: user.id,
                status: 'connecting',
                qr_code_data: null,
                last_updated: new Date().toISOString()
            }));
            
            console.log(`[WhatsappManager] Chamando START em: ${WHATSAPP_BACKEND_URL}/api/whatsapp/start`);
            // Chamada para o backend real no Fly.io
            const response = await fetch(`${WHATSAPP_BACKEND_URL}/api/whatsapp/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }), // Passamos o ID do usuário para o backend
            });

            const data = await response.json();

            if (response.ok) {
                console.log("[WhatsappManager] START OK. Resposta:", data);
                // O backend iniciou o processo e irá atualizar o Supabase.
                // O polling (useEffect) irá buscar o QR code.
            } else {
                console.error("[WhatsappManager] START Falhou. Resposta:", data);
                setError(data.error || 'Falha ao iniciar a conexão no servidor Fly.io.');
                setSession(null); // Volta para desconectado se falhar
            }

        } catch (err) {
            console.error("[WhatsappManager] Erro de rede ao chamar START:", err);
            setError('Erro de rede ao chamar o Fly.io Backend. Verifique a URL.');
            setSession(null); // Volta para desconectado se falhar
        } finally {
            setLoading(false);
        }
    };
    
    
    const disconnect = async () => {
        if (!WHATSAPP_BACKEND_URL) {
            setError("VITE_WHATSAPP_BACKEND_URL não configurada. Não é possível desconectar.");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError("Usuário não autenticado para desconectar.");
            setLoading(false);
            return;
        }
        
        try {
            console.log(`[WhatsappManager] Chamando DISCONNECT em: ${WHATSAPP_BACKEND_URL}/api/whatsapp/disconnect`);
            // Chamada para o backend real no Fly.io para destruir a sessão
            const response = await fetch(`${WHATSAPP_BACKEND_URL}/api/whatsapp/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }),
            });
            
            if (response.ok) {
                console.log("[WhatsappManager] DISCONNECT OK.");
                // O backend já atualizou o Supabase, buscamos o novo estado
                await fetchSession();
            } else {
                // Tenta ler o JSON de erro, mas se falhar, usa o status HTTP
                let errorData: { error: string } = { error: `Erro HTTP ${response.status}: Falha interna no servidor Fly.io.` };
                try {
                    const jsonResponse = await response.json();
                    // Se o backend retornou um erro detalhado (como o erro do Supabase), usamos ele.
                    errorData.error = jsonResponse.error || errorData.error;
                } catch (e) {
                    console.warn("Could not parse error JSON from backend:", e);
                }
                
                console.error("[WhatsappManager] DISCONNECT Falhou. Resposta:", errorData);
                setError(errorData.error); // Define o erro detalhado
            }
            
        } catch (err) {
            console.error("[WhatsappManager] Erro de rede ao chamar DISCONNECT:", err);
            setError('Erro de rede ao chamar o Fly.io Backend para desconexão.');
        } finally {
            // Se a chamada HTTP falhar, o loading deve ser desativado.
            // Se a chamada for bem-sucedida, fetchSession já lida com o loading.
            setLoading(false); 
        }
    }

    const currentStatus = session?.status || 'disconnected';
    const qrCodeData = session?.qr_code_data;
    
    // Se a URL do backend não estiver configurada, mostre um erro prioritário
    if (!WHATSAPP_BACKEND_URL) {
        return (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-red-700">
                <div className="p-4 bg-red-900/30 text-red-400 rounded-lg flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                    <p className="text-sm">
                        **ERRO DE CONFIGURAÇÃO:** A variável de ambiente `VITE_WHATSAPP_BACKEND_URL` não está definida. Por favor, adicione a URL do seu Fly.io (`https://whatsapp-backend-silent-mountain-8291.fly.dev`) ao arquivo `.env.local` e reinicie o aplicativo.
                    </p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (loading && currentStatus !== 'connecting') {
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
                        <span>{loading ? 'Desconectando...' : 'Desconectar'}</span>
                    </button>
                </div>
            );
        }
        
        if (currentStatus === 'connecting') {
            // Se estiver conectando, mostre o QR Code se ele existir, ou um spinner se ainda não chegou.
            if (qrCodeData) {
                return (
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4 text-center">
                        <h3 className="text-lg font-semibold text-white flex items-center justify-center">
                            <QrCode className="w-5 h-5 mr-2 text-blue-400" />
                            Escaneie o QR Code
                        </h3>
                        <p className="text-slate-400 text-sm">
                            Use o aplicativo WhatsApp no seu celular para escanear o código abaixo e conectar a sessão.
                        </p>
                        
                        {/* Renderiza o QR Code usando qrcode.react */}
                        <div className="w-40 h-40 mx-auto flex items-center justify-center rounded-md p-2 bg-white">
                            {qrCodeData && (
                                <QRCode value={qrCodeData} size={150} level="H" />
                            )}
                        </div>
                        
                        <p className="text-xs text-amber-400 mt-1">Aguardando conexão... (Verificando status a cada 5s)</p>
                        <button 
                            onClick={() => fetchSession()}
                            disabled={loading}
                            className="mt-2 flex items-center justify-center mx-auto space-x-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Verificar Status Agora</span>
                        </button>
                    </div>
                );
            } else {
                // Status 'connecting' mas sem QR Code (aguardando o backend salvar)
                return (
                    <div className="flex justify-center items-center py-10 text-blue-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Iniciando sessão e aguardando QR Code...
                    </div>
                );
            }
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
                    <span>{loading ? 'Iniciando Servidor...' : 'Gerar QR Code e Conectar'}</span>
                </button>
            </div>
        );
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            {renderContent()}
        </div>
    );
};

export default WhatsappConnectManager;