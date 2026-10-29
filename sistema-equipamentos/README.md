# Sistema de Gerenciamento de Equipamentos
Laboratórios de Informática • Colégio Estadual Mendes Gonçalves • Guaíra - PR

Sistema web (Node.js + Express + MySQL 8) com as telas do protótipo do Figma: login, dashboard, equipamentos (lista, cadastro, edição, detalhes e histórico), setores, usuários e relatórios (com exportação em PDF e CSV).

## Instalação
Pré-requisitos: **Node.js 20+** e **MySQL 8** (ou MariaDB 10.6+), por exemplo via XAMPP.

1. Instale as dependências: `npm install`
2. Crie o banco e os dados de demonstração (MySQL Workbench, phpMyAdmin ou terminal):
   ```
   mysql -u root -p < sql/schema.sql
   mysql -u root -p < sql/dados.sql
   ```
3. Copie `.env.example` para `.env` e preencha usuário/senha do MySQL e um `SESSION_SECRET` longo e aleatório.
4. Inicie: `npm start` e acesse **http://localhost:3000**

## Contas de demonstração
| Perfil | Usuário ou e-mail | Senha |
|---|---|---|
| Administrador | ana.silva | Admin@123 |
| Operador | carlos.oliveira | Operador@123 |
| Consulta (inativa no seed, ative em Usuários) | fernanda.lima | Consulta@123 |

**Troque estas senhas antes de usar fora da demonstração.**

## Perfis
- **Administrador:** tudo (equipamentos, setores, usuários, relatórios).
- **Operador:** cadastra/edita equipamentos e altera situação; consulta setores e relatórios.
- **Consulta:** apenas leitura e relatórios.

## Estrutura
```
sql/schema.sql   tabelas e chaves        sql/dados.sql   120 equipamentos fictícios
src/server.js    configuração, sessão, segurança
src/routes/      auth, dashboard, equipamentos, setores, usuarios, relatorios
src/middleware/  autenticação, perfis e proteção CSRF
views/           telas (EJS)             public/         CSS e JavaScript
docs/DER.md      diagrama entidade-relacionamento
```

## Requisitos do projeto e onde estão
- **RNF03/RF01:** senhas com bcrypt (custo 12), sessão com cookie httpOnly, proteção CSRF, limite de 5 falhas de login por IP em 15 min, cabeçalhos de segurança (helmet).
- **SQL parametrizado** em todas as consultas (mysql2 com `?`).
- **RN03/RN08:** validação no servidor (setor ativo, patrimônio único, campos obrigatórios).
- **RN05/RN07:** equipamentos e setores só são desativados, nunca excluídos.
- **RN06/RF05:** toda mudança de situação exige justificativa e grava em `historico_equipamentos` na mesma transação.
- **RN09/RF06:** relatórios e exportações respeitam os filtros e incluem todos os resultados, não só a página atual.
- **RN10:** todas as rotas exigem sessão; áreas administrativas exigem perfil compatível.

## Decisões em relação ao protótipo
- Na edição, a **situação fica somente leitura**: mudanças passam por "Alterar situação", para garantir o histórico (RN06).
- Desativar/reativar equipamento pede **justificativa** (necessária para o histórico).
- O "usuário" do login é a parte do e-mail antes do `@` (a tabela de usuários do projeto não tem campo de login).

## Roteiro de testes (evidências)
1. Login inválido mostra "Usuário ou senha inválidos"; sem login, qualquer página redireciona ao login.
2. Operador não acessa /usuarios (403); Consulta não vê botões de edição.
3. Cadastro com campos vazios mostra "Campo obrigatório"; patrimônio repetido é recusado.
4. Alterar situação sem justificativa é recusado; com justificativa aparece na linha do tempo.
5. Desativar setor mantém os equipamentos vinculados.
6. Relatório filtrado por "Defeituoso" mostra 6 registros e o CSV/PDF exportam os mesmos 6.
7. Telas em 1440 px e 390 px (tabelas viram cartões no celular).
