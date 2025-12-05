import React, { useState, useEffect } from 'react';
import { Users, Loader2, AlertTriangle, Phone, Tag, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Lead {
    id: string;
    name: string;
    phone: string;
    origin: string | null;
    interest_level: string | null;
    created_at: string;
}

const LeadsPanel: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching leads:", error);
            setError(error.message);
        } else {
            setLeads(data as Lead[]);
        }
        setIsLoading(false);
    };
    
    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('pt-BR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center">
                    <Users className="w-7 h-7 mr-3 text-blue-400" />
                    Leads Gerados
                </h1>
                <p className="text-slate-400 mt-1">Visualize os leads capturados pelo seu agente através da ferramenta `save_lead`.</p>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                {isLoading && (
                    <div className="flex justify-center items-center py-10 text-blue-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Carregando leads...
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-900/30 text-red-400 rounded-lg flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-3" />
                        Erro ao carregar dados: {error}
                    </div>
                )}

                {!isLoading && !error && (
                    leads.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            Nenhum lead encontrado. Tente usar o Simulador para gerar um lead!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {leads.map((lead) => (
                                <div key={lead.id} className="bg-slate-900 p-4 rounded-lg border border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center">
                                    <div className="flex flex-col">
                                        <p className="text-lg font-semibold text-white">{lead.name}</p>
                                        <div className="flex items-center text-sm text-slate-400 mt-1 space-x-4">
                                            <span className="flex items-center"><Phone className="w-4 h-4 mr-1 text-blue-400" /> {lead.phone}</span>
                                            <span className="flex items-center"><Tag className="w-4 h-4 mr-1 text-amber-400" /> Origem: {lead.origin || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start md:items-end mt-3 md:mt-0">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            lead.interest_level === 'Alto' ? 'bg-emerald-900 text-emerald-400' :
                                            lead.interest_level === 'Médio' ? 'bg-amber-900 text-amber-400' :
                                            'bg-slate-700 text-slate-300'
                                        }`}>
                                            {lead.interest_level || 'Baixo'}
                                        </span>
                                        <span className="text-xs text-slate-500 mt-1 flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {formatTimestamp(lead.created_at)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default LeadsPanel;