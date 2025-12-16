import { createContext, useContext, createSignal } from 'solid-js';

const SkillsContext = createContext();

export function SkillsProvider(props) {
  const [skills, setSkills] = createSignal([]);

  const addSkill = (skill) => {
    console.log('addSkill called with skill:', skill);
    // 배열의 불변성을 지키지 않아도 되지만, Solid에서는 setter에 함수형 업데이트를 사용할 수 있습니다.
    setSkills((prev) => [...prev, skill]);
  };

  const clearSkills = () => setSkills([]);

  // value 객체 자체는 반응형이 아니어도 되지만, 내부의 skills는 getter 함수입니다.
  const value = {
    skills, // getter 함수: skills() 로 접근
    addSkill,
    clearSkills
  };

  return (
    <SkillsContext.Provider value={value}>
      {props.children}
    </SkillsContext.Provider>
  );
}

export function useSkills() {
  const context = useContext(SkillsContext);
  if (!context) {
    throw new Error('useSkills must be used within a SkillsProvider');
  }
  return context;
}