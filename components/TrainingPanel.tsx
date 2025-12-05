import { useState, FC } from 'react';
import { AgentConfig, TrainingItem } from '../types';
import { Search, Quote, FileText, Trash2, Link, Video } from 'lucide-react';

interface TrainingPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

const TrainingPanel: FC<TrainingPanelProps> = ({ config, setConfig }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'website' | 'video' | 'document'>('text');
  const [newText, setNewText] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const MAX_CHARS = 1024;

  const handleAddText = () => {
    if (!newText.trim()) return;
    const newItem: TrainingItem = {
      id: new Date().toISOString(),
      type: 'text',
      content: newText.trim()
    };
    setConfig(prev => ({
      ...prev,
      trainingData: [...prev.trainingData, newItem]
    }));
    setNewText('');
  };
  
  const handleAddWebsite = () => {
    // Basic URL validation
    if (!newUrl.trim() || !newUrl.startsWith('http')) return; 
    
    const newItem: TrainingItem = {
      id: new Date().toISOString(),
      type: 'website',
      // Para fins de simulação, o conteúdo é um placeholder, mas a fonte é a URL
      content: `URL de treinamento: ${newUrl.trim()}`, 
      source: newUrl.trim()
    };
    setConfig(prev => ({
      ...prev,
      trainingData: [...prev.trainingData, newItem]
    }));
    setNewUrl('');
  };

  const handleDeleteItem = (id: string) => {
    setConfig(prev => ({
      ...prev,
      trainingData: prev.trainingData.filter(item => item.id !== id)
    }));
  };

  const tabs = [
    { id: 'text', label: 'Texto' },
    { id: 'website', label: 'Website' },
    { id: 'video', label: 'Vídeo' },
    { id: 'document', label: 'Documento' }
  ];
  
  const getIconForType = (type: TrainingItem['type']) => {
      switch (type) {
          case 'text': return Quote;
          case 'website': return Link;
          case 'video': return Video;
          case 'document': return FileText;
          default: return FileText;
      }
  }

  const renderInputContent = () => {
    switch (activeTab) {
      case 'text':
        return (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-8">
              <h3 className="flex items-center text-md font-semibold text-white mb-4">
                <Quote className="w-5 h-5 mr-3 text-blue-400" />
                Novo treinamento via texto
              </h3>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Escreva uma afirmação e tecle enter para cadastrar..."
                maxLength={MAX_CHARS}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddText();
                  }
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none"
                rows={4}
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-slate-500">Adicione informações factuais para a base de conhecimento.</span>
                <div className="flex items-center space-x-4">
                  <span className={`text-xs font-mono ${newText.length > MAX_CHARS * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {newText.length}/{MAX_CHARS}
                  </span>
                  <button
                    onClick={handleAddText}
                    disabled={!newText.trim()}
                    className="bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    Cadastrar
                  </button>
                </div>
              </div>
          </div>
        );
      case 'website':
        return (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-8">
              <h3 className="flex items-center text-md font-semibold text-white mb-4">
                <Link className="w-5 h-5 mr-3 text-blue-400" />
                Novo treinamento via Website
              </h3>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Cole a URL do website (ex: https://meusite.com/faq)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddWebsite();
                  }
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 focus:border-blue-500 outline-none"
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-slate-500">O agente irá rastrear o conteúdo desta URL para treinamento.</span>
                <button
                  onClick={handleAddWebsite}
                  disabled={!newUrl.trim() || !newUrl.startsWith('http')}
                  className="bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                  Adicionar URL
                </button>
              </div>
          </div>
        );
      case 'video':
      case 'document':
        return (
          <div className="text-center p-10 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white">Funcionalidade em desenvolvimento</h3>
            <p className="text-slate-400 mt-2">As opções de treinamento por {activeTab === 'video' ? 'vídeo' : 'documento'} estarão disponíveis em breve.</p>
          </div>
        );
      default:
        return null;
    }
  };
  
  const renderTrainingList = () => {
      const filteredData = config.trainingData.filter(item => item.type === activeTab);
      
      if (filteredData.length === 0) {
          return (
             <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
                <p className="text-slate-500">Nenhum dado de treinamento de {tabs.find(t => t.id === activeTab)?.label.toLowerCase()} adicionado ainda.</p>
             </div>
          );
      }
      
      return (
          <div className="space-y-4">
              {filteredData.map(item => {
                  const Icon = getIconForType(item.type);
                  // Exibe a fonte para website, conteúdo para outros
                  const displayContent = item.type === 'website' ? item.source : item.content;
                  
                  return (
                      <div key={item.id} className="bg-slate-800/30 rounded-lg p-4 border border-slate-700 flex justify-between items-start group">
                          <div className="flex items-start">
                              <Icon className="w-5 h-5 text-slate-500 mr-4 mt-1 flex-shrink-0" />
                              <div className="flex flex-col">
                                  <p className="text-sm text-slate-300 leading-relaxed break-all">{displayContent}</p>
                                  {item.type === 'website' && (
                                      <span className="text-xs text-slate-500 mt-1 italic">URL de Origem</span>
                                  )}
                              </div>
                          </div>
                          <button onClick={() => handleDeleteItem(item.id)} className="ml-4 p-1.5 rounded-md hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-400" />
                          </button>
                      </div>
                  );
              })}
          </div>
      );
  }


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Treinamentos</h1>
          <p className="text-slate-400 mt-1">Ensine seu assistente com textos, websites ou documentos.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Buscar treinamento"
            className="w-64 bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-white focus:border-blue-500 outline-none"
          />
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Content */}
      <div>
        {renderInputContent()}
        
        <h2 className="text-xl font-semibold text-white mb-4 mt-8">Dados de Treinamento Ativos ({tabs.find(t => t.id === activeTab)?.label})</h2>
        {renderTrainingList()}
      </div>
    </div>
  );
};

export default TrainingPanel;