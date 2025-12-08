import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { Bot } from 'lucide-react';

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
        />
      </div>
    </div>
  );
};

export default Login;