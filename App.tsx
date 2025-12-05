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
import Login from './pages/Login'; // Usando o caminho relativo padrão
import { AgentConfig, AppView } from './types';
import { SUPREME_PROMPT_DEFAULT } from './constants';
import { GeminiService } from './services/geminiService';
import { supabase } from './integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
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

  // 1. Gerenciamento de Autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Persistência da Configuração
  useEffect(() => {
    localStorage.setItem('agent-config', JSON.stringify(config));
  }, [config]);

  // 3. Inicialização do Serviço Gemini
  const geminiService = useMemo(() => {
    if (!config.apiKey) return null;
    try {
        return new GeminiService(config.apiKey);
    } catch (e) {
        console.error("Failed to initialize Gemini Service:", e);
        return null;
    }
  }, [config.apiKey]);
  
  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-slate-900">Carregando...</div>;
  }

  if (!session) {
    return <Login />;
  }
  
  const renderView = () => {
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