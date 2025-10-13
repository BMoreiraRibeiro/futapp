-- ============================================
-- DADOS DE TESTE PARA CLUSTER "FUT"  
-- ============================================
-- Schema correto: resultados_jogos, golos_por_jogador, calotes_jogo
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
    i INTEGER;
    j INTEGER;
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

    -- 2. Criar jogadores (com estatísticas base)
    FOREACH v_player_name IN ARRAY v_player_names
    LOOP
        v_random_rating := 800 + floor(random() * 400)::INTEGER;
        
        IF NOT EXISTS (
            SELECT 1 FROM jogadores 
            WHERE nome = v_player_name 
            AND cluster_uuid = v_cluster_uuid
        ) THEN
            INSERT INTO jogadores (
                nome, cluster_uuid, rating, visivel,
                numero_jogos, numero_vitorias, empates, derrotas, golos_marcados
            )
            VALUES (
                v_player_name, v_cluster_uuid, v_random_rating, true,
                0, 0, 0, 0, 0
            );
            
            RAISE NOTICE '✅ Jogador: % (Rating: %)', v_player_name, v_random_rating;
        END IF;
    END LOOP;

    -- 3. Criar jogos
    FOR i IN 1..5 LOOP
        SELECT ARRAY_AGG(nome ORDER BY random()) INTO v_equipa_a
        FROM (SELECT nome FROM jogadores WHERE cluster_uuid = v_cluster_uuid ORDER BY random() LIMIT 7) sub;
        
        SELECT ARRAY_AGG(nome ORDER BY random()) INTO v_equipa_b
        FROM (SELECT nome FROM jogadores WHERE cluster_uuid = v_cluster_uuid AND nome != ALL(v_equipa_a) ORDER BY random() LIMIT 7) sub;
        
        v_jogadores_a := array_to_string(v_equipa_a, ',');
        v_jogadores_b := array_to_string(v_equipa_b, ',');
        
        v_vencedor := CASE 
            WHEN random() > 0.6 THEN 'A'
            WHEN random() > 0.3 THEN 'B'
            ELSE 'E'
        END;
        
        INSERT INTO resultados_jogos (id_jogo, cluster_uuid, data, jogadores_equipa_a, jogadores_equipa_b, vencedor)
        VALUES (gen_random_uuid(), v_cluster_uuid, CURRENT_DATE - (i || ' days')::INTERVAL, v_jogadores_a, v_jogadores_b, v_vencedor)
        RETURNING id_jogo INTO v_jogo_uuid;
        
        RAISE NOTICE '✅ Jogo: % (Vencedor: %)', v_jogo_uuid, v_vencedor;
        
        -- 4. Criar golos
        FOR j IN 1..floor(random() * 4 + 1)::INTEGER LOOP
            IF random() > 0.5 AND array_length(v_equipa_a, 1) > 0 THEN
                INSERT INTO golos_por_jogador (id_jogo, cluster_uuid, nome_jogador, numero_golos)
                VALUES (v_jogo_uuid, v_cluster_uuid, v_equipa_a[1 + floor(random() * array_length(v_equipa_a, 1))::INTEGER], floor(random() * 3 + 1)::INTEGER)
                ON CONFLICT (id_jogo, cluster_uuid, nome_jogador) DO UPDATE SET numero_golos = golos_por_jogador.numero_golos + 1;
            END IF;
            
            IF random() > 0.5 AND array_length(v_equipa_b, 1) > 0 THEN
                INSERT INTO golos_por_jogador (id_jogo, cluster_uuid, nome_jogador, numero_golos)
                VALUES (v_jogo_uuid, v_cluster_uuid, v_equipa_b[1 + floor(random() * array_length(v_equipa_b, 1))::INTEGER], floor(random() * 3 + 1)::INTEGER)
                ON CONFLICT (id_jogo, cluster_uuid, nome_jogador) DO UPDATE SET numero_golos = golos_por_jogador.numero_golos + 1;
            END IF;
        END LOOP;
        
        -- 5. Criar calotes
        FOR j IN 1..floor(random() * 3)::INTEGER LOOP
            IF random() > 0.5 AND array_length(v_equipa_a, 1) > 0 THEN
                INSERT INTO calotes_jogo (id_jogo, cluster_uuid, nome_jogador, pago)
                VALUES (v_jogo_uuid, v_cluster_uuid, v_equipa_a[1 + floor(random() * array_length(v_equipa_a, 1))::INTEGER], random() > 0.5)
                ON CONFLICT DO NOTHING;
            ELSIF array_length(v_equipa_b, 1) > 0 THEN
                INSERT INTO calotes_jogo (id_jogo, cluster_uuid, nome_jogador, pago)
                VALUES (v_jogo_uuid, v_cluster_uuid, v_equipa_b[1 + floor(random() * array_length(v_equipa_b, 1))::INTEGER], random() > 0.5)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '================================';
    RAISE NOTICE '✅ DADOS CRIADOS!';
    RAISE NOTICE 'Jogadores: %', (SELECT COUNT(*) FROM jogadores WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Jogos: %', (SELECT COUNT(*) FROM resultados_jogos WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Golos: %', (SELECT COUNT(*) FROM golos_por_jogador WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE 'Calotes: %', (SELECT COUNT(*) FROM calotes_jogo WHERE cluster_uuid = v_cluster_uuid);
    RAISE NOTICE '================================';
END $$;

-- Verificação (apenas campos reais da tabela jogadores)
SELECT nome, rating, visivel FROM jogadores 
WHERE cluster_uuid = (SELECT cluster_uuid FROM clusters WHERE nome_cluster IN ('FUT', 'Fff') LIMIT 1)
ORDER BY rating DESC;
