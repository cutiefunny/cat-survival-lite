/* src/admin.jsx */
import { render } from 'solid-js/web';
import AdminPage from './pages/AdminPage'; // 이전에 만든 AdminPage 컴포넌트 재사용
import './index.css'; // 스타일 재사용 (선택사항)

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

render(() => <AdminPage />, root);