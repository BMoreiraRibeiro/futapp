const { createClient } = require('@supabase/supabase-js');

// Netlify Function: Delete user account + related rows
// Expects: Authorization: Bearer <access_token>
// Requires these env vars to be set in Netlify: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

exports.handler = async function (event) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }),
      };
    }

    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing Authorization header' }) };
    }

    const token = authHeader.split(' ')[1];
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify token -> get user
    const { data: userData, error: getUserError } = await supabase.auth.getUser(token);
    if (getUserError || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
    }

    const userId = userData.user.id;

    // 1) Find jogador ids for this user
    const { data: players, error: playersErr } = await supabase
      .from('jogadores')
      .select('id_jogador')
      .eq('user_id', userId);

    if (playersErr) {
      console.error('Error fetching jogadores for user:', playersErr);
      // continue — we'll still try to delete other things
    }

    const playerIds = (players || []).map((p) => p.id_jogador).filter(Boolean);

    // 2) Delete pagamentos_jogador_por_mes for those players
    if (playerIds.length > 0) {
      const { error: pagamentosErr } = await supabase
        .from('pagamentos_jogador_por_mes')
        .delete()
        .in('player_id', playerIds);
      if (pagamentosErr) console.warn('pagamentos_jogador_por_mes delete error:', pagamentosErr);

      const { error: calotesErr } = await supabase
        .from('calotes_jogo')
        .delete()
        .in('id_jogador', playerIds);
      if (calotesErr) console.warn('calotes_jogo delete error:', calotesErr);
    }

    // 3) Delete jogadores for this user
    const { error: delPlayersErr } = await supabase
      .from('jogadores')
      .delete()
      .eq('user_id', userId);
    if (delPlayersErr) console.warn('Erro ao eliminar jogadores do user (server):', delPlayersErr);

    // 4) Remove from cluster_members
    const { error: memberErr } = await supabase
      .from('cluster_members')
      .delete()
      .eq('user_id', userId);
    if (memberErr) console.warn('Erro ao remover cluster_members (server):', memberErr);

    // 5) As last step, remove the auth user using admin.deleteUser
    const { data: delData, error: delAuthErr } = await supabase.auth.admin.deleteUser(userId);
    if (delAuthErr) {
      console.error('Erro ao apagar auth user (server):', delAuthErr);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete auth user', details: delAuthErr }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Unexpected error in delete-account function:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected server error' }) };
  }
};
