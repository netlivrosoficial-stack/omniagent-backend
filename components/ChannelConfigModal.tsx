import React from 'react';
import { X, CheckCircle2, Settings, QrCode } from 'lucide-react';
import WhatsappTestButton from './WhatsappTestButton';
import WhatsappConnectManager from './WhatsappConnectManager'; // Importando o novo componente
import { AgentConfig } from '../types';

const SUPABASE_PROJECT_ID = "puyiyelqirhnzbcgiamf";
const EDGE_FUNCTION_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  isConnected: boolean;
  agentName: string;
  agentConfig: AgentConfig;
  // Novo prop para atualizar o estado de conexão no ChannelsPanel
  onUpdateConnection: (channelId: keyof AgentConfig['channels'], status: boolean) => void; 
  channelId: keyof AgentConfig['channels']; // Novo prop para identificar o canal
}

const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({ 
    isOpen, 
    onClose, 
    channelName, 
    isConnected, 
    agentName, 
    agentConfig,
    onUpdateConnection,
    channelId
}) => {
  if (!isOpen) return null;
  
  const handleStatusUpdate = (status: boolean) => {
      onUpdateConnection(channelId, status);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl transform transition-all duration-300 scale-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-400" />
            Configurações de {channelName}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className={`p-4 rounded-lg flex items-center space-x-3 ${isConnected ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-red-900/30 border border-red-700'}`}>
            <CheckCircle2 className={`w-6 h-6 ${isConnected ? 'text-emerald-400' : 'text-red-400'}`} />
            <p className="text-white font-medium">
              Status: <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>{isConnected ? 'Conectado e Ativo' : 'Desconectado'}</span>
            </p>
          </div>

          {channelId === 'whatsapp' && (
            <>
                <WhatsappConnectManager 
                    isConnected={isConnected} 
                    onUpdateStatus={handleStatusUpdate}
                />
                
                {isConnected && <WhatsappTestButton agentName={agentName} agentConfig={agentConfig} />}
            </>
          )}
          
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white">Webhook URL</h3>
            <p className="text-sm text-slate-300 font-mono mt-2 break-all">
                {EDGE_FUNCTION_URL}
            </p>
            <p className="text-xs text-slate-500 mt-1">Este é o endpoint real da sua Edge Function no Supabase.</p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end flex-shrink-0">
          <button 
            onClick={onClose}
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelConfigModal;