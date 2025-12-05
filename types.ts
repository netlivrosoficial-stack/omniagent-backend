export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  toolCalls?: ToolCallLog[];
}

export interface ToolCallLog {
  name: string;
  args: Record<string, any>;
  result?: any;
}

export interface TrainingItem {
  id: string;
  type: 'text' | 'website' | 'video' | 'document';
  content: string;
  source?: string;
}

export interface MetaApiConfig {
  verifyToken: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface AgentConfig {
  name: string;
  personality: string;
  apiKey: string; // Novo campo para a chave de API
  metaApi: MetaApiConfig; // Configuração da Meta Cloud API
  modules: {
    sales: boolean;
    support: boolean;
    onboarding: boolean;
    audio: boolean;
  };
  channels: {
    telegram: boolean;
    whatsappCloud: boolean;
    whatsapp: boolean;
    messenger: boolean;
  };
  integrations: {
    elevenLabs: boolean;
    googleCalendar: boolean;
    plugChat: boolean;
    eVendi: boolean;
  };
  systemInstruction: string;
  trainingData: TrainingItem[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SIMULATOR = 'SIMULATOR',
  CONFIGURATION = 'CONFIGURATION',
  TRAINING = 'TRAINING',
  CHANNELS = 'CHANNELS',
  INTEGRATIONS = 'INTEGRATIONS',
  EXPORTER = 'EXPORTER',
  LEADS = 'LEADS' // Novo
}