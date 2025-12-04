import React from 'react';
import { LayoutDashboard, MessageSquare, Settings, FileJson, Bot, BookOpen, Share2, Puzzle } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const menuItems = [
    { id: AppView.DASHBOARD, icon: LayoutDashboard, label: 'Painel' },
    { id: AppView.SIMULATOR, icon: MessageSquare, label: 'Simulador' },
    { id: AppView.CONFIGURATION, icon: Settings, label: 'Config. do Agente' },
    { id: AppView.TRAINING, icon: BookOpen, label: 'Treinamento' },
    { id: AppView.CHANNELS, icon: Share2, label: 'Canais' },
    { id: AppView.INTEGRATIONS, icon: Puzzle, label: 'Integrações' },
    { id: AppView.EXPORTER, icon: FileJson, label: 'Exportar JSON' },
  ];

  return (
    <div className="w-20 lg:w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-50">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
        <Bot className="w-8 h-8 text-blue-500" />
        <span className="ml-3 font-bold text-xl text-white hidden lg:block">OmniAgent</span>
      </div>

      <nav className="flex-1 py-6 space-y-2 px-2">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-white'}`} />
              <span className={`ml-3 font-medium hidden lg:block`}>{item.label}</span>
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-center lg:justify-start space-x-3 text-slate-500 text-xs">
          <span>v1.0.0</span>
          <span className="hidden lg:inline">• Gemini 2.5</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;