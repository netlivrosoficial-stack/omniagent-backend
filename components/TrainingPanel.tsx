import React, { useState, useEffect, useCallback } from 'react';
import { AgentConfig, TrainingItem } from '../types';
import { Search, Quote, FileText, Trash2, Link, Video, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../src/integrations/supabase/client';
import { useAuth } from '../src/SessionContextProvider';

// URL do webhook do n8n para processar embeddings
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

interface TrainingPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

const TrainingPanel: React.FC<TrainingPanelProps> = ({ config, setConfig }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'text' | 'website' | 'video' | 'document'>('text');
  const [newText, setNewText] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [isLoadingTraining, setIsLoadingTraining] = useState(true);
  const [errorTraining, setErrorTraining] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false); // Novo estado de carregamento para adição
  const [addStatus, setAddStatus] = useState<'idle' | 'success' | 'error'>('idle'); // Novo estado de status
  const MAX_CHARS = 8192;

  const fetchTrainingItems = useCallback(async () => {
    if (!user) return;
    setIsLoadingTraining(true);
    setErrorTraining(null);

    const { data, error } = await supabase
      .from('training_data')
      .select('*')
      .eq('agent_id', user.id) // Assumindo que agent_id é o user.id
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching training data:", error);
      setErrorTraining(error.message);
      setTrainingItems([]);
    } else {
      // Mapeia os dados do Supabase para o tipo TrainingItem
      const fetchedItems: TrainingItem[] = data.map((item: any) => {
        let metadata = item.metadata;
        
        // Adiciona lógica defensiva para garantir que metadata seja um objeto,
        // tratando casos onde jsonb pode ser retornado como string ou null.
        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            } catch (e) {
                console.error("Failed to parse metadata string:", e);
                metadata = {};
            }
        }
        
        if (typeof metadata !== 'object' || metadata === null) {
            metadata = {};
        }
        
        const itemType = metadata.type || 'text';
        
        return {
          id: item.id,
          type: itemType as TrainingItem['type'],
          content: item.content,
          source: metadata.source || undefined,
        };
      });
      setTrainingItems(fetchedItems);
    }
    setIsLoadingTraining(false);
  }, [user]);

  useEffect(() => {
    fetchTrainingItems();
  }, [fetchTrainingItems, activeTab]); // Refetch quando a aba muda

  const sendWebhook = async (action: 'add' | 'delete', item: Partial<TrainingItem> & { agent_id: string }) => {
    if (!N8N_WEBHOOK_URL) {
      const msg = "**ERRO DE CONFIGURAÇÃO:** A variável `VITE_N8N_WEBHOOK_URL` não está definida. O treinamento não será salvo.";
      setErrorTraining(msg);
      throw new Error(msg);
    }

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, item }),
      });
      
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Falha no Webhook (Status ${response.status}): ${errorText.substring(0, 100)}...`);
      }
      
      console.log(`Webhook para n8n enviado com sucesso para ação: ${action}`);
    } catch (webhookError: any) {
      console.error("Erro ao enviar webhook para n8n:", webhookError);
      setErrorTraining(`Erro ao sincronizar com o n8n. Verifique a URL do webhook e o fluxo do n8n. Detalhes: ${webhookError.message}`);
      throw webhookError; // Re-lança para ser capturado pelo handler de adição
    }
  };

  const handleAddText = async () => {
    if (!newText.trim() || !user || isAdding) return;
    
    setIsAdding(true);
    setAddStatus('idle');
    setErrorTraining(null);
    
    const content = newText.trim();
    // Geramos um ID temporário apenas para o payload do webhook, se necessário,
    // mas não o adicionamos ao estado local.
    const tempId = `temp-${Date.now()}`; 

    try {
        await sendWebhook('add', { 
            id: tempId, 
            agent_id: user.id, 
            content: content, 
            metadata: { type: 'text' } 
        });
        setAddStatus('success');
        setNewText(''); // Limpa o input
        // Após o sucesso, recarrega a lista para obter o ID real e confirmar o salvamento
        await fetchTrainingItems(); 
    } catch (e: any) {
        setAddStatus('error');
        setErrorTraining(e.message);
    } finally {
        setIsAdding(false);
        setTimeout(() => setAddStatus('idle'), 3000);
    }
  };
  
  const handleAddWebsite = async () => {
    if (!newUrl.trim() || !newUrl.startsWith('http') || !user || isAdding) return; 
    
    setIsAdding(true);
    setAddStatus('idle');
    setErrorTraining(null);
    
    const url = newUrl.trim();
    const tempId = `temp-${Date.now()}`; 

    try {
        await sendWebhook('add', { 
            id: tempId, 
            agent_id: user.id, 
            content: `URL de treinamento: ${url}`, 
            metadata: { type: 'website', source: url } 
        });
        setAddStatus('success');
        setNewUrl(''); // Limpa o input
        await fetchTrainingItems(); 
    } catch (e: any) {
        setAddStatus('error');
        setErrorTraining(e.message);
    } finally {
        setIsAdding(false);
        setTimeout(() => setAddStatus('idle'), 3000);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    
    // Remove o item localmente para feedback imediato
    const itemToDelete = trainingItems.find(item => item.id === id);
    setTrainingItems(prev => prev.filter(item => item.id !== id));

    try {
        await sendWebhook('delete', { agent_id: user.id, id });
        // Se o webhook for bem-sucedido, o item já foi removido localmente.
    } catch (e: any) {
        // Se falhar, adiciona o item de volta e mostra erro
        if (itemToDelete) {
            setTrainingItems(prev => [itemToDelete, ...prev]);
        }
        setErrorTraining(`Falha ao deletar item. Tente novamente. Detalhes: ${e.message}`);
    }
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
                    disabled={!newText.trim() || isAdding}
                    className="bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar'}
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
                  disabled={!newUrl.trim() || !newUrl.startsWith('http') || isAdding}
                  className="bg-blue-600 text-white font-medium px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar URL'}
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
      const filteredData = trainingItems.filter(item => item.type === activeTab);
      
      if (isLoadingTraining) {
          return (
              <div className="flex justify-center items-center py-10 text-blue-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Carregando dados de treinamento...
              </div>
          );
      }

      if (errorTraining && !isAdding) { // Mostra erro de carregamento/sincronização geral
          return (
              <div className="p-4 bg-red-900/30 text-red-400 rounded-lg flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-3" />
                  Erro ao carregar dados de treinamento: {errorTraining}
              </div>
          );
      }
      
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
      
      {/* Feedback de Adição */}
      {addStatus === 'success' && (
          <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-lg flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">Item de treinamento adicionado com sucesso! Sincronizando com o banco de dados.</p>
          </div>
      )}
      {addStatus === 'error' && errorTraining && (
          <div className="p-3 bg-red-900/30 text-red-400 rounded-lg flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-sm font-medium">Falha ao adicionar item: {errorTraining}</p>
          </div>
      )}
      
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