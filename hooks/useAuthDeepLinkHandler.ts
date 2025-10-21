import { useEffect } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

function parseParamsFromUrl(url: string) {
  // url pode ser: futapp://auth-callback#access_token=...&refresh_token=...
  if (!url) return {} as Record<string,string>;
  const [, hash] = url.split('#');
  if (hash) {
    return Object.fromEntries(new URLSearchParams(hash));
  }
  // fallback: query string
  const qs = url.includes('?') ? url.split('?')[1] : '';
  return qs ? Object.fromEntries(new URLSearchParams(qs)) : {} as Record<string,string>;
}

export default function useAuthDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      try {
        if (!url) return;
        const params = parseParamsFromUrl(url);

        const access_token = params.access_token || params.accessToken || params.token;
        const refresh_token = params.refresh_token || params.refreshToken;
        const ticket = params.ticket || params.t;

        if (access_token) {
          // Restaura sessão no Supabase (v2)
          await supabase.auth.setSession({ access_token, refresh_token });
          // após restaurar a sessão, navegue para a raíz autenticada
          try { router.replace('/(tabs)'); } catch (e) { /* noop */ }
          return;
        }

        if (ticket) {
          // Se existir apenas ticket, encaminhar para a página de reset/confirm dentro da app
          // A app deve implementar a rota /auth/confirm?ticket=...
          try {
            router.push({ pathname: '/auth', params: { ticket } } as any);
          } catch (e) {
            // fallback: abrir auth root
            router.replace('/auth');
          }
        }
      } catch (err) {
        console.error('Erro no deep link handler:', err);
      }
    };

    (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) handleUrl({ url: initial });
    })();

    const sub = Linking.addEventListener('url', handleUrl as any);
    return () => sub.remove();
  }, [router]);
}
