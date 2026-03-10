# 🛡️ Política de Segurança (Security Policy) - Nexus

O **Nexus** é um hub central de inteligência hospitalar desenvolvido para otimizar os processos assistenciais do Hospital Municipal São José (HMSJ). Devido à natureza crítica do ambiente de saúde e ao manuseio de dados sensíveis de pacientes (Censo, AIHs, Regulação), a segurança da informação é a nossa prioridade absoluta.

---

## 📌 Versões Suportadas

Abaixo estão as versões do ecossistema Nexus que atualmente recebem atualizações e patches de segurança. Recomendamos que a instituição opere sempre na versão mais recente.

| Versão | Status | Descrição da Arquitetura |
| :--- | :---: | :--- |
| **2.x.x** (Atual) | ✅ Suportado | Nova infraestrutura em React (Vite) + Firebase Firestore. Recebe correções de segurança e monitoramento contínuo. |
| **1.x.x** (Legado)| ❌ Não Suportado | Versão antiga baseada em Google Apps Script (Planilhas). Descontinuada e sem suporte a novos patches. |
| **< 1.0** | ❌ Não Suportado | Protótipos e provas de conceito iniciais. |

---

## 🚨 Relatando uma Vulnerabilidade

> **⚠️ IMPORTANTE:** Por favor, **NÃO** crie uma *Issue* pública no GitHub para relatar vulnerabilidades de segurança ou vazamento de dados. A exposição pública pode comprometer a integridade do sistema do hospital antes que possamos aplicar uma correção.

Valorizamos muito a comunidade de desenvolvedores e auditores de segurança que nos ajudam a manter o Nexus seguro. Se você descobrir uma vulnerabilidade de segurança, siga as instruções abaixo:

### Como relatar:
1. Envie um e-mail diretamente para o desenvolvedor responsável e arquiteto do sistema (Enf. Bruno Vinícius) detalhando o problema.
2. Utilize um assunto claro, como: `[ALERTA DE SEGURANÇA] - Nexus HMSJ`.
3. No corpo do e-mail, inclua:
   - Uma descrição detalhada da vulnerabilidade.
   - Os passos exatos para reproduzir o problema (Provas de Conceito, prints ou vídeos curtos são muito bem-vindos).
   - O impacto potencial caso a vulnerabilidade seja explorada.
   - Possíveis sugestões de mitigação (se souber).

### Nosso compromisso (SLA de Resposta):
- **Reconhecimento:** Você receberá uma confirmação de recebimento do seu relato em até **48 horas**.
- **Avaliação:** Nossa equipe fará a triagem do problema para confirmar a vulnerabilidade e classificar sua gravidade.
- **Correção:** Trabalharemos com prioridade máxima para desenvolver um *patch* de correção, aplicá-lo ao ambiente de produção e notificar as partes interessadas de forma segura.
- **Transparência:** Manteremos você informado sobre o andamento da correção.

---

## 👁️ Auditoria e Rastreabilidade Baseada em Eventos

Visando total transparência sobre a evolução do Censo Hospitalar, o módulo **Kanban de Altas** introduz o ecossistema de Logs Semânticos:
- **Coleção `nexus_kanban_logs`**: Cada interação técnica e/ou clínica (marcação de tags diretivas como EMAD/Trauma, prescrição/remoção de medicamentos temporizados, exclusão de SISREGs ou alteração ativa de Especialidades) dispara um evento autônomo na nuvem, portando o perfil logado no App.
- Isso constitui uma trilha de auditoria cirúrgica e irrefutável, permitindo que as Coordenações saibam exatamente *quem*, *quando* e *o quê* foi alterado no prontuário de rastreio, visível de forma orgânica por meio da **Central de Atividades (Sino de Notificações)**.

## 🛡️ Proteção da Soberania de Dados (Censo Autônomo MV)

A automação RPA não deve apagar o raciocínio e a apuração humana do NIR. O Nexus adota o princípio da **Soberania Interativa**:
- O sincronizador mecânico do Censo MV é capaz de incluir pacientes, atualizar leitos ou dar teto/desfecho de alta ao mapear as evasões. No entanto, sempre que uma decisão interativa é firmada por um usuário nas bases do Nexus (exemplo: transferir o caso para outra Especialidade Principal), a arquitetura injeta a trava de blindagem `is_manual: true`.
- Consequentemente, novos relatórios XLSX brutos importados não causarão **sobrescrita cega** nos dados já lapidados pelos assistentes operacionais em suas rondas.

---

## 🔒 Boas Práticas de Arquitetura e Privacidade Hospitalar

O Nexus foi construído seguindo os princípios intrínsecos de *Security by Design* e atende às premissas da **LGPD (Lei Geral de Proteção de Dados)** aplicadas à saúde (Art. 11: Dados Pessoais Sensíveis):

- **Privacidade e Governança:** É terminantemente proibido o versionamento no GitHub ou tráfego local de exames reais, números de prontuários autênticos ou nomes de pacientes fidedignos sob ambiente de **desenvolvimento/teste**. Mocks e dados mascarados são mandatórios e auditáveis.
- **Padrões Abertos em Saúde (Interoperabilidade):** O sistema mapeia os dados, primariamente no Firestore, para caminhar progressivamente rumo aos modelos canônicos do formato **FHIR / HL7** (tratando eventos como recursos 'ServiceRequest', 'Task', 'Patient'), e se apoia no embasamento referencial a termos de tabelas consagradas de codificação referencial, como **SNOMED CT**, **CID 10/11** e **SIGTAP**.
- **Autenticação (Google + Escopos de Uso Especial):** O sistema utiliza Firebase Auth interligado à Google Cloud. Devido ao envio interno e automatizado do **Módulo AVC (Lista Ambulatorial)**, o sistema requer o escopo sensível estrito de `https://www.googleapis.com/auth/gmail.send`. Este Token é usado momentaneamente apenas em memória virtual (Client-Side) para orquestrar as APIs REST.
- **Autorização (Regras do Firebase Firestore):** O acesso total às instâncias de banco (Collections baseadas na nomenclatura `nexus_*`) é explicitamente bloqueado e dependente da submissão das Regras de Segurança (Security Rules). Não exsite permissão de `read`/`write` universal indiscriminada.
- **Consultas de Agregação e KPIs (`getCountFromServer`):** Painéis e medidores que exigem totais matemáticos globais (KPIs e Dashboards) **devem** utilizar as funções nativas de agregação da SDK do Firebase (`getCountFromServer`). Essa blindagem arquitetural impede que dados sensíveis/payloads robustos do Censo sejam desnecessariamente baixados para o Front-End Client, consumindo rede, banda ou expondo lista massiva de nomes sigilosos.
- **Validação de Integridade Relacional (Foreign Keys Strict Check):** Rotinas de importação de banco de dados e sincronizações em lotes (CSV Batch Import) legadas possuem validação rígida de consistência de chaves estrangeiras (`pacienteId`). É severamente vedada a injeção ou persistência de dados "órfãos" (exames, contatos ou consultas sem amarração estrutural confirmada na Collection Principal de um paciente válido) para garantir precisão do prontuário digital e prevenir vazamento cruzado.
- **Tratamento de Dados:** Dados importados de sistemas de terceiros via planilhas (como o Soul MV e Tasy) são tratados no *front-end* e sanitizados antes da serialização final ou persistência via Firestore.

Agradecemos por nos ajudar a manter os dados do hospital e dos pacientes seguros! 💙
