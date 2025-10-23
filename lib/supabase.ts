import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = 'https://yfekpdyinxaxjofkqvbe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZWtwZHlpbnhheGpvZmtxdmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTI4NzUsImV4cCI6MjA3NTY4ODg3NX0.YBm8otsxnn2oXtH4E-SaQO_5-6nlIhJ1R0Cowr7o71Q';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Importante para OAuth
    flowType: 'pkce', // Usar PKCE para maior segurança em mobile
  },
  // Configurações adicionais para melhor compatibilidade OAuth
  global: {
    headers: {
      'X-Client-Info': `futapp-${Platform.OS}`,
    },
  },
});

// Gerenciar refresh automático baseado no estado da app
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}