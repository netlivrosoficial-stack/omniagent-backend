import { useState, useEffect, useCallback } from 'react';
import { AgentConfig } from '../types';
import { supabase } from '../integrations/supabase/client';
import { SUPREME_PROMPT_DEFAULT } from '../../constants'; // Corrigido o caminho de importação

const DEFAULT_CONFIG: AgentConfig = {
    name: 'OmniAgent',
    personality: 'Professional',
    apiKey: '',
    modules: { sales: true, support: true, onboarding: false, audio: false },
    channels: { telegram: false, whatsappCloud: false, whatsapp: true, messenger: false },
    integrations: { elevenLabs: false, googleCalendar: false, plugChat: false, eVendi: false },
    systemInstruction: SUPREME_PROMPT_DEFAULT,
    trainingData: [],
};

export const useAgentConfig = () => {
    const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const fetchConfig = useCallback(async (userId: string) => {
        setIsLoading(true);
        
        // 1. Tenta buscar do Supabase
        const { data, error } = await supabase
            .from('agent_configs')
            .select('config')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
            console.error("Error fetching agent config:", error);
        }

        if (data) {
            const loadedConfig = data.config as AgentConfig;
            // Ensure necessary keys exist for backwards compatibility
            if (!loadedConfig.trainingData) loadedConfig.trainingData = [];
            if (!loadedConfig.channels) loadedConfig.channels = DEFAULT_CONFIG.channels;
            if (!loadedConfig.integrations) loadedConfig.integrations = DEFAULT_CONFIG.integrations;
            if (!loadedConfig.apiKey) loadedConfig.apiKey = '';
            
            setConfig(loadedConfig);
        } else {
            // 2. Se não houver no DB, usa o padrão e tenta salvar
            setConfig(DEFAULT_CONFIG);
            await saveConfig(userId, DEFAULT_CONFIG);
        }
        
        setIsLoading(false);
    }, []);

    const saveConfig = useCallback(async (userId: string, newConfig: AgentConfig) => {
        setIsSaving(true);
        
        const payload = {
            user_id: userId,
            config: newConfig,
        };
        
        const { error } = await supabase
            .from('agent_configs')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            console.error("Error saving agent config:", error);
        }
        
        setIsSaving(false);
    }, []);

    // Efeito para carregar a configuração inicial
    useEffect(() => {
        const loadInitialConfig = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await fetchConfig(user.id);
            } else {
                setIsLoading(false);
            }
        };
        loadInitialConfig();
    }, [fetchConfig]);

    // Efeito para salvar a configuração sempre que ela mudar (debounce seria ideal, mas vamos simplificar)
    useEffect(() => {
        if (!isLoading) {
            const save = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await saveConfig(user.id, config);
                }
            };
            save();
        }
    }, [config, isLoading, saveConfig]);

    return { config, setConfig, isLoading, isSaving };
};