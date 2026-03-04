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

## 🔒 Boas Práticas de Arquitetura

O Nexus foi construído seguindo os princípios de *Security by Design*:
- **Autenticação:** O sistema utiliza os provedores de autenticação robustos do Google Cloud/Firebase.
- **Autorização (Regras de Banco de Dados):** O acesso aos dados no Firestore é blindado por Regras de Segurança estritas, garantindo que apenas usuários logados e autorizados pelo hospital possam ler ou gravar informações.
- **Tratamento de Dados:** Dados importados de sistemas de terceiros (como o Soul MV e Tasy) são tratados no *front-end* e sanitizados antes de qualquer inserção no banco de dados.

Agradecemos por nos ajudar a manter os dados do hospital e dos pacientes seguros! 💙
