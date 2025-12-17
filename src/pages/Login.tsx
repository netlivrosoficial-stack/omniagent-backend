import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { Bot } from 'lucide-react';

// Definição de tradução para Português (pt)
const i18n = {
  pt: {
    sign_in: {
      email_label: 'E-mail',
      password_label: 'Senha',
      email_input_placeholder: 'seu@email.com',
      password_input_placeholder: '••••••••',
      button_label: 'Entrar',
      social_auth_button_label: 'Entrar com {{provider}}',
      link_text: 'Não tem uma conta? Cadastrar',
    },
    sign_up: {
      email_label: 'E-mail',
      password_label: 'Crie uma senha',
      email_input_placeholder: 'seu@email.com',
      password_input_placeholder: '••••••••',
      button_label: 'Cadastrar',
      social_auth_button_label: 'Cadastrar com {{provider}}',
      link_text: 'Já tem uma conta? Entrar',
    },
    forgotten_password: {
      email_label: 'E-mail',
      email_input_placeholder: 'seu@email.com',
      button_label: 'Enviar instruções de redefinição',
      link_text: 'Esqueceu sua senha?',
    },
    update_password: {
      password_label: 'Nova Senha',
      password_input_placeholder: 'Sua nova senha',
      button_label: 'Atualizar Senha',
    },
    magic_link: {
      email_label: 'E-mail',
      email_input_placeholder: 'seu@email.com',
      button_label: 'Enviar Link Mágico',
      link_text: 'Entrar com Link Mágico',
    },
    verify_otp: {
      email_label: 'E-mail',
      email_input_placeholder: 'seu@email.com',
      phone_label: 'Telefone',
      phone_input_placeholder: '(99) 99999-9999',
      token_label: 'Código de Verificação (OTP)',
      token_input_placeholder: '123456',
      button_label: 'Verificar',
    },
  },
};


const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800/50 p-8 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Bot className="w-10 h-10 text-blue-500 mb-2" />
          <h1 className="text-2xl font-bold text-white">Acesso OmniAgent</h1>
          <p className="text-slate-400 text-sm mt-1">Faça login para configurar seu Agente Supremo.</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6', // Blue 500
                  brandAccent: '#2563eb', // Blue 600
                  defaultButtonBackground: '#1e293b', // Slate 800
                  defaultButtonBackgroundHover: '#334155', // Slate 700
                  defaultButtonBorder: '#475569', // Slate 600
                  inputBackground: '#0f172a', // Slate 900
                  inputBorder: '#475569',
                  inputBorderHover: '#3b82f6',
                  inputBorderFocus: '#3b82f6',
                  inputText: '#e2e8f0',
                },
              },
            },
          }}
          theme="dark"
          providers={[]}
          redirectTo={window.location.origin}
          localization={{
            lang: 'pt',
            variables: i18n.pt,
          }}
        />
      </div>
    </div>
  );
};

export default Login;