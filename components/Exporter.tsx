import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { AgentConfig } from '../types';

interface ExporterProps {
  config: AgentConfig;
}

const Exporter: React.FC<ExporterProps> = ({ config }) => {
  const [copied, setCopied] = useState(false);
  
  const exportData = {
    agentFramework: "OmniAgent v1.0",
    generatedWith: "Google AI Studio",
    timestamp: new Date().toISOString(),
    agentConfiguration: config,
    definedTools: [
      { name: "save_lead", description: "Salva um novo lead no banco de dados." },
      { name: "create_ticket", description: "Cria um ticket de suporte." },
      { name: "check_stock", description: "Verifica o status do inventário de um produto." },
      { name: "send_file", description: "Envia um arquivo para o usuário." },
    ],
    preconfiguredFlows: [
      "Primeiro Contato & Triagem",
      "Vendas & Conversão",
      "Suporte Técnico",
      "Abandono de Lead & Follow-up"
    ]
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error("Failed to copy text: ", err));
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.toLowerCase().replace(/\s/g, '-')}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
       <div>
        <h1 className="text-3xl font-bold text-white">Exportar Configuração</h1>
        <p className="text-slate-400 mt-1">Exporte a configuração do seu agente como um arquivo JSON para o Dyad ou outras plataformas.</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="p-4 flex justify-between items-center border-b border-slate-700">
          <p className="font-semibold text-white">agent-config.json</p>
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Baixar</span>
            </button>
          </div>
        </div>

        <pre className="p-6 text-sm text-slate-300 overflow-x-auto bg-slate-900/50 rounded-b-xl max-h-[60vh]">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};

export default Exporter;