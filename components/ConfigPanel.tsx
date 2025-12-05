import { useState, FC, Dispatch, SetStateAction } from 'react';
import { AgentConfig } from '../types';
import { RefreshCw, Save, Check } from 'lucide-react';
import { SUPREME_PROMPT_DEFAULT } from '../constants';

interface ConfigPanelProps {
  config: AgentConfig;
  setConfig: Dispatch<SetStateAction<AgentConfig>>;
}

const ConfigPanel: FC<ConfigPanelProps> = ({ config, setConfig }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const handleModuleToggle = (module: keyof AgentConfig['modules']) => {
    setConfig(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [module]: !prev.modules[module]
      }
    }));
  };

  const handleResetPrompt = () => {
    setConfig(prev => ({ ...prev, systemInstruction: SUPREME_PROMPT_DEFAULT }));
    handleSave(); // Salva automaticamente após redefinir
  };
  
  const handleSave = () => {
      // A lógica de salvamento real (localStorage) já está em App.tsx via useEffect.
      // Aqui, apenas simulamos o processo e fornecemos feedback visual.
      setIsSaving(true);
      setTimeout(() => {
          setIsSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
      }, 500);
  }
  
  const moduleTranslations: Record<keyof AgentConfig['modules'], string> = {
    sales: 'Vendas',
    support: 'Suporte',
    onboarding: 'Integração',
    audio: 'Áudio'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <span className="w-2 h-8 bg-blue-500 rounded-full mr-3"></span>
          Identidade Principal do Agente
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Nome do Agente</label>
            <input 
              type="text"
              value={config.name}
              onChange={(e) => setConfig({...config, name: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Personalidade Base</label>
            <select 
              value={config.personality}
              onChange={(e) => setConfig({...config, personality: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
            >
              <option value="Professional">Profissional e Empático</option>
              <option value="Casual">Casual e Amigável</option>
              <option value="Technical">Técnico e Preciso</option>
            </select>
          </div>
        </div>
        
        {/* Campo para a Chave de API */}
        <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">Chave de API do Gemini (Frontend)</label>
            <input 
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              placeholder="Insira sua chave de API do Google Gemini aqui"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">Esta chave é usada apenas para o Simulador e é salva localmente no seu navegador.</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-400 mb-2">Módulos Ativos</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(config.modules) as Array<keyof AgentConfig['modules']>).map((key) => (
              <button
                key={key}
                onClick={() => handleModuleToggle(key)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  config.modules[key]
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}
              >
                <span className="capitalize">{moduleTranslations[key]}</span>
                <div className={`w-3 h-3 rounded-full ${config.modules[key] ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-600'}`}></div>
              </button>
            ))}
          </div>
        </div>

        <div>
           <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-slate-400">Instrução do Sistema (Prompt)</label>
            <button onClick={handleResetPrompt} className="text-xs text-slate-500 hover:text-slate-300 flex items-center transition-colors">
              <RefreshCw className="w-3 h-3 mr-1" />
              Redefinir para Padrão
            </button>
          </div>
          <textarea
            value={config.systemInstruction}
            onChange={(e) => setConfig({ ...config, systemInstruction: e.target.value })}
            rows={15}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300 focus:border-blue-500 outline-none font-mono"
          />
        </div>
        
        {/* Botão de Salvar */}
        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button
                onClick={handleSave}
                disabled={isSaving}
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
                        <span>Salvo!</span>
                    </>
                ) : (
                    <>
                        <Save className="w-4 h-4" />
                        <span>Salvar Configuração</span>
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;