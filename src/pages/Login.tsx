import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client'; // Caminho corrigido

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Bem-vindo ao OmniAgent</h1>
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
                        inputBackground: '#0f172a', // slate-900
                        inputBorder: '#475569', // slate-600
                        inputBorderHover: '#3b82f6',
                        inputBorderFocus: '#3b82f6',
                        inputText: '#e2e8f0', // slate-200
                    },
                },
            },
          }}
          theme="dark"
          view="sign_in"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email',
                password_label: 'Senha',
                button_label: 'Entrar',
                social_provider_text: 'Entrar com {{provider}}',
                link_text: 'Já tem uma conta? Faça login',
              },
              sign_up: {
                email_label: 'Email',
                password_label: 'Criar Senha',
                button_label: 'Cadastrar',
                link_text: 'Não tem uma conta? Cadastre-se',
              },
              forgotten_password: {
                link_text: 'Esqueceu sua senha?',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;