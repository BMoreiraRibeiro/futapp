// Hook para acessar as configurações do cluster globalmente
import { useClusterSettings } from './useClusterSettings';
import { useAuth } from '../lib/auth';

export function useTeamConfig() {
  const { clusterName } = useAuth();
  const { settings, loading } = useClusterSettings(clusterName);

  return {
    teamAName: settings.team_a_name,
    teamBName: settings.team_b_name,
    teamAColor: settings.team_a_color,
    teamBColor: settings.team_b_color,
    ratingVariation: settings.rating_variation,
    loading,
  };
}
