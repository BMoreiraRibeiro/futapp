-- ============================================
-- POPULAÇÃO COMPLETA DE JOGOS PARA CLUSTER "FUT"
-- ============================================
-- Popula TODAS as tabelas relacionadas corretamente:
-- 1. jogadores (nome, cluster_uuid, rating, visivel)
-- 2. resultados_jogos (id_jogo, cluster_uuid, data, jogadores_equipa_a, jogadores_equipa_b, vencedor)
-- 3. golos_por_jogador (TODOS os 14 jogadores do jogo, com numero_golos incluindo 0)
-- 4. calotes_jogo (TODOS os 14 jogadores do jogo, com pago true/false)
-- ============================================

DO $$
DECLARE
    v_cluster_uuid UUID;
    v_jogo_uuid UUID;
    v_player_names TEXT[] := ARRAY[
        'Bruno Rib', 'João Silva', 'Pedro Costa', 'Miguel Santos', 
        'André Oliveira', 'Rui Ferreira', 'Carlos Pereira', 'Tiago Rodrigues',
        'Paulo Martins', 'Nuno Alves', 'Ricardo Sousa', 'Fernando Lopes',
        'Manuel Ribeiro', 'António Carvalho', 'José Fernandes', 'Marco Gomes'
    ];
    v_player_name TEXT;
    v_random_rating INTEGER;
    v_equipa_a TEXT[];
    v_equipa_b TEXT[];
    v_jogadores_a TEXT;
    v_jogadores_b TEXT;
    v_vencedor CHAR(1);
    v_all_players TEXT[];
    i INTEGER;
