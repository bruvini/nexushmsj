# 🛡️ Governança e Compliance - Projeto Nexus (HMSJ)

Este documento estabelece as diretrizes irrevogáveis de Governança, Compliance e Arquitetura de Sistemas para o **Hub de Inteligência Hospitalar Nexus** no âmbito do **Hospital Municipal São José (HMSJ)**. O objetivo primordial é garantir a integridade, segurança, manutenibilidade e escalabilidade do sistema, protegendo os dados hospitalares e alinhando o desenvolvimento às melhores práticas globais de engenharia de software.

---

## 👨‍💻 Protocolo de Agentes e Desenvolvedores

Esta seção rege as atuações de qualquer agente autônomo (IAs de desenvolvimento) e membros da equipe técnica sobre a base de código do Nexus.

| Regra | Descrição | Nível de Severidade |
| :--- | :--- | :---: |
| **P-01 (Proibição de Exclusão)** | É terminantemente **proibido** deletar arquivos ou componentes localizados dentro dos diretórios de módulos (`src/modules/*`, ex: *Eletivas* e *KanbanAltas*) sem aprovação e revisão manual prévia do repositório. | 🔴 Crítico |
| **P-02 (Alterações no Core App)** | Nenhuma modificação nos arquivos raiz de inicialização (como `src/App.jsx` ou `src/main.jsx`) pode ser promovida para a branch principal ou para o ambiente simulado sem antes executar, localmente, uma validação de build bem sucedida (`npm run build`). | 🟠 Alto |
| **P-03 (Commits e Revisões)** | Alterações arquiteturais significativas devem ser discutidas e ter seus *Diffs* submetidos a aprovação técnica detalhada; exceções aplicam-se apenas a commits marcados estritamente como `[auto-commit]` em tarefas utilitárias e operacionais mapeadas. | 🟡 Médio |

---

## 🏗️ Padrões de Código e Arquitetura

O ecossistema Nexus deve, sob qualquer hipótese, aderir aos seguintes frameworks e metodologias, conforme definido no stack base `React + Vite`:

- **UI-01 (Zero Window Alerts):**  
  É absolutamente proibido o uso de interrupções de fluxo bloqueantes por meio de `window.alert()` ou `window.confirm()`. As notificações globais devem convergir para o `react-toastify` e modais institucionais dedicados.
- **UI-02 (Mobile Standard):**  
  Layouts devem seguir os preceitos de Mobile-First. Telas gerenciais (como os _Dashboards_) são obrigadas a comportar Grids Reativos (Ex: Kanbans de 1 até 5 colunas baseados na viewport) e encapsulamento em **Drawer** para sidebars.
- **UI-03 (UX & Tema Institucional):**  
  É mandatório o uso de `framer-motion` nas transições entre módulos mestres para fluência visual. Todo design deve seguir inequivocamente o **Tema Light Hospitalar**, abolindo _dark modes_ em fluxos puramente clínicos.
- **UI-04 (Densidade de Informação e Layouts Compactos):**  
  Módulos altamente analíticos, como o Kanban de Altas, devem fundir clusters de dados em linhas unificadas (Ex: *Especialidade* e *Ações Clínicas* encapsuladas no mesmo `flex-container`). A regra de ouro é evitar _scroll_ excessivo em smartphones. O uso de SVGs vetoriais profissionais (ex: Heroicons) substituirá o uso recreativo de Emojis em artefatos maduros (Modais Onboarding).
- **UI-05 (Ocultação Inteligente no Mobile e Idle Clicks):**  
  Visualizações celulares (`< lg`) exigem a supressão pragmática de botões secundários da matriz visível (reservá-los ao Desktop). A interface deve travar ativamente repetições ociosas: menus Dropdowns de log e filtros de zeramento recebem classes restritivas CSS (`opacity-50 grayscale cursor-not-allowed`) e a propriedade `disabled` no DOM, cortando processamentos redundantes na raiz.
