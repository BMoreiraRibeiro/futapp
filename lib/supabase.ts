import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yfekpdyinxaxjofkqvbe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZWtwZHlpbnhheGpvZmtxdmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTI4NzUsImV4cCI6MjA3NTY4ODg3NX0.YBm8otsxnn2oXtH4E-SaQO_5-6nlIhJ1R0Cowr7o71Q';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});