BEGIN
    -- 1. Buscar cluster FUT
    SELECT cluster_uuid INTO v_cluster_uuid
    FROM clusters
    WHERE nome_cluster IN ('FUT', 'Fff')
    LIMIT 1;

    IF v_cluster_uuid IS NULL THEN
        RAISE NOTICE 'Cluster FUT não encontrado. Use o nome correto.';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Cluster encontrado: %', v_cluster_uuid;

    -- 2. Criar jogadores (apenas campos que existem: nome, cluster_uuid, rating, visivel)
    FOREACH v_player_name IN ARRAY v_player_names
    LOOP
        v_random_rating := 800 + floor(random() * 400)::INTEGER;
        
        IF NOT EXISTS (
            SELECT 1 FROM jogadores 
            WHERE nome = v_player_name 
            AND cluster_uuid = v_cluster_uuid
        ) THEN
            INSERT INTO jogadores (nome, cluster_uuid, rating, visivel)
            VALUES (v_player_name, v_cluster_uuid, v_random_rating, true);
            
            RAISE NOTICE '✅ Jogador: % (Rating: %)', v_player_name, v_random_rating;
        END IF;
    END LOOP;

    -- 3. Criar jogos com TODAS as tabelas relacionadas populadas
    FOR i IN 1..5 LOOP
        -- Selecionar 7 jogadores aleatórios para equipa A
        SELECT ARRAY_AGG(nome ORDER BY random()) INTO v_equipa_a
        FROM (
            SELECT nome FROM jogadores 
            WHERE cluster_uuid = v_cluster_uuid 
            ORDER BY random() 
            LIMIT 7
        ) sub;
        
        -- Selecionar 7 jogadores DIFERENTES para equipa B
        SELECT ARRAY_AGG(nome ORDER BY random()) INTO v_equipa_b
        FROM (
            SELECT nome FROM jogadores 
            WHERE cluster_uuid = v_cluster_uuid 
            AND nome != ALL(v_equipa_a)
            ORDER BY random() 
            LIMIT 7
        ) sub;
        
        -- Converter arrays para string no formato: "nome1, nome2, nome3" (com espaço após vírgula)
        v_jogadores_a := array_to_string(v_equipa_a, ', ');
        v_jogadores_b := array_to_string(v_equipa_b, ', ');
        
        -- Determinar vencedor aleatoriamente
        v_vencedor := CASE 
            WHEN random() > 0.6 THEN 'A'
            WHEN random() > 0.3 THEN 'B'
            ELSE 'E'  -- Empate
        END;
        
        -- Inserir jogo em resultados_jogos
        INSERT INTO resultados_jogos (id_jogo, cluster_uuid, data, jogadores_equipa_a, jogadores_equipa_b, vencedor)
        VALUES (
            gen_random_uuid(), 
            v_cluster_uuid, 
            CURRENT_DATE - (i || ' days')::INTERVAL, 
            v_jogadores_a, 
            v_jogadores_b, 
            v_vencedor
        )
        RETURNING id_jogo INTO v_jogo_uuid;
        
        RAISE NOTICE '✅ Jogo %/5: UUID=% | Vencedor=%', i, v_jogo_uuid, v_vencedor;
        
        -- Combinar TODOS os jogadores (14 jogadores = 7 de A + 7 de B)
        v_all_players := v_equipa_a || v_equipa_b;
        
        -- 4. CRIAR GOLOS_POR_JOGADOR para TODOS os 14 jogadores (OBRIGATÓRIO!)
        FOREACH v_player_name IN ARRAY v_all_players
        LOOP
            INSERT INTO golos_por_jogador (id_jogo, cluster_uuid, nome_jogador, numero_golos)
            VALUES (
                v_jogo_uuid, 
                v_cluster_uuid, 
                v_player_name, 
                floor(random() * 4)::INTEGER  -- 0 a 3 golos (incluindo 0!)
            );
        END LOOP;
        
        RAISE NOTICE '   ↳ golos_por_jogador: % registos criados', array_length(v_all_players, 1);
        
        -- 5. CRIAR CALOTES_JOGO para TODOS os 14 jogadores (OBRIGATÓRIO!)
        FOREACH v_player_name IN ARRAY v_all_players
        LOOP
            INSERT INTO calotes_jogo (id_jogo, cluster_uuid, nome_jogador, pago)
            VALUES (
                v_jogo_uuid, 
                v_cluster_uuid, 
                v_player_name, 
                random() > 0.3  -- 70% pagam, 30% não pagam
            );
        END LOOP;
        
        RAISE NOTICE '   ↳ calotes_jogo: % registos criados', array_length(v_all_players, 1);
    END LOOP;

    RAISE NOTICE '================================';
    RAISE NOTICE '✅ POPULAÇÃO COMPLETA!';
    RAISE NOTICE 'Jogadores: %', (SELECT COUNT(*) FROM jogadores WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Jogos: %', (SELECT COUNT(*) FROM resultados_jogos WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Registos golos_por_jogador: %', (SELECT COUNT(*) FROM golos_por_jogador WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Registos calotes_jogo: %', (SELECT COUNT(*) FROM calotes_jogo WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE '================================';
    RAISE NOTICE 'ESPERADO: 70 registos em golos_por_jogador (5 jogos x 14 jogadores)';
    RAISE NOTICE 'ESPERADO: 70 registos em calotes_jogo (5 jogos x 14 jogadores)';
    RAISE NOTICE '================================';
END $$;

-- ============================================
-- QUERIES DE VERIFICAÇÃO
-- ============================================

-- 1. Ver jogadores criados
SELECT nome, rating, visivel 
FROM jogadores 
WHERE cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
ORDER BY rating DESC;

-- 2. Ver jogos criados
SELECT 
    id_jogo, 
    data, 
    vencedor,
    array_length(string_to_array(jogadores_equipa_a, ', '), 1) as qtd_equipa_a,
    array_length(string_to_array(jogadores_equipa_b, ', '), 1) as qtd_equipa_b
FROM resultados_jogos 
WHERE cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
ORDER BY data DESC;

-- 3. VERIFICAÇÃO CRÍTICA: Todos os jogadores têm golos registados?
SELECT 
    rj.id_jogo,
    DATE(rj.data) as data,
    COUNT(gpj.nome_jogador) as jogadores_com_golos,
    (array_length(string_to_array(rj.jogadores_equipa_a, ', '), 1) + 
     array_length(string_to_array(rj.jogadores_equipa_b, ', '), 1)) as total_jogadores_esperado,
    CASE 
        WHEN COUNT(gpj.nome_jogador) = (array_length(string_to_array(rj.jogadores_equipa_a, ', '), 1) + 
                                         array_length(string_to_array(rj.jogadores_equipa_b, ', '), 1))
        THEN '✅ OK'
        ELSE '❌ ERRO - Faltam registos!'
    END as status
FROM resultados_jogos rj
LEFT JOIN golos_por_jogador gpj ON rj.id_jogo = gpj.id_jogo AND rj.cluster_uuid = gpj.cluster_uuid
WHERE rj.cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
GROUP BY rj.id_jogo, rj.data, rj.jogadores_equipa_a, rj.jogadores_equipa_b
ORDER BY rj.data DESC;

-- 4. VERIFICAÇÃO CRÍTICA: Todos os jogadores têm calotes registados?
SELECT 
    rj.id_jogo,
    DATE(rj.data) as data,
    COUNT(cj.nome_jogador) as jogadores_com_calotes,
    (array_length(string_to_array(rj.jogadores_equipa_a, ', '), 1) + 
     array_length(string_to_array(rj.jogadores_equipa_b, ', '), 1)) as total_jogadores_esperado,
    CASE 
        WHEN COUNT(cj.nome_jogador) = (array_length(string_to_array(rj.jogadores_equipa_a, ', '), 1) + 
                                        array_length(string_to_array(rj.jogadores_equipa_b, ', '), 1))
        THEN '✅ OK'
        ELSE '❌ ERRO - Faltam registos!'
    END as status
FROM resultados_jogos rj
LEFT JOIN calotes_jogo cj ON rj.id_jogo = cj.id_jogo AND rj.cluster_uuid = cj.cluster_uuid
WHERE rj.cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
GROUP BY rj.id_jogo, rj.data, rj.jogadores_equipa_a, rj.jogadores_equipa_b
ORDER BY rj.data DESC;

-- 5. Ver exemplo de um jogo com todos os detalhes
SELECT 
    'Jogo' as tipo,
    rj.id_jogo,
    DATE(rj.data) as data,
    rj.vencedor,
    rj.jogadores_equipa_a,
    rj.jogadores_equipa_b
FROM resultados_jogos rj
WHERE rj.cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
LIMIT 1;

SELECT 
    'Golos' as tipo,
    gpj.nome_jogador,
    gpj.numero_golos
FROM golos_por_jogador gpj
WHERE gpj.id_jogo = (
    SELECT id_jogo FROM resultados_jogos 
    WHERE cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
    LIMIT 1
)
ORDER BY gpj.numero_golos DESC;

SELECT 
    'Calotes' as tipo,
    cj.nome_jogador,
    cj.pago
FROM calotes_jogo cj
WHERE cj.id_jogo = (
    SELECT id_jogo FROM resultados_jogos 
    WHERE cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
    LIMIT 1
)
ORDER BY cj.pago DESC;
