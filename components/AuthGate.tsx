import React, { useState, useEffect } from 'react';
import { supabase } from '../src/integrations/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
    children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Tenta obter a sessão inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Monitora mudanças de estado de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">Acesso ao OmniAgent</h1>
                    <Auth
                        supabaseClient={supabase}
                        providers={[]}
                        appearance={{
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: '#3b82f6', // blue-500
                                        brandAccent: '#2563eb', // blue-600
                                        defaultButtonBackground: '#1e293b', // slate-800
                                        defaultButtonBorder: '#334155', // slate-700
                                        defaultButtonText: '#e2e8f0', // slate-200
                                        inputBackground: '#0f172a', // slate-900
                                        inputBorder: '#334155', // slate-700
                                        inputLabelText: '#94a3b8', // slate-400
                                    },
                                },
                            },
                        }}
                        theme="dark"
                        localization={{
                            variables: {
                                sign_in: {
                                    email_label: 'Email',
                                    password_label: 'Senha',
                                    email_input_placeholder: 'Seu email',
                                    password_input_placeholder: 'Sua senha',
                                    button_label: 'Entrar',
                                    loading_button_label: 'Entrando...',
                                    link_text: 'Já tem uma conta? Entrar',
                                },
                                sign_up: {
                                    email_label: 'Email',
                                    password_label: 'Criar Senha',
                                    email_input_placeholder: 'Seu email',
                                    password_input_placeholder: 'Crie uma senha',
                                    button_label: 'Cadastrar',
                                    loading_button_label: 'Cadastrando...',
                                    link_text: 'Não tem uma conta? Cadastrar',
                                },
                                forgot_password: {
                                    link_text: 'Esqueceu sua senha?',
                                },
                            },
                        }}
                    />
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthGate;