import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as DefaultConfig from "../constants/GameConfig";

// 기본 설정값을 객체로 변환
const getDefaultConfig = () => {
    return { ...DefaultConfig };
};

// DB에서 설정 불러오기 (없으면 기본값 반환)
export const fetchGameConfig = async () => {
    try {
        const docRef = doc(db, "settings", "gameConfig");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // DB 값과 기본값을 병합 (새로 추가된 상수가 있을 경우를 대비)
            return { ...getDefaultConfig(), ...docSnap.data() };
        } else {
            console.log("No config found in DB, using defaults.");
            return getDefaultConfig();
        }
    } catch (error) {
        console.error("Error fetching config:", error);
        return getDefaultConfig();
    }
};

// DB에 설정 저장하기
export const saveGameConfig = async (newConfig) => {
    try {
        await setDoc(doc(db, "settings", "gameConfig"), newConfig);
        alert("설정이 저장되었습니다! 게임을 새로고침하면 적용됩니다.");
    } catch (error) {
        console.error("Error saving config:", error);
        alert("저장 중 오류가 발생했습니다.");
    }
};