- **UI-06 (Integração Obrigatória da *Universidade Nexus*):**  
  Como política fixa de adoção (Onboarding e Acessibilidade do Usuário Profissional), todo novo módulo sistêmico portador de lógicas clínicas ou telas hierárquicas complexas **é obrigado** a possuir seu próprio botão ativador para os artefatos de ajuda "*Universidade Nexus*". Deve ser codificado como um component unificado e contextualizado à página, promovendo a capacitação visual imediata (Modal SPA) sem desviar a rota central de navegação do usuário.
- **DB-01 (Mínimo de Leituras Firestore e Cálculos In-Memory):**  
  Toda busca estrutural reativa deve ser orquestrada com `onSnapshot()` acoplado estritamente à montagem raiz do container pai. Requisições estáticas em loop fechado `.get()` para Dashboards ao vivo são severamente proibidas.  
  Além disso, algoritmos computacionais pesados (como a reatividade diária do Tempo de Internação, Filtros Multidiscplanares ou Flags Cronometradas de Antibióticos) **devem ser delegados unicamente em Client-Side (memória temporal do Browser)** a partir do espelho inicial da Query, isentando os servidores e as chaves de precificação Opex do HMSJ.

---

## 🔒 Segurança de Dados Hospitalares (HMSJ)

O Nexus manipula informações de alto sigilo envolvendo painéis do censo clínico-hospitalar e listas de espera ou acompanhamento clínico (*Kanban e Eletivas*).

> [!NOTE]  
> **Fluxo de Eletivas e Protocolo SISREG.**  
> O registro de pacientes no módulo Eletivas adota o modelo de duas etapas para adequação das filas: pacientes recém-cadastrados sem um Número do SISREG providenciado ficam retidos em status de "Aguarda Número do SISREG", obrigando esta validação prévia à fase cirúrgica.

> [!CAUTION]  
> **Tolerância Zero para Dados Reais em Repositórios.**  
> Fica expressamente **proibido** fixar, versionar ou testar o aplicativo em ambiente de desenvolvimento com prontuários reais, nomes verídicos, CPFs ou quaisquer dados rastreáveis dos pacientes. Toda a base de simulação no GitHub ou localmente ("mocks") deve conter estritamente dados sintéticos mascarados.

---

## 🚀 Fluxo de Deploy Controlado

O ambiente de produção oficial do Nexus (hospedado no Firebase, em `nexushmsj.web.app`) segue pipeline controlada.

- **D-01 (Validação Prévia):** A liberação de novas *releases* nunca ocorrerá no terminal de produção sem que um *build* local íntegro seja finalizado com sucesso.
- **D-02 (Hosting Firebase):** Entregas de homologação ou produção devem ser comitadas de maneira controlada, alvejando o target correto das *Sites/Hosting* do Console Firebase PMJ-HMSJ.

---

## 📦 Gestão de Dependências

O gerenciamento de bibliotecas externas instaladas via `package.json` possui as seguintes premissas:

- **Instalações Restritas:** Não será tolerada a inclusão indiscriminada de pacotes Open-Source de terceiros pelo terminal de desenvolvimento (`npm install <nova_lib>`) sem uma justificativa técnica rastreável sobre o **impacto de performance**, aumento perceptível do peso da aplicação hospitalar (bundle size limits) ou potencial *overhead* das funcionalidades modulares.
- **Risco Zero:** Bibliotecas focadas em animações ultra pesadas ou utilitários inativos na base do Vite devem ser expurgados periodicamente.

---

## 📜 Licenciamento e Conformidade (GPLv3)

Reafirma-se o compromisso com o Software Livre sob as definições legais da **GNU General Public License v3 (GPLv3)**.  
Toda distribuição oriunda de *forks*, uso interinstitucional com centros de tecnologia de outros municípios, ou customização da API do Nexus exige que os projetos derivados continuem publicando seu código livre, fortalecendo a tecnologia pública voltada ao SUS e as administrações municipais.
