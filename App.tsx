import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Simulator from './components/Simulator';
import ConfigPanel from './components/ConfigPanel';
import Exporter from './components/Exporter';
import TrainingPanel from './components/TrainingPanel';
import ChannelsPanel from './components/ChannelsPanel';
import IntegrationsPanel from './components/IntegrationsPanel';
import LeadsPanel from './components/LeadsPanel'; // Importando o novo painel
import { AgentConfig, AppView } from './types';
import { SUPREME_PROMPT_DEFAULT } from './constants';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  
  const [config, setConfig] = useState<AgentConfig>(() => {
    try {
      const savedConfig = localStorage.getItem('agent-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // Ensure necessary keys exist for backwards compatibility
        if (!parsed.trainingData) parsed.trainingData = [];
        if (!parsed.channels) {
            parsed.channels = {
                telegram: false,
                whatsappCloud: false,
                whatsapp: true,
                messenger: false
            };
        }
        if (!parsed.integrations) {
            parsed.integrations = {
                elevenLabs: false,
                googleCalendar: false,
                plugChat: false,
                eVendi: false,
            }
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse agent config from localStorage", e);
    }
    return {
      name: 'OmniAgent',
      personality: 'Professional',
      modules: {
        sales: true,
        support: true,
        onboarding: false,
        audio: false,
      },
      channels: {
        telegram: false,
        whatsappCloud: false,
        whatsapp: true,
        messenger: false,
      },
      integrations: {
        elevenLabs: false,
        googleCalendar: false,
        plugChat: false,
        eVendi: false,
      },
      systemInstruction: SUPREME_PROMPT_DEFAULT,
      trainingData: [],
    };
  });

  // Inicializa o serviço Gemini. Se a chave estiver faltando, ele será null.
  const geminiService = useMemo(() => {
    try {
        return new GeminiService();
    } catch (e) {
        console.error("Failed to initialize Gemini Service:", e);
        return null;
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('agent-config', JSON.stringify(config));
  }, [config]);

  
  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard />;
      case AppView.SIMULATOR:
        if (!geminiService) return <div className="text-center p-8 text-slate-400">O Serviço Gemini não pôde ser inicializado. Verifique se a API_KEY está configurada.</div>;
        return <Simulator config={config} geminiService={geminiService} />;
      case AppView.LEADS: // Novo caso
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