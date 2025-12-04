import React from 'react';
import { AgentConfig } from '../types';

// Placeholder icons for integrations
const ElevenLabsIcon = () => (
    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
        <div className="w-3 h-8 bg-pink-500 rounded-sm"></div>
        <div className="w-3 h-8 bg-pink-400 rounded-sm ml-1 opacity-75"></div>
    </div>
);
const GoogleCalendarIcon = () => (
    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center font-bold text-blue-400 text-2xl">31</div>
);
const PlugChatIcon = () => (
    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
        <div className="w-8 h-6 bg-indigo-500 rounded-md relative">
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-slate-200"></div>
            <div className="absolute -top-1 -right-3 w-2 h-2 rounded-full bg-slate-200"></div>
        </div>
    </div>
);
const EVendiIcon = () => (
    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
       <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H5.25L8.25 15H18.75L21.75 6H6.75" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9" cy="20.25" r="1.5" fill="#A78BFA"/>
            <circle cx="18" cy="20.25" r="1.5" fill="#A78BFA"/>
            <path d="M15 11.25L12 8.25L9 11.25" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
       </svg>
    </div>
);


interface IntegrationCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    active: boolean;
    onToggle: () => void;
    isBeta?: boolean;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({ icon, title, description, active, onToggle, isBeta }) => (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col justify-between transition-all hover:border-slate-600 hover:shadow-lg">
        <div className="p-6">
            <div className="mb-4">{icon}</div>
            <h3 className="font-semibold text-white text-lg">{title}</h3>
            <p className="text-slate-400 text-sm mt-1 h-20">{description}</p>
        </div>
        <div className="border-t border-slate-700 p-4">
             {isBeta ? (
                <p className="text-center text-amber-400 text-sm font-medium">Apenas para beta e-vendi</p>
            ) : (
                <button
                    onClick={onToggle}
                    className={`w-full text-center font-medium text-sm py-2 rounded-lg transition-colors ${
                        active 
                            ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                    {active ? 'DESATIVAR INTEGRAÇÃO' : 'ATIVAR INTEGRAÇÃO'}
                </button>
            )}
        </div>
    </div>
);

interface IntegrationsPanelProps {
    config: AgentConfig;
    setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({ config, setConfig }) => {
    
    const handleToggle = (integration: keyof AgentConfig['integrations']) => {
        setConfig(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                [integration]: !prev.integrations[integration],
            }
        }));
    };

    const integrationData = [
        { 
            id: 'elevenLabs',
            icon: <ElevenLabsIcon />,
            title: 'ElevenLabs',
            description: 'Com ElevenLabs você dá a capacidade do seu assistente responder seus clientes em áudio, tornando ainda mais humanizado.'
        },
        { 
            id: 'googleCalendar',
            icon: <GoogleCalendarIcon />,
            title: 'Google Calendar',
            description: 'Com google calendar sua assistente será capaz de agendar reuniões, criar link da chamada e já enviar os convites.'
        },
        { 
            id: 'plugChat',
            icon: <PlugChatIcon />,
            title: 'Plug Chat',
            description: 'Caso sua IA ainda não consiga responder algumas perguntas, permita direcionar o atendimento a um humano.'
        },
        { 
            id: 'eVendi',
            icon: <EVendiIcon />,
            title: 'E-vendi',
            description: 'Faça sua IA ter acesso a todos os produtos da sua loja, podendo falar sobre preços, enviar fotos e links.',
            isBeta: true
        },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-white">Integrações</h1>
                <p className="text-slate-400 mt-1">Conecte o seu assistente a outros aplicativos, isso permite que ele obtenha informações mais precisas ou agende reuniões para você.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {integrationData.map(integration => (
                    <IntegrationCard
                        key={integration.id}
                        icon={integration.icon}
                        title={integration.title}
                        description={integration.description}
                        active={config.integrations[integration.id as keyof AgentConfig['integrations']]}
                        onToggle={() => handleToggle(integration.id as keyof AgentConfig['integrations'])}
                        isBeta={integration.isBeta}
                    />
                ))}
            </div>
        </div>
    );
};

export default IntegrationsPanel;
