import { FC } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/src/integrations/supabase/client';
import { Bot } from 'lucide-react';

const Login: FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        <div className="flex flex-col items-center">
          <Bot className="w-10 h-10 text-blue-500 mb-2" />
          <h1 className="text-2xl font-bold text-white">OmniAgent Architect</h1>
          <p className="text-slate-400 text-sm mt-1">Faça login para configurar seu Agente Supremo.</p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          providers={['google']} // Adicionando Google como provedor
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6', // blue-500
                  brandAccent: '#2563eb', // blue-600
                  defaultButtonBackground: '#1e293b', // slate-800
                  defaultButtonBackgroundHover: '#334155', // slate-700
                  defaultButtonBorder: '#475569', // slate-600
                  inputBackground: '#0f172a', // slate-900
                  inputBorder: '#475569', // slate-600
                  inputBorderHover: '#3b82f6', // blue-500
                  inputBorderFocus: '#3b82f6', // blue-500
                  inputText: '#e2e8f0', // slate-200
                },
              },
            },
          }}
          theme="dark"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Seu email',
                password_label: 'Sua senha',
                email_input_placeholder: 'email@exemplo.com',
                password_input_placeholder: '••••••••',
                button_label: 'Entrar',
                social_provider_text: 'Entrar com {{provider}}',
                link_text: 'Já tem uma conta? Entrar',
              },
              sign_up: {
                email_label: 'Seu email',
                password_label: 'Crie uma senha',
                email_input_placeholder: 'email@exemplo.com',
                password_input_placeholder: '••••••••',
                button_label: 'Cadastrar',
                social_provider_text: 'Cadastrar com {{provider}}',
                link_text: 'Não tem uma conta? Cadastrar',
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