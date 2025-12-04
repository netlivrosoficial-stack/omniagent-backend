# Regras de Arquitetura e Desenvolvimento

Este documento define a pilha de tecnologia (Tech Stack) e as regras de uso de bibliotecas para o projeto OmniAgent Architect. O objetivo é garantir a manutenibilidade, coerência e simplicidade do código.

## 1. Visão Geral da Pilha de Tecnologia

*   **Linguagem:** TypeScript (para tipagem estática e segurança).
*   **Framework Principal:** React (para construção da interface do usuário).
*   **Estilização:** Tailwind CSS (abordagem utility-first para design responsivo).
*   **Componentes UI:** Shadcn/ui (para componentes de interface prontos e acessíveis).
*   **Ícones:** `lucide-react`.
*   **Serviço de IA:** Google Gemini API, utilizando o pacote `@google/genai`.
*   **Build Tool:** Vite.
*   **Navegação:** Gerenciamento de visualizações baseado em estado (utilizando o enum `AppView` em `App.tsx`).
*   **Persistência:** `localStorage` é usado para armazenar a configuração do agente (`AgentConfig`).

## 2. Regras de Uso de Bibliotecas e Estrutura

| Área | Biblioteca/Tecnologia | Regra de Uso |
| :--- | :--- | :--- |
| **Estilização** | Tailwind CSS | **Obrigatório.** Use classes utilitárias do Tailwind para todo o design e layout. O design deve ser sempre responsivo. |
| **Componentes UI** | Shadcn/ui | **Preferencial.** Utilize componentes Shadcn/ui para elementos padrão (Botões, Inputs, Cards, etc.). Crie novos componentes em `src/components/` para lógica específica da aplicação. |
| **Ícones** | `lucide-react` | **Exclusivo.** Use apenas ícones fornecidos pelo pacote `lucide-react`. |
| **Lógica de IA** | `@google/genai` | **Obrigatório.** Todas as interações com a API Gemini devem ser encapsuladas e gerenciadas pela classe `GeminiService` em `src/services/`. |
| **Estrutura de Arquivos** | Padrão | Mantenha a separação: `src/components/` para componentes reutilizáveis, `src/pages/` para visualizações principais e `src/services/` para lógica de API. |
| **Componentes** | React | Cada componente deve residir em seu próprio arquivo. Evite criar múltiplos componentes no mesmo arquivo. |