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
import Login from './src/pages/Login';
import { SessionContextProvider, useAuth } from './components/SessionContextProvider';
import { AgentConfig, AppView } from './types';
import { SUPREME_PROMPT_DEFAULT } from './constants';
import { GeminiService } from './services/geminiService';

// Componente principal que contém a lógica de roteamento e estado
const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  
  // Define a view inicial: LOGIN se não houver usuário, DASHBOARD caso contrário.
  const initialView = user ? AppView.DASHBOARD : AppView.LOGIN;
  const [currentView, setCurrentView] = useState<AppView>(initialView);
  
  // Redireciona se o estado de autenticação mudar
  useEffect(() => {
      if (user && currentView === AppView.LOGIN) {
          setCurrentView(AppView.DASHBOARD);
      } else if (!user && currentView !== AppView.LOGIN) {
          setCurrentView(AppView.LOGIN);
      }
  }, [user, currentView]);
  
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
        // Ensure apiKey exists
        if (!parsed.apiKey) parsed.apiKey = '';
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse agent config from localStorage", e);
    }
    return {
      name: 'OmniAgent',
      personality: 'Professional',
      apiKey: '', // Chave de API padrão vazia
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

  // Inicializa o serviço Gemini usando a chave da configuração.
  const geminiService = useMemo(() => {
    if (!config.apiKey) return null;
    try {
        return new GeminiService(config.apiKey);
    } catch (e) {
        console.error("Failed to initialize Gemini Service:", e);
        return null;
    }
  }, [config.apiKey]); // Recria o serviço se a chave mudar
  
  useEffect(() => {
    localStorage.setItem('agent-config', JSON.stringify(config));
  }, [config]);

  
  const renderView = () => {
    if (!user) {
        return <Login />;
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
      case AppView.LOGIN:
        // Se o usuário estiver logado, mas a view for LOGIN, redirecionamos para DASHBOARD
        return <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex bg-slate-900 text-slate-200">
      {user && <Sidebar currentView={currentView} onChangeView={setCurrentView} />}
      <main className={`flex-1 ${user ? 'ml-20 lg:ml-64' : 'ml-0'} p-4 sm:p-6 lg:p-8 min-h-screen`}>
        <div className="w-full max-w-7xl mx-auto">
           {renderView()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
    <SessionContextProvider>
        <MainAppContent />
    </SessionContextProvider>
);

export default App;