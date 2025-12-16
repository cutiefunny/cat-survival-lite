import { SkillsProvider } from './components/SkillsContext';
import GameCanvas from './components/GameCanvas';

function App() {
  return (
    /* Provider로 감싸서 하위 모든 컴포넌트가 Context에 접근할 수 있게 함 */
    <SkillsProvider>
      <GameCanvas />
    </SkillsProvider>
  );
}

export default App;