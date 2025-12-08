import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SessionContextProvider, useAuth } from './src/SessionContextProvider';
import Login from './src/pages/Login';

const Root = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // O SessionContextProvider já lida com o estado de carregamento, mas podemos adicionar um fallback aqui se necessário.
    return null; 
  }

  if (!user) {
    return <Login />;
  }

  return <App />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SessionContextProvider>
      <Root />
    </SessionContextProvider>
  </React.StrictMode>
);