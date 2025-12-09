import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Loader2, CheckCircle2, AlertTriangle, RefreshCw, LogOut, Link } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';
import QRCode from 'react-qr-code';

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
    const [pollingIntervalId, setPollingIntervalId] = useState<number | null>(null);

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
        
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        if (error) {
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
            setSession(null);
        }
        if (showLoading) setLoading(false);
    }, []);

    // --- Polling Setup ---
    useEffect(() => {
        fetchSession();
        
        const startPolling = () => {
            if (pollingIntervalId) clearInterval(pollingIntervalId);
            
            const interval = setInterval(() => {
                if (session?.status !== 'connected') {
                    fetchSession(false); 
                } else {
                    if (pollingIntervalId) clearInterval(pollingIntervalId);
                }
            }, 5000);
            
            setPollingIntervalId(interval as unknown as number);
        };
        
        startPolling();

        return () => {
            if (pollingIntervalId) clearInterval(pollingIntervalId);
        };
    }, [fetchSession, session?.status]);
    
    // Update parent state when local session changes
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
            setSession(prev => ({
                ...(prev || {} as SessionData),
                user_id: user.id,
                status: 'connecting',
                qr_code_data: null,
                last_updated: new Date().toISOString()
            }));
            
            console.log(`[WhatsappManager] Chamando START em: ${WHATSAPP_BACKEND_URL}/api/whatsapp/start`);
            const response = await fetch(`${WHATSAPP_BACKEND_URL}/api/whatsapp/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log("[WhatsappManager] START OK. Resposta:", data);
            } else {
                console.error("[WhatsappManager] START Falhou. Resposta:", data);
                setError(data.error || 'Falha ao iniciar a conexão no servidor Fly.io.');
                setSession(null);
            }

        } catch (err) {
            console.error("[WhatsappManager] Erro de rede ao chamar START:", err);
            setError('Erro de rede ao chamar o Fly.io Backend. Verifique a URL.');
            setSession(null);
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
            const response = await fetch(`${WHATSAPP_BACKEND_URL}/api/whatsapp/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }),
            });
            
            if (response.ok) {
                console.log("[WhatsappManager] DISCONNECT OK.");
                await fetchSession();
            } else {
                let errorData: { error: string } = { error: `Erro HTTP ${response.status}: Falha interna no servidor Fly.io.` };
                try {
                    const jsonResponse = await response.json();
                    errorData.error = jsonResponse.error || errorData.error;
                } catch (e) {
                    console.warn("Could not parse error JSON from backend:", e);
                }
                
                console.error("[WhatsappManager] DISCONNECT Falhou. Resposta:", errorData);
                setError(errorData.error);
            }
            
        } catch (err) {
            console.error("[WhatsappManager] Erro de rede ao chamar DISCONNECT:", err);
            setError('Erro de rede ao chamar o Fly.io Backend para desconexão.');
        } finally {
            setLoading(false); 
        }
    }

    const currentStatus = session?.status || 'disconnected';
    const qrCodeData = session?.qr_code_data;
    
    // Verifica se o dado é um código de 8 dígitos (Code Linking)
    const isCodeLinking = qrCodeData && qrCodeData.length === 8 && /^\d+$/.test(qrCodeData);

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
            if (qrCodeData) {
                
                if (isCodeLinking) {
                    // Exibe o código de 8 dígitos
                    return (
                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4 text-center">
                            <h3 className="text-lg font-semibold text-white flex items-center justify-center">
                                <Link className="w-5 h-5 mr-2 text-blue-400" />
                                Conexão por Código
                            </h3>
                            <p className="text-slate-400 text-sm">
                                Use o aplicativo WhatsApp no seu celular para conectar um novo dispositivo e insira o código abaixo:
                            </p>
                            
                            <div className="bg-slate-700 p-4 rounded-lg mx-auto max-w-xs">
                                <p className="text-4xl font-mono font-bold text-blue-400 tracking-widest">{qrCodeData}</p>
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
                }
                
                // Exibe o QR Code (comportamento padrão)
                return (
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-4 text-center">
                        <h3 className="text-lg font-semibold text-white flex items-center justify-center">
                            <QrCode className="w-5 h-5 mr-2 text-blue-400" />
                            Escaneie o QR Code
                        </h3>
                        <p className="text-slate-400 text-sm">
                            Use o aplicativo WhatsApp no seu celular para escanear o código abaixo e conectar a sessão.
                        </p>
                        
                        <div className="w-40 h-40 bg-white mx-auto flex items-center justify-center rounded-md p-2">
                            <QRCode 
                                value={qrCodeData} 
                                size={140} 
                                level="H" 
                                bgColor="#FFFFFF"
                                fgColor="#000000"
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            />
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
                // Status 'connecting' mas sem QR Code/Code (aguardando o backend salvar)
                return (
                    <div className="flex justify-center items-center py-10 text-blue-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Iniciando sessão e aguardando QR Code ou Código de Conexão...
                    </div>
                );
            }
        }

        // Status: disconnected
        return (
            <div className="text-center py-4">
                <p className="text-slate-400 text-sm mb-4">Inicie o processo de conexão para gerar um novo QR Code ou Código de Conexão.</p>
                <button 
                    onClick={startConnection}
                    disabled={loading}
                    className="flex items-center justify-center mx-auto space-x-2 bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    <span>{loading ? 'Iniciando Servidor...' : 'Gerar QR Code/Código e Conectar'}</span>
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