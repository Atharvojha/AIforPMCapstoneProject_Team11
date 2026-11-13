import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme.css';
import './motion.css';
import './layout.css';
import './sheet.css';
import './shell.css';
import './board.css';
import './detail.css';
import './screens.css';
import './looks.css';
import './followups.css';

async function start() {
  if (import.meta.env.DEV && location.search.includes('mock')) await (await import('./dev/seed')).seed();   // development review without the live backend
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
}
void start();
