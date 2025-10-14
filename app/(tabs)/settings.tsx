import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView, Image, Animated, Modal, Alert } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { colors } from '../../lib/colors';
import { Moon, Sun, Save, Shield, User, Globe, Settings as SettingsIcon, Lock, ChevronRight, X, Edit2, Trash2, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from '../../components/Toast';
import { useLanguage } from '../../lib/language';
import { AdminModal } from '../../components/AdminModal';
import { useClusterSettings } from '../../hooks/useClusterSettings';
import { supabase } from '../../lib/supabase';

// Cores predefinidas para as equipes
const TEAM_COLORS = [
  { name: 'Azul', value: '#3498db' },
  { name: 'Vermelho', value: '#e74c3c' },
  { name: 'Verde', value: '#2ecc71' },
  { name: 'Amarelo', value: '#f1c40f' },
  { name: 'Roxo', value: '#9b59b6' },
  { name: 'Laranja', value: '#e67e22' },
];

export default function SettingsScreen() {
  const { signOut, isAdmin, clusterName, clusterDisplayName, session, refreshClusterDisplayName, updateClusterState, clearClusterState } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const theme = isDarkMode ? colors.dark : colors.light;
  const { settings: clusterSettings, updateSettings, loading: settingsLoading } = useClusterSettings(clusterName);
  
  console.log('⚙️ Settings - isAdmin:', isAdmin);
  console.log('⚙️ Settings - loading:', settingsLoading);
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  // Controle de modais
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showAdminSettingsModal, setShowAdminSettingsModal] = useState(false);
  
  // Estados para renomear cluster
  const [isRenamingCluster, setIsRenamingCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  
  // Estados para o perfil do jogador
  const [playerName, setPlayerName] = useState('');
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState('');
  
  // Estados temporários para edição
  const [tempRatingVariation, setTempRatingVariation] = useState('2');
  const [tempTeamAName, setTempTeamAName] = useState('Equipa A');
  const [tempTeamBName, setTempTeamBName] = useState('Equipa B');
  const [tempTeamAColor, setTempTeamAColor] = useState('#3498db');
  const [tempTeamBColor, setTempTeamBColor] = useState('#e74c3c');
  
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });

  const { t, language, setLanguage } = useLanguage();

  // Carregar configurações do cluster quando disponíveis (apenas na primeira vez)
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  useEffect(() => {
    if (!settingsLoading && !settingsLoaded) {
      setTempRatingVariation(clusterSettings.rating_variation.toString());
      setTempTeamAName(clusterSettings.team_a_name);
      setTempTeamBName(clusterSettings.team_b_name);
      setTempTeamAColor(clusterSettings.team_a_color);
      setTempTeamBColor(clusterSettings.team_b_color);
      setSettingsLoaded(true);
      console.log('⚙️ Configurações carregadas:', clusterSettings);
    }
  }, [settingsLoading, settingsLoaded, clusterSettings]);

  // Carregar nome do jogador
  useEffect(() => {
    const loadPlayerName = async () => {
      console.log('🔄 Carregando nome do jogador...');
      console.log('👤 User ID:', session?.user?.id);
      console.log('🏢 Cluster UUID:', clusterName);
      
      if (!session?.user?.id || !clusterName) {
        console.log('⚠️ Falta user_id ou clusterName, não carregando nome');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('cluster_members')
          .select('nome')
          .eq('user_id', session.user.id)
          .eq('cluster_uuid', clusterName)
          .single();

        console.log('📊 Resultado da busca:', { data, error });

        if (error) throw error;
        
        if (data?.nome) {
          console.log('✅ Nome encontrado:', data.nome);
          setPlayerName(data.nome);
          setTempPlayerName(data.nome);
        } else {
          console.log('⚠️ Nome não definido na BD');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar nome do jogador:', error);
      }
    };

    loadPlayerName();
  }, [session, clusterName]);

  const saveAllSettings = async () => {
    if (!isAdmin) {
      showToast('Apenas administradores podem alterar as configurações', 'error');
      return;
    }

    if (!clusterSettings) {
      showToast('Configurações não carregadas', 'error');
      return;
    }

    try {
      await updateSettings({
        rating_variation: parseFloat(tempRatingVariation),
        team_a_name: tempTeamAName,
        team_b_name: tempTeamBName,
        team_a_color: tempTeamAColor,
        team_b_color: tempTeamBColor,
      });
      
      showToast('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('Erro ao salvar configurações', 'error');
    }
  };

  const handleRenameCluster = async () => {
    if (!newClusterName.trim()) {
      showToast('Por favor, insira um novo nome para o cluster', 'error');
      return;
    }

    if (!clusterName) {
      showToast('Cluster não identificado', 'error');
      return;
    }

    try {
      // Atualizar o nome de display do cluster (coluna 'nome_cluster')
      const { error } = await supabase
        .from('clusters')
        .update({ nome_cluster: newClusterName.trim() })
        .eq('cluster_uuid', clusterName);

      if (error) throw error;

      showToast('Nome do cluster atualizado com sucesso!', 'success');
      setIsRenamingCluster(false);
      setNewClusterName('');
      
      // Atualiza o nome do cluster no contexto de auth (atualiza o Header)
      await refreshClusterDisplayName();
      
      // Pequena pausa para garantir que o nome foi atualizado
      setTimeout(() => {
        Alert.alert(
          'Nome Atualizado',
          'O nome do cluster foi atualizado com sucesso!',
          [{ text: 'OK' }]
        );
      }, 300);
    } catch (error: any) {
      console.error('Erro ao renomear cluster:', error);
      showToast(error.message || 'Erro ao atualizar nome do cluster', 'error');
    }
  };

  const handleSavePlayerName = async () => {
    console.log('🔄 handleSavePlayerName - Iniciando atualização do nome...');
    console.log('📝 Nome atual:', playerName);
    console.log('📝 Novo nome:', tempPlayerName.trim());
    console.log('👤 User ID:', session?.user?.id);
    console.log('🏢 Cluster UUID:', clusterName);
    
    if (!tempPlayerName.trim()) {
      showToast('Por favor, insira um nome', 'error');
      return;
    }

    if (!session?.user?.id || !clusterName) {
      console.error('❌ Falta informação de sessão ou cluster');
      showToast('Informações de sessão não disponíveis', 'error');
      return;
    }

    const trimmedNewName = tempPlayerName.trim();
    
    // Se o nome não mudou, só fecha a edição
    if (trimmedNewName === playerName) {
      console.log('ℹ️ Nome não foi alterado');
      setIsEditingPlayerName(false);
      return;
    }

    try {
      // 1. Verificar se o novo nome já existe em outro jogador
      console.log('� Verificando se o novo nome já existe...');
      const { data: existingPlayer, error: checkError } = await supabase
        .from('jogadores')
        .select('nome')
        .eq('nome', trimmedNewName)
        .eq('cluster_uuid', clusterName)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Erro ao verificar novo nome:', checkError);
        throw checkError;
      }

      if (existingPlayer) {
        console.warn('⚠️ Nome já existe noutro jogador');
        showToast('Este nome já está em uso por outro jogador. Por favor, escolha outro.', 'error');
        return;
      }

      console.log('✅ Nome disponível');

      // 2. Atualizar o nome em cluster_members
      console.log('🔄 Atualizando cluster_members...');
      const { error: updateMemberError } = await supabase
        .from('cluster_members')
        .update({ nome: trimmedNewName })
        .eq('cluster_uuid', clusterName)
        .eq('user_id', session.user.id);

      if (updateMemberError) {
        console.error('❌ Erro ao atualizar cluster_members:', updateMemberError);
        throw updateMemberError;
      }

      console.log('✅ Nome atualizado em cluster_members');

      // 3. Atualizar o nome na tabela jogadores
      console.log('🔄 Atualizando jogadores...');
      const { error: updatePlayerError } = await supabase
        .from('jogadores')
        .update({ nome: trimmedNewName })
        .eq('nome', playerName)
        .eq('cluster_uuid', clusterName);

      if (updatePlayerError) {
        console.error('❌ Erro ao atualizar jogadores:', updatePlayerError);
        
        // Reverter mudança de nome em cluster_members
        await supabase
          .from('cluster_members')
          .update({ nome: playerName })
          .eq('cluster_uuid', clusterName)
          .eq('user_id', session.user.id);
        
        throw updatePlayerError;
      }

      console.log('✅ Nome atualizado em jogadores');

      // 4. Atualizar referências em golos_por_jogador
      console.log('🔄 Atualizando golos_por_jogador...');
      const { error: updateGolosError } = await supabase
        .from('golos_por_jogador')
        .update({ nome_jogador: trimmedNewName })
        .eq('nome_jogador', playerName)
        .eq('cluster_uuid', clusterName);

      if (updateGolosError) {
        console.error('⚠️ Erro ao atualizar golos_por_jogador:', updateGolosError);
        // Não faz rollback aqui pois pode não ter jogos registrados
      } else {
        console.log('✅ Golos_por_jogador atualizado');
      }

      // 5. Atualizar referências em calotes_jogo
      console.log('🔄 Atualizando calotes_jogo...');
      const { error: updateCalotesError } = await supabase
        .from('calotes_jogo')
        .update({ nome_jogador: trimmedNewName })
        .eq('nome_jogador', playerName)
        .eq('cluster_uuid', clusterName);

      if (updateCalotesError) {
        console.error('⚠️ Erro ao atualizar calotes_jogo:', updateCalotesError);
        // Não faz rollback aqui pois pode não ter jogos registrados
      } else {
        console.log('✅ Calotes_jogo atualizado');
      }

      // 6. Atualizar referências em resultados_jogos (nas strings de equipes)
      console.log('🔄 Atualizando resultados_jogos...');
      const { data: jogos, error: jogosError } = await supabase
        .from('resultados_jogos')
        .select('id_jogo, jogadores_equipa_a, jogadores_equipa_b')
        .eq('cluster_uuid', clusterName);

      if (!jogosError && jogos) {
        for (const jogo of jogos) {
          let updated = false;
          let newEquipaA = jogo.jogadores_equipa_a;
          let newEquipaB = jogo.jogadores_equipa_b;

          // Substituir nas equipas (formato: "nome1, nome2, nome3")
          if (jogo.jogadores_equipa_a && jogo.jogadores_equipa_a.includes(playerName)) {
            const equipaA = jogo.jogadores_equipa_a.split(', ');
            newEquipaA = equipaA.map((nome: string) => nome === playerName ? trimmedNewName : nome).join(', ');
            updated = true;
          }

          if (jogo.jogadores_equipa_b && jogo.jogadores_equipa_b.includes(playerName)) {
            const equipaB = jogo.jogadores_equipa_b.split(', ');
            newEquipaB = equipaB.map((nome: string) => nome === playerName ? trimmedNewName : nome).join(', ');
            updated = true;
          }

          if (updated) {
            await supabase
              .from('resultados_jogos')
              .update({
                jogadores_equipa_a: newEquipaA,
                jogadores_equipa_b: newEquipaB
              })
              .eq('id_jogo', jogo.id_jogo)
              .eq('cluster_uuid', clusterName);
          }
        }
        console.log('✅ Resultados_jogos atualizado');
      }

      // 7. Atualizar estado local
      setPlayerName(trimmedNewName);
      setIsEditingPlayerName(false);
      showToast('Nome atualizado com sucesso!', 'success');
      console.log('✅ Nome atualizado com sucesso!');
      
    } catch (error: any) {
      console.error('❌ Erro ao atualizar nome do jogador:', error);
      showToast(error.message || 'Erro ao atualizar nome', 'error');
    }
  };

  const handleLeaveCluster = () => {
    setShowLeaveConfirmation(true);
  };

  const confirmLeaveCluster = async () => {
    console.log('� confirmLeaveCluster - Saindo do cluster...');
    console.log('� clusterName:', clusterName);
    console.log('� user_id:', session?.user.id);
    
    try {
      if (!clusterName || !session?.user.id) {
        console.error('❌ ERRO: clusterName ou user_id vazio!');
        showToast('Informações do cluster não disponíveis', 'error');
        return;
      }

      console.log('🗑️ Removendo você do cluster_members...');
      const { error: memberError } = await supabase
        .from('cluster_members')
        .delete()
        .eq('cluster_uuid', clusterName)
        .eq('user_id', session.user.id);

      if (memberError) {
        console.error('❌ Erro ao sair do cluster:', memberError);
        throw memberError;
      }

      console.log('✅ Você saiu do cluster com sucesso!');
      showToast('Saiu do cluster com sucesso', 'success');
      setShowLeaveConfirmation(false);
      setShowAdminSettingsModal(false);
      
      // CRÍTICO: Limpar estados IMEDIATAMENTE (síncrono)
      console.log('🧹 [LEAVE] Limpando estados do cluster IMEDIATAMENTE...');
      console.log('🧹 [LEAVE] Estados ANTES de clearClusterState - usar useAuth para ver os valores atuais');
      
      clearClusterState();
      console.log('✅ [LEAVE] clearClusterState() executado');
      
      // Verificar se os estados foram limpos (com timeout para aguardar React batching)
      setTimeout(() => {
        console.log('🔍 [LEAVE] Verificação pós-clear (após React batching)');
        // Os logs do monitor useEffect no auth.tsx vão mostrar os valores
      }, 100);
      
      // Depois, buscar do banco (assíncrono) para confirmar
      console.log('🔄 [LEAVE] Confirmando com banco de dados...');
      await updateClusterState();
      console.log('✅ [LEAVE] updateClusterState() executado');
      
      // Pequena espera para garantir que o estado foi atualizado
      console.log('⏳ [LEAVE] Aguardando 500ms...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fazer logout para limpar completamente a sessão
      console.log('🚪 [LEAVE] Fazendo logout após sair do cluster...');
      await signOut();
      console.log('✅ [LEAVE] signOut() executado');
    } catch (error: any) {
      console.error('💥 ERRO ao sair do cluster:', error);
      showToast(error.message || 'Erro ao sair do cluster', 'error');
      setShowLeaveConfirmation(false);
    }
  };

  const handleDeleteCluster = () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteCluster = async () => {
    console.warn('� confirmDeleteCluster - Apagando cluster completo!');
    console.warn('🔴 clusterName:', clusterName);
    console.warn('🔴 isAdmin:', isAdmin);
    
    try {
      if (!clusterName) {
        console.error('❌ ERRO: clusterName está vazio!');
        showToast('Cluster não identificado', 'error');
        return;
      }

      if (!isAdmin) {
        showToast('Apenas administradores podem apagar o cluster', 'error');
        return;
      }

      console.warn('🗑️ Eliminando cluster completo...');

      // IMPORTANTE: Por causa das foreign keys com ON DELETE CASCADE,
      // ao apagar o cluster, automaticamente apaga:
      // - Todos os registos em cluster_members
      // - Todos os jogadores
      // - Todos os jogos
      // - Todas as finanças
      // - Etc.
      
      const { error: clusterError } = await supabase
        .from('clusters')
        .delete()
        .eq('cluster_uuid', clusterName);

      if (clusterError) {
        console.error('❌ Erro ao eliminar cluster:', clusterError);
        throw clusterError;
      }

      console.warn('✅ Cluster e todos os dados eliminados com sucesso!');
      showToast('Cluster eliminado com sucesso', 'success');
      setShowDeleteConfirmation(false);
      setShowAdminSettingsModal(false);
      
      // CRÍTICO: Limpar estados IMEDIATAMENTE (síncrono)
      console.log('🧹 Limpando estados do cluster IMEDIATAMENTE...');
      clearClusterState();
      
      // Depois, buscar do banco (assíncrono) para confirmar
      console.log('🔄 Confirmando com banco de dados...');
      await updateClusterState();
      
      // Pequena espera para garantir que o estado foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fazer logout para limpar completamente a sessão
      console.log('🚪 Fazendo logout após eliminar cluster...');
      await signOut();
    } catch (error: any) {
      console.error('💥 ERRO ao eliminar cluster:', error);
      showToast(error.message || 'Erro ao eliminar cluster', 'error');
      setShowDeleteConfirmation(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastConfig({
      visible: true,
      message,
      type
    });
  };

  const hideToast = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  const handleLogout = async () => {
    console.warn('👆 Settings: Botão de logout pressionado');
    try {
      setIsLoggingOut(true);
      await signOut();
      console.warn('✅ Settings: Logout realizado com sucesso');
    } catch (error) {
      console.error('💥 Settings: Erro ao fazer logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image 
        source={require('../../assets/images/background3.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <ScrollView style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{t('settings.title')}</Text>

        {/* Botão: Perfil */}
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowProfileModal(true)}
        >
          <View style={styles.menuButtonContent}>
            <User size={24} color={theme.primary} />
            <Text style={[styles.menuButtonText, { color: theme.text }]}>Perfil</Text>
          </View>
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Botão: Idioma */}
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowLanguageModal(true)}
        >
          <View style={styles.menuButtonContent}>
            <Globe size={24} color={theme.primary} />
            <Text style={[styles.menuButtonText, { color: theme.text }]}>{t('settings.language')}</Text>
          </View>
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Botão: Administração - Disponível para TODOS */}
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowAdminSettingsModal(true)}
        >
          <View style={styles.menuButtonContent}>
            <Lock size={24} color={theme.primary} />
            <Text style={[styles.menuButtonText, { color: theme.text }]}>Administração</Text>
          </View>
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Botão: Personalizar Sorteio - APENAS ADMIN */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            onPress={() => setShowDrawModal(true)}
          >
            <View style={styles.menuButtonContent}>
              <SettingsIcon size={24} color={theme.primary} />
              <Text style={[styles.menuButtonText, { color: theme.text }]}>Personalizar Sorteio</Text>
            </View>
            <ChevronRight size={24} color={theme.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[
            styles.logoutButton, 
            { backgroundColor: 'red' },
            isLoggingOut && styles.disabledButton
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Text style={[styles.logoutText, { color: '#ffffff' }]}>
            {isLoggingOut ? t('common.loggingOut') : t('common.logout')}
          </Text>
        </TouchableOpacity>

        {toastConfig.visible && (
          <Toast
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={hideToast}
          />
        )}
      </ScrollView>

      {/* Modal: Perfil */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>👤 Perfil</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {/* Informações do Clube */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.profileLabel, { color: theme.text }]}>Clube</Text>
                <Text style={[styles.profileValue, { color: theme.primary }]}>
                  {clusterDisplayName || 'Carregando...'}
                </Text>
              </View>

              {/* Nome do Jogador */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <View style={styles.profileRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileLabel, { color: theme.text }]}>Meu Nome</Text>
                    {isEditingPlayerName ? (
                      <TextInput
                        style={[
                          styles.profileInput,
                          { 
                            color: theme.text,
                            backgroundColor: theme.background,
                            borderColor: theme.border
                          }
                        ]}
                        value={tempPlayerName}
                        onChangeText={setTempPlayerName}
                        placeholder="Digite seu nome"
                        placeholderTextColor={theme.text + '80'}
                        autoFocus
                      />
                    ) : (
                      <Text style={[styles.profileValue, { color: theme.text }]}>
                        {playerName || 'Não definido'}
                      </Text>
                    )}
                  </View>
                  {isEditingPlayerName ? (
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.profileSaveButton, { backgroundColor: theme.primary }]}
                        onPress={handleSavePlayerName}
                      >
                        <Save size={18} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.profileCancelButton, { backgroundColor: theme.error }]}
                        onPress={() => {
                          setIsEditingPlayerName(false);
                          setTempPlayerName(playerName);
                        }}
                      >
                        <X size={18} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: theme.secondary }]}
                      onPress={() => setIsEditingPlayerName(true)}
                    >
                      <Edit2 size={18} color={theme.text} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Tema */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <Text style={[styles.profileLabel, { color: theme.text, marginBottom: 12 }]}>Tema</Text>
                <View style={styles.themeRow}>
                  <View style={styles.themeInfo}>
                    {isDarkMode ? <Moon size={24} color={theme.text} /> : <Sun size={24} color={theme.text} />}
                    <Text style={[styles.themeText, { color: theme.text }]}>
                      {isDarkMode ? t('settings.darkMode') : t('settings.lightMode')}
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: theme.primary }}
                    thumbColor={isDarkMode ? '#f4f3f4' : '#f4f3f4'}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Idioma */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🌐 {t('settings.language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.languageButtons}>
                <TouchableOpacity
                  style={[
                    styles.languageButton,
                    { 
                      backgroundColor: language === 'pt' ? theme.primary : theme.cardBackground,
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setLanguage('pt')}
                >
                  <Text style={[
                    styles.languageButtonText,
                    { color: language === 'pt' ? '#ffffff' : theme.text }
                  ]}>
                    Português
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageButton,
                    { 
                      backgroundColor: language === 'en' ? theme.primary : theme.cardBackground,
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[
                    styles.languageButtonText,
                    { color: language === 'en' ? '#ffffff' : theme.text }
                  ]}>
                    English
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Personalizar Sorteio */}
      <Modal
        visible={showDrawModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>⚽ Personalizar Sorteio</Text>
              <TouchableOpacity onPress={() => setShowDrawModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {/* Variação de Rating */}
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingText, { color: theme.text }]}>
                  {t('settings.maxRatingVariation')}
                </Text>
                <TextInput
                  style={[styles.ratingInput, { 
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  value={tempRatingVariation}
                  onChangeText={(value) => {
                    if (/^\d*\.?\d*$/.test(value)) {
                      setTempRatingVariation(value);
                    }
                  }}
                  keyboardType="decimal-pad"
                  maxLength={4}
                />
              </View>

              {/* Equipa A */}
              <View style={styles.teamSection}>
                <Text style={[styles.teamTitle, { color: theme.text }]}>{t('settings.teamA')}</Text>
                <View style={styles.teamNameRow}>
                  <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.name')}:</Text>
                  <TextInput
                    style={[styles.teamInput, { 
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border
                    }]}
                    value={tempTeamAName}
                    onChangeText={setTempTeamAName}
                    placeholder={t('settings.teamAPlaceholder')}
                    placeholderTextColor={theme.placeholderText}
                  />
                </View>
                <View style={styles.teamColorRow}>
                  <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.color')}:</Text>
                  <View style={styles.colorButtonsContainer}>
                    {TEAM_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color.value}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color.value },
                          tempTeamAColor === color.value && styles.selectedColorButton
                        ]}
                        onPress={() => setTempTeamAColor(color.value)}
                      />
                    ))}
                  </View>
                </View>
              </View>
              
              {/* Equipa B */}
              <View style={styles.teamSection}>
                <Text style={[styles.teamTitle, { color: theme.text }]}>{t('settings.teamB')}</Text>
                <View style={styles.teamNameRow}>
                  <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.name')}:</Text>
                  <TextInput
                    style={[styles.teamInput, { 
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                      borderColor: theme.border
                    }]}
                    value={tempTeamBName}
                    onChangeText={setTempTeamBName}
                    placeholder={t('settings.teamBPlaceholder')}
                    placeholderTextColor={theme.placeholderText}
                  />
                </View>
                <View style={styles.teamColorRow}>
                  <Text style={[styles.teamLabel, { color: theme.text }]}>{t('settings.color')}:</Text>
                  <View style={styles.colorButtonsContainer}>
                    {TEAM_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color.value}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color.value },
                          tempTeamBColor === color.value && styles.selectedColorButton
                        ]}
                        onPress={() => setTempTeamBColor(color.value)}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  saveAllSettings();
                  setShowDrawModal(false);
                }}
              >
                <Text style={styles.saveButtonText}>{t('common.saveSettings')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Administração */}
      <Modal
        visible={showAdminSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdminSettingsModal(false)}
        onShow={() => {
          console.warn('🔐 Modal de Administração foi aberta');
          console.warn('🔐 isAdmin:', isAdmin);
          console.warn('🔐 clusterName:', clusterName);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🔐 Administração</Text>
              <TouchableOpacity onPress={() => setShowAdminSettingsModal(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {/* Definir Novo Admin - APENAS ADMIN */}
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.adminButton, { backgroundColor: theme.primary, marginBottom: 16 }]}
                  onPress={() => {
                    setShowAdminSettingsModal(false);
                    setShowAdminModal(true);
                  }}
                >
                  <Shield size={20} color="#fff" />
                  <Text style={styles.adminButtonText}>Definir Novo Admin</Text>
                </TouchableOpacity>
              )}

              {/* Renomear Cluster - APENAS ADMIN */}
              {isAdmin && (
                <View style={[styles.adminSection, { borderColor: theme.border }]}>
                  <View style={styles.adminSectionHeader}>
                    <Edit2 size={20} color={theme.primary} />
                    <Text style={[styles.adminSectionTitle, { color: theme.text }]}>Nome do Cluster</Text>
                  </View>
                  {isRenamingCluster ? (
                    <View>
                      <Text style={[styles.adminLabel, { color: theme.text }]}>Nome Atual: {clusterDisplayName}</Text>
                      <TextInput
                        style={[styles.clusterInput, { 
                          backgroundColor: theme.inputBackground,
                          color: theme.text,
                          borderColor: theme.border
                        }]}
                        value={newClusterName}
                        onChangeText={setNewClusterName}
                        placeholder="Novo nome de exibição"
                        placeholderTextColor={theme.placeholderText}
                      />
                      <View style={styles.adminButtonRow}>
                        <TouchableOpacity
                          style={[styles.adminSecondaryButton, { borderColor: theme.border }]}
                          onPress={() => {
                            setIsRenamingCluster(false);
                            setNewClusterName('');
                          }}
                        >
                          <Text style={[styles.adminSecondaryButtonText, { color: theme.text }]}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.adminPrimaryButton, { backgroundColor: theme.primary }]}
                          onPress={handleRenameCluster}
                        >
                          <Text style={styles.adminPrimaryButtonText}>Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.adminSecondaryButton, { borderColor: theme.border }]}
                      onPress={() => setIsRenamingCluster(true)}
                    >
                      <Edit2 size={18} color={theme.text} />
                      <Text style={[styles.adminSecondaryButtonText, { color: theme.text }]}>Alterar Nome</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Sair do Cluster - Disponível para TODOS */}
              <View style={[styles.adminSection, { borderColor: theme.border }]}>
                <View style={styles.adminSectionHeader}>
                  <AlertCircle size={20} color="#f39c12" />
                  <Text style={[styles.adminSectionTitle, { color: theme.text }]}>Sair do Cluster</Text>
                </View>
                <Text style={[styles.adminWarning, { color: theme.text }]}>
                  Ao sair do cluster, você será removido da lista de membros. Os dados do cluster serão mantidos.
                </Text>
                <TouchableOpacity
                  style={[styles.adminWarningButton, { backgroundColor: '#f39c12' }]}
                  onPress={handleLeaveCluster}
                >
                  <AlertCircle size={18} color="#fff" />
                  <Text style={styles.adminDangerButtonText}>Sair do Cluster</Text>
                </TouchableOpacity>
              </View>

              {/* Eliminar Cluster - APENAS ADMIN */}
              {isAdmin && (
                <View style={[styles.adminSection, { borderColor: theme.border }]}>
                  <View style={styles.adminSectionHeader}>
                    <Trash2 size={20} color="#e74c3c" />
                    <Text style={[styles.adminSectionTitle, { color: theme.text }]}>Eliminar Cluster</Text>
                  </View>
                  <Text style={[styles.adminWarning, { color: '#e74c3c' }]}>
                    ⚠️ ATENÇÃO: Esta ação é PERMANENTE e irá eliminar TODOS os dados do cluster (jogadores, jogos, finanças, etc.) e TODOS os membros serão removidos.
                  </Text>
                  <TouchableOpacity
                    style={[styles.adminDangerButton, { backgroundColor: '#e74c3c' }]}
                    onPress={handleDeleteCluster}
                  >
                    <Trash2 size={18} color="#fff" />
                    <Text style={styles.adminDangerButtonText}>Eliminar Cluster Permanentemente</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de SAIR do Cluster */}
      <Modal
        visible={showLeaveConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirmation(false)}
      >
        <View style={styles.confirmationOverlay}>
          <View style={[styles.confirmationModal, { backgroundColor: theme.background }]}>
            <View style={styles.confirmationHeader}>
              <AlertCircle size={48} color="#f39c12" />
              <Text style={[styles.confirmationTitle, { color: theme.text }]}>
                Sair do Cluster
              </Text>
            </View>
            
            <ScrollView style={styles.confirmationBody}>
              <Text style={[styles.confirmationText, { color: theme.text }]}>
                Tem a certeza que deseja sair do cluster "{clusterDisplayName || clusterName}"?
              </Text>
              
              <Text style={[styles.confirmationWarning, { color: theme.text }]}>
                Esta ação irá:
              </Text>
              
              <View style={styles.confirmationList}>
                <Text style={[styles.confirmationListItem, { color: theme.text }]}>• Remover você da lista de membros</Text>
                <Text style={[styles.confirmationListItem, { color: theme.text }]}>• Fazer logout automaticamente</Text>
              </View>
              
              <Text style={[styles.confirmationFinalWarning, { color: '#2ecc71' }]}>
                ℹ️ Os dados do cluster (jogadores, jogos, etc.) serão mantidos
              </Text>
            </ScrollView>
            
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={[styles.confirmationCancelButton, { borderColor: theme.border }]}
                onPress={() => setShowLeaveConfirmation(false)}
              >
                <Text style={[styles.confirmationCancelText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmationDeleteButton, { backgroundColor: '#f39c12' }]}
                onPress={confirmLeaveCluster}
              >
                <Text style={styles.confirmationDeleteText}>Confirmar Saída</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de ELIMINAR Cluster */}
      <Modal
        visible={showDeleteConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.confirmationOverlay}>
          <View style={[styles.confirmationModal, { backgroundColor: theme.background }]}>
            <View style={styles.confirmationHeader}>
              <AlertCircle size={48} color="#e74c3c" />
              <Text style={[styles.confirmationTitle, { color: theme.text }]}>
                Eliminar Cluster Permanentemente
              </Text>
            </View>
            
            <ScrollView style={styles.confirmationBody}>
              <Text style={[styles.confirmationText, { color: theme.text }]}>
                Tem a certeza que deseja ELIMINAR PERMANENTEMENTE o cluster "{clusterDisplayName || clusterName}"?
              </Text>
              
              <Text style={[styles.confirmationWarning, { color: '#e74c3c' }]}>
                ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL e irá:
              </Text>
              
              <View style={styles.confirmationList}>
                <Text style={[styles.confirmationListItem, { color: '#e74c3c' }]}>• Eliminar TODOS os jogadores</Text>
                <Text style={[styles.confirmationListItem, { color: '#e74c3c' }]}>• Eliminar TODOS os jogos</Text>
                <Text style={[styles.confirmationListItem, { color: '#e74c3c' }]}>• Eliminar TODAS as finanças</Text>
                <Text style={[styles.confirmationListItem, { color: '#e74c3c' }]}>• Remover TODOS os membros</Text>
                <Text style={[styles.confirmationListItem, { color: '#e74c3c' }]}>• Eliminar o cluster completamente</Text>
              </View>
              
              <Text style={[styles.confirmationFinalWarning, { color: '#e74c3c' }]}>
                🚨 ESTA AÇÃO NÃO PODE SER DESFEITA!
              </Text>
            </ScrollView>
            
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={[styles.confirmationCancelButton, { borderColor: theme.border }]}
                onPress={() => setShowDeleteConfirmation(false)}
              >
                <Text style={[styles.confirmationCancelText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmationDeleteButton}
                onPress={confirmDeleteCluster}
              >
                <Text style={styles.confirmationDeleteText}>Eliminar Permanentemente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {clusterName && (
        <AdminModal
          visible={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          currentClusterId={clusterName}
          onAdminChanged={() => {
            showToast('Novo admin definido com sucesso!', 'success');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  menuButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  modalBody: {
    padding: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  ratingInput: {
    width: 60,
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    textAlign: 'center',
  },
  teamSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  teamTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    width: 50,
  },
  teamInput: {
    flex: 1,
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
  },
  colorButtonsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorButton: {
    borderColor: '#ffffff',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  languageButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  adminSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  adminSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  adminSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  adminLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  clusterInput: {
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    marginBottom: 12,
  },
  adminButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adminSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  adminSecondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  adminPrimaryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  adminWarning: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    lineHeight: 18,
  },
  adminWarningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    minHeight: 50,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  adminDangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
    minHeight: 50,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  adminDangerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  // Confirmation Modal Styles
  confirmationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  confirmationTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  confirmationBody: {
    maxHeight: 300,
  },
  confirmationText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationWarning: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    marginTop: 8,
  },
  confirmationList: {
    marginLeft: 8,
    marginBottom: 16,
  },
  confirmationListItem: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
    lineHeight: 20,
  },
  confirmationFinalWarning: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  confirmationCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationCancelText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmationDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmationDeleteText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  // Profile Section Styles
  profileSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  profileLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    opacity: 0.7,
  },
  profileValue: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileInput: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSaveButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCancelButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});