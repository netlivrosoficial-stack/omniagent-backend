import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Simulator from './components/Simulator';
import ConfigPanel from './components/ConfigPanel';
import Exporter from './components/Exporter';
import TrainingPanel from './components/TrainingPanel';
import ChannelsPanel from './components/ChannelsPanel';
import IntegrationsPanel from './components/IntegrationsPanel';
import LeadsPanel from './components/LeadsPanel';
import { AgentConfig, AppView } from './types';
import { GeminiService } from './services/geminiService';
import { useAuth } from './src/SessionContextProvider';
import { useAgentConfig } from './src/hooks/useAgentConfig'; // Importando o novo hook
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  
  // Usando o novo hook para gerenciar a configuração
  const { config, setConfig, isLoading: isConfigLoading } = useAgentConfig();

  // Inicializa o serviço Gemini usando a chave da configuração.
  const geminiService = useMemo(() => {
    if (!config.apiKey || !user) return null; 
    try {
        return new GeminiService(config.apiKey);
    } catch (e) {
        console.error("Failed to initialize Gemini Service:", e);
        return null;
    }
  }, [config.apiKey, user]);
  
  // Removendo o useEffect de localStorage, agora a persistência é no hook.
  // useEffect(() => {
  //   localStorage.setItem('agent-config', JSON.stringify(config));
  // }, [config]);

  
  const renderView = () => {
    if (isConfigLoading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center text-blue-400">
                <Loader2 className="w-8 h-8 animate-spin mr-3" />
                Carregando configuração do agente...
            </div>
        );
    }
    
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard />;
      case AppView.SIMULATOR:
        if (!geminiService) return <div className="text-center p-8 text-slate-400">O Serviço Gemini não pôde ser inicializado. Por favor, insira sua chave de API na tela de Configuração do Agente.</div>;
        return <Simulator config={config} geminiService={geminiService} />;
      case AppView.LEADS:
        return <LeadsPanel />;
      case AppView.CONFIGURATION:
        return <ConfigPanel config={config} setConfig={setConfig} />;
      case AppView.TRAINING:
        return <TrainingPanel config={config} setConfig={setConfig} />;
      case AppView.CHANNELS:
        return <ChannelsPanel config={config} setConfig={setConfig} />;
      case AppView.INTEGRATIONS:
        return <IntegrationsPanel config={config} setConfig={setConfig} />;
      case AppView.EXPORTER:
        return <Exporter config={config} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex bg-slate-900 text-slate-200">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      <main className="flex-1 ml-20 lg:ml-64 p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="w-full max-w-7xl mx-auto">
           {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;