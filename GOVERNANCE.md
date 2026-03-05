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

- **Arquitetura de Componentes:**  
  Uso estrito e obrigatório de **Componentes Funcionais** (React 19) aliados a *Hooks*. Classes (React Class Components) estão depreciados e não devem ser inseridos na base de código.
- **Estilização de UI:**  
  O desenvolvimento das interfaces visuais será feito **exclusivamente** com **Tailwind CSS**. A criação de arquivos `.css` isolados deve ser evitada, priorizando a abordagem *utility-first* fornecida pelo framework para maximizar o desempenho e a adaptabilidade em plataformas mobile/desktop.
- **Persistência de Dados e Backend:**  
  As operações transacionais, autenticação, armazenamento e inteligência analítica de banco de dados devem, por padrão, direcionar o consumo ao ecossistema de bibliotecas do **Firebase** (e respectiva integração de banco em infraestrutura GCP).

---

## 🔒 Segurança de Dados Hospitalares (HMSJ)

O Nexus manipula informações de alto sigilo envolvendo painéis do censo clínico-hospitalar e listas de espera ou acompanhamento clínico (*Kanban e Eletivas*).

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
