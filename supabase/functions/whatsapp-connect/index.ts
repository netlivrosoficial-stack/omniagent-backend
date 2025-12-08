import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

// Função utilitária para simular a geração de um QR Code (Base64 de um texto simples)
function generateMockQrCode(userId: string): string {
    const mockData = `OmniAgent-Session-${userId}-${Date.now()}`;
    // Simula a codificação Base64 de um QR Code real
    return btoa(mockData); 
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // 1. Autenticação: Obter o ID do usuário a partir do JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    
    const userId = user.id;
    
    // 2. Gerar QR Code e atualizar/inserir sessão
    const qrCodeData = generateMockQrCode(userId);
    
    let sessionData: any = null;
    let error: any = null;
    
    // Tenta atualizar a sessão existente
    const { data: updateData, error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({ 
            status: 'connecting', 
            qr_code_data: qrCodeData,
            last_updated: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single(); // Usando .single()

    sessionData = updateData;
    error = updateError;

    // Se não houver sessão existente (updateError.code === 'PGRST116' ou updateData é null), insere uma nova
    if ((updateError && updateError.code === 'PGRST116') || !sessionData) { 
        console.log(`[EF] No existing session found for user ${userId}. Inserting new session.`);
        
        // Se houve um erro PGRST116, limpamos o erro para tentar a inserção
        if (updateError && updateError.code === 'PGRST116') {
            error = null;
        }
        
        const { data: insertData, error: insertError } = await supabase
            .from('whatsapp_sessions')
            .insert([{ 
                user_id: userId, 
                status: 'connecting', 
                qr_code_data: qrCodeData 
            }])
            .select()
            .single(); // Usando .single()
            
        sessionData = insertData;
        error = insertError;
    } else if (sessionData) {
        console.log(`[EF] Existing session updated for user ${userId}.`);
    }

    if (error) {
        console.error("[EF] Supabase Error during session management:", error);
        throw new Error(`Failed to manage session: ${error.message}`);
    }
    
    // Agora sessionData deve ser um objeto único se for bem-sucedido
    if (!sessionData) {
        console.error("[EF] Session data is null after update/insert.");
        throw new Error("Failed to retrieve session data after connection attempt.");
    }

    return new Response(
      JSON.stringify({ 
        status: 'connecting', 
        qrCode: sessionData.qr_code_data, // Usando o dado retornado
        message: 'QR Code gerado com sucesso. Escaneie para conectar.'
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