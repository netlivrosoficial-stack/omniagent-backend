import React, { useState } from 'react';
import { AgentConfig } from '../types';
import { CheckCircle2 } from 'lucide-react';
import ChannelConfigModal from './ChannelConfigModal';

// Custom SVG Icons created to resemble brand logos without external assets
const TelegramIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="#0088CC"/>
    <path d="M34 15L16 23L22 24L24 32L34 15Z" fill="white"/>
  </svg>
);
const CloudApiIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="#E2E8F0"/>
    <path d="M22.5 15.0001C22.5 15.0001 27.5 15.0001 29.5 17.0001C31.5 19.0001 31.5 22.5001 29.5 24.5001C27.5 26.5001 22.5 26.5001 22.5 26.5001" stroke="#25D366" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 20.5C18.5 20.5 24.5 20.5 25.5 22.5C26.5 24.5 25.5 27.5 25.5 27.5" stroke="#25D366" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.5 32C20.5 32 15.5 32 13.5 30C11.5 28 11.5 24.5 13.5 22.5C15.5 20.5 20.5 20.5 20.5 20.5" stroke="#25D366" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="24" y="32" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="bold" fill="#064E3B" textAnchor="middle">B</text>
  </svg>
);
const WhatsAppIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="#25D366"/>
    <path d="M36.1,11.9c-2.7-2.7-6.4-4.2-10.1-4.2c-7.9,0-14.4,6.4-14.4,14.4c0,2.6,0.7,5.1,2,7.3l-2.1,7.7l7.9-2.1c2.1,1.2,4.5,1.8,6.8,1.8h0c7.9,0,14.4-6.4,14.4-14.4C39.6,18.3,38.2,14.6,36.1,11.9z M26,34.5h0c-2.1,0-4.2-0.6-5.9-1.7l-0.4-0.3l-4.4,1.2l1.2-4.3l-0.3-0.5c-1.2-1.9-1.9-4-1.9-6.3c0-6.6,5.3-11.9,11.9-11.9c3.2,0,6.2,1.3,8.4,3.5c2.2,2.2,3.5,5.2,3.5,8.4C37.9,29.2,32.6,34.5,26,34.5z M32.9,25.6c-0.4-0.2-2.5-1.2-2.9-1.4c-0.4-0.1-0.7-0.2-0.9,0.2c-0.3,0.4-1.1,1.4-1.3,1.6c-0.3,0.3-0.5,0.3-0.9,0.1c-0.4-0.2-1.7-0.6-3.2-2c-1.2-1.1-2-2.4-2.2-2.8c-0.2-0.4,0-0.7,0.2-0.9c0.2-0.2,0.4-0.5,0.6-0.7c0.2-0.2,0.3-0.4,0.4-0.7c0.1-0.3,0.1-0.5,0-0.7c-0.1-0.2-0.9-2.3-1.3-3.1c-0.3-0.8-0.7-0.7-0.9-0.7c-0.2,0-0.5,0-0.7,0c-0.3,0-0.7,0.1-1.1,0.5c-0.4,0.4-1.5,1.5-1.5,3.6c0,2.1,1.5,4.2,1.7,4.5c0.2,0.3,3,4.7,7.3,6.4c1,0.4,1.8,0.6,2.4,0.8c0.9,0.2,1.8,0.2,2.4-0.1c0.7-0.4,2.2-1.1,2.5-2.2C34,26.7,33.7,26.4,32.9,25.6z" fill="white"/>
  </svg>
);
const MessengerIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="url(#messenger-gradient)"/>
    <path d="M24 12.75C17.787 12.75 12.75 17.34 12.75 23.01C12.75 26.655 14.655 29.895 17.61 31.815L16.2 36.45L21.285 34.2C22.155 34.335 23.07 34.425 24 34.425C30.213 34.425 35.25 29.835 35.25 24.165C35.25 18.495 30.213 12.75 24 12.75ZM25.26 27.225L21.09 22.95L16.35 27.225L22.215 20.4L26.43 24.675L31.65 20.4L25.26 27.225Z" fill="white"/>
    <defs>
      <radialGradient id="messenger-gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(34.8 13.2) rotate(135) scale(38.8909)">
        <stop stopColor="#0062E0"/>
        <stop offset="1" stopColor="#A615BD"/>
      </radialGradient>
    </defs>
  </svg>
);


interface ChannelCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  onToggle: () => void;
  onConfigure: () => void; // New prop for configuration
}

const ChannelCard: React.FC<ChannelCardProps> = ({ icon, title, description, connected, onToggle, onConfigure }) => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-600 hover:shadow-lg">
    {connected && (
      <div className="absolute top-2 right-2 text-emerald-400 bg-emerald-900/50 p-1 rounded-full">
        <CheckCircle2 className="w-4 h-4" />
      </div>
    )}
    <div className="p-6 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="font-semibold text-white text-lg">{title}</h3>
      <p className="text-slate-400 text-sm mt-1">{description}</p>
    </div>
    <div className="border-t border-slate-700 p-4">
      {connected ? (
         <div className="flex justify-center items-center space-x-4">
           <button onClick={onConfigure} className="text-sm text-slate-300 hover:text-white">Visualizar</button>
           <span className="text-slate-600">|</span>
           <button onClick={onConfigure} className="text-sm text-slate-300 hover:text-white">Configurações</button>
         </div>
      ) : (
        <button 
          onClick={onToggle}
          className="w-full text-center text-blue-400 font-medium text-sm hover:text-white transition-colors"
        >
          Conectar
        </button>
      )}
    </div>
  </div>
);

interface ChannelsPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

const ChannelsPanel: React.FC<ChannelsPanelProps> = ({ config, setConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<{ id: keyof AgentConfig['channels'], title: string } | null>(null);

  const handleToggle = (channel: keyof AgentConfig['channels']) => {
    setConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel],
      }
    }));
  };
  
  const handleOpenModal = (channelId: keyof AgentConfig['channels'], channelTitle: string) => {
      setSelectedChannel({ id: channelId, title: channelTitle });
      setIsModalOpen(true);
  }
  
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setSelectedChannel(null);
  }

  const channelData = [
    { id: 'telegram', icon: <TelegramIcon />, title: 'Telegram', description: 'Responder via Telegram' },
    { id: 'whatsappCloud', icon: <CloudApiIcon />, title: 'Cloud API', description: 'Responder via Whatsapp Oficial' },
    { id: 'whatsapp', icon: <WhatsAppIcon />, title: 'Whatsapp', description: 'Responder via Whatsapp' },
    { id: 'messenger', icon: <MessengerIcon />, title: 'Messenger', description: 'Responder via Messenger' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Canais</h1>
        <p className="text-slate-400 mt-1">Define os canais que seu assistente vai estar conectado respondendo seus clientes.</p>
      </div>
      
      <div className="bg-slate-800/20 rounded-xl border border-slate-700 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {channelData.map(channel => (
             <ChannelCard
                key={channel.id}
                icon={channel.icon}
                title={channel.title}
                description={channel.description}
                connected={config.channels[channel.id as keyof AgentConfig['channels']]}
                onToggle={() => handleToggle(channel.id as keyof AgentConfig['channels'])}
                onConfigure={() => handleOpenModal(channel.id as keyof AgentConfig['channels'], channel.title)}
             />
          ))}
        </div>
      </div>
      
      {selectedChannel && (
          <ChannelConfigModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              channelName={selectedChannel.title}
              isConnected={config.channels[selectedChannel.id]}
          />
      )}
    </div>
  );
};

export default ChannelsPanel;