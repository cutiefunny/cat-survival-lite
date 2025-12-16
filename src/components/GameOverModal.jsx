import { createSignal, createEffect, onMount, Show, For } from 'solid-js';
import { db } from '../firebase'; // firebase 설정 파일 import
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import styles from './GameOverModal.module.css'; // CSS Module

const GameOverModal = (props) => {
    const [playerName, setPlayerName] = createSignal('');
    const [ranks, setRanks] = createSignal([]);
    const [showRanks, setShowRanks] = createSignal(false);
    const [isLoadingRanks, setIsLoadingRanks] = createSignal(false);
    
    // Props가 변경될 때 초기화 (isVisible이 true가 될 때)
    createEffect(() => {
        if (props.isVisible) {
            setPlayerName('');
            setShowRanks(false);
            setRanks([]);
            setIsLoadingRanks(false);
        }
    });

    // 랭킹 저장 및 불러오기 (Firebase)
    const handleSaveAndShowRanks = async () => {
        const name = playerName().trim();
        if (!name) {
            alert("이름을 입력해주세요!");
            return;
        }

        // 1. 부모 컴포넌트에 알림 (선택사항)
        if (props.onSave) props.onSave(name);

        setIsLoadingRanks(true);
        setShowRanks(true);

        try {
            // 2. 점수 저장 (Firestore 'ranks' 컬렉션)
            await addDoc(collection(db, "ranks"), {
                name: name,
                score: props.score,
                createdAt: serverTimestamp()
            });

            // 3. 랭킹 불러오기 (Top 10)
            const q = query(collection(db, "ranks"), orderBy("score", "desc"), limit(10));
            const querySnapshot = await getDocs(q);
            
            const fetchedRanks = [];
            querySnapshot.forEach((doc) => {
                fetchedRanks.push(doc.data());
            });
            
            setRanks(fetchedRanks);

        } catch (error) {
            console.error("Error saving/loading ranks:", error);
            alert("랭킹 처리 중 오류가 발생했습니다.");
        } finally {
            setIsLoadingRanks(false);
        }
    };

    const getRankItemClassName = (index) => {
        let classes = styles.rankItem;
        if (index === 0) classes += ` ${styles.rankItemGold}`;
        else if (index === 1) classes += ` ${styles.rankItemSilver}`;
        else if (index === 2) classes += ` ${styles.rankItemBronze}`;
        return classes;
    };

    return (
        <Show when={props.isVisible}>
            <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                    <Show when={!showRanks()} fallback={
                        // 랭킹 보여주기 모드
                        <>
                            <h2 className={styles.rankingTitle}>🏆 게임 랭킹 🏆</h2>
                            <Show when={isLoadingRanks()}>
                                <p className={styles.loadingText}>랭킹을 불러오는 중...</p>
                            </Show>
                            
                            <Show when={!isLoadingRanks()}>
                                <Show when={ranks().length > 0} fallback={<p className={styles.noRanksText}>아직 랭킹이 없습니다.</p>}>
                                    <div className={styles.rankList}>
                                        <For each={ranks()}>
                                            {(rank, index) => (
                                                <div className={getRankItemClassName(index())}>
                                                    {index() + 1}위. {rank.name} - {rank.score}점
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </Show>

                            <button 
                                onClick={props.onClose} 
                                className={`${styles.button} ${styles.restartButtonRankView}`}
                            >
                                재시작 / 닫기
                            </button>
                        </>
                    }>
                        {/* 게임 오버 입력 모드 */}
                        <img src="/images/cat_cry.png" alt="Game Over" className={styles.gameOverImage} />
                        <h2 className={styles.title}>Game Over!</h2>
                        <p className={styles.scoreText}>너의 점수는 <strong>{props.score}</strong>점</p>
                        
                        <div className={styles.inputGroup}>
                            <input
                                type="text"
                                placeholder='이름을 남겨라!'
                                value={playerName()}
                                onInput={(e) => setPlayerName(e.target.value)}
                                className={styles.playerNameInput}
                            />
                            <button 
                                onClick={handleSaveAndShowRanks} 
                                className={`${styles.button} ${styles.saveButton}`}
                            >
                                저장
                            </button>
                        </div>
                        <button 
                            onClick={props.onClose} 
                            className={`${styles.button} ${styles.restartButtonInitial}`}
                        >
                            재시작
                        </button>
                    </Show>
                </div>
            </div>
        </Show>
    );
};

export default GameOverModal;