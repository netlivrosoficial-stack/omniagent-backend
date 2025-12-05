import React, { useState } from 'react';
import { AgentConfig, MetaApiConfig } from '../types';
import { Save, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface WhatsappCloudConfigProps {
    config: AgentConfig;
    setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
    onUpdateStatus: (status: boolean) => void;
}

const WhatsappCloudConfig: React.FC<WhatsappCloudConfigProps> = ({ config, setConfig, onUpdateStatus }) => {
    const [localConfig, setLocalConfig] = useState<MetaApiConfig>(config.metaApi);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    
    const isConfigComplete = localConfig.accessToken.length > 10 && localConfig.phoneNumberId.length > 5 && localConfig.verifyToken.length > 5;
    
    const handleInputChange = (field: keyof MetaApiConfig, value: string) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        setIsSaving(true);
        
        // 1. Salva a configuração no estado global
        setConfig(prev => ({
            ...prev,
            metaApi: localConfig,
            channels: {
                ...prev.channels,
                whatsappCloud: isConfigComplete // Conecta se a configuração estiver completa
            }
        }));
        
        // 2. Atualiza o status de conexão no modal
        onUpdateStatus(isConfigComplete);

        // 3. Feedback visual
        setTimeout(() => {
            setIsSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
            <div className="p-3 bg-blue-900/30 text-blue-400 rounded-lg text-sm flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                    Para usar a Cloud API, você deve configurar o Webhook do Meta para apontar para a URL abaixo e inserir suas credenciais.
                </p>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Token de Verificação (Verify Token)</label>
                    <input 
                        type="text"
                        value={localConfig.verifyToken}
                        onChange={(e) => handleInputChange('verifyToken', e.target.value)}
                        placeholder="Ex: MEU_TOKEN_SECRETO"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">ID do Número de Telefone (Phone Number ID)</label>
                    <input 
                        type="text"
                        value={localConfig.phoneNumberId}
                        onChange={(e) => handleInputChange('phoneNumberId', e.target.value)}
                        placeholder="Ex: 1001234567890"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Token de Acesso Permanente (Access Token)</label>
                    <input 
                        type="password"
                        value={localConfig.accessToken}
                        onChange={(e) => handleInputChange('accessToken', e.target.value)}
                        placeholder="Insira o token de acesso gerado pelo Meta"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                </div>
            </div>
            
            <div className="pt-2 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving || !isConfigComplete}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        saved 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-600'
                    }`}
                >
                    {isSaving ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Salvando...</span>
                        </>
                    ) : saved ? (
                        <>
                            <Check className="w-4 h-4" />
                            <span>Configuração Salva!</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            <span>Salvar e Conectar</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default WhatsappCloudConfig;