import React from 'react';
import { ArrowUpRight, MessageCircle, DollarSign, Ticket, Users } from 'lucide-react';
import { MOCK_CHART_DATA } from '../constants';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; change: string; }> = ({ title, value, icon: Icon, change }) => (
  <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className="p-3 bg-slate-700/50 rounded-lg">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
    </div>
    <div className="flex items-center text-sm text-emerald-400 mt-4">
      <ArrowUpRight className="w-4 h-4 mr-1" />
      <span>{change} vs mês passado</span>
    </div>
  </div>
);

const SimpleBarChart: React.FC<{ data: any[], dataKey: string, labelKey: string, color: string }> = ({ data, dataKey, labelKey, color }) => {
  const maxValue = Math.max(...data.map(d => d[dataKey]));
  return (
    <div className="w-full h-64 flex justify-between items-end space-x-2 pt-4">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group">
          <div 
            className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
            style={{ height: `${(item[dataKey] / maxValue) * 100}%`, backgroundColor: color }}
            title={`${item[labelKey]}: ${item[dataKey]}`}
          ></div>
          <span className="text-xs text-slate-500 mt-2">{item[labelKey]}</span>
        </div>
      ))}
    </div>
  );
};


const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Painel</h1>
        <p className="text-slate-400 mt-1">Visão geral do desempenho do seu agente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Mensagens" value="12.834" icon={MessageCircle} change="+12,5%" />
        <StatCard title="Leads Gerados" value="482" icon={Users} change="+8,2%" />
        <StatCard title="Tickets Criados" value="129" icon={Ticket} change="-2,1%" />
        <StatCard title="Receita Est." value="R$5.230" icon={DollarSign} change="+21,3%" />
      </div>

      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">Visão Geral da Atividade (Últimas 24h)</h2>
        <div className="flex space-x-8 text-slate-400 border-b border-slate-700 mb-4">
            <button className="py-2 border-b-2 border-blue-500 text-blue-400 font-medium">Mensagens</button>
            <button className="py-2 border-b-2 border-transparent hover:border-slate-500 transition-colors">Leads</button>
        </div>
        <SimpleBarChart data={MOCK_CHART_DATA} dataKey="messages" labelKey="name" color="#3b82f6" />
      </div>
    </div>
  );
};

export default Dashboard;