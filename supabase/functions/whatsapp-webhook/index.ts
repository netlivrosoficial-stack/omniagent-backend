import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Configuração de CORS para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URL da API Gemini (usada para simulação)
const GEMINI_API_URL = "https://api.omniagent.com/gemini-proxy"; 

serve(async (req) => {
  // 1. Lidar com requisições OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { message, sender } = await req.json();
    
    console.log(`Mensagem recebida de ${sender}: ${message}`);

    // --- Lógica de Autenticação (Opcional, mas boa prática) ---
    // Em um cenário real, você verificaria um token de autenticação do WhatsApp aqui.
    
    // --- Lógica de IA (Simulação) ---
    // Aqui, em um ambiente real, você chamaria o Gemini com a mensagem e a configuração do agente.
    
    let aiResponseText = `Olá, ${sender}! Recebi sua mensagem: "${message}". 
    
    [SIMULAÇÃO DE RESPOSTA DA IA]
    
    Seu agente OmniAgent está ativo e processou esta mensagem. Em produção, eu chamaria o Gemini para gerar uma resposta inteligente aqui.`;

    // 2. Retornar a resposta simulada
    return new Response(
      JSON.stringify({ 
        status: 'success', 
        response: aiResponseText,
        processedBy: 'OmniAgent Edge Function'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})