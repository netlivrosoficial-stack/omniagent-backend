import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Erro não capturado no componente:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-900/30 text-red-400 rounded-xl border border-red-700">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-6 h-6 mr-3" />
            <h2 className="text-lg font-semibold">Erro de Renderização</h2>
          </div>
          <p className="text-sm mb-2">Ocorreu um erro ao carregar o componente de conexão. Isso pode ser um problema de importação de biblioteca.</p>
          <pre className="text-xs bg-red-900 p-2 rounded mt-2 overflow-x-auto">
            {this.state.error?.message || "Erro desconhecido."}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;