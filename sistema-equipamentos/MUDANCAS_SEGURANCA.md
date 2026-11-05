# Melhorias de segurança aplicadas

## Alterações no código
- Removido o armazenamento padrão em memória do `express-session`; sessões agora ficam em tabela MySQL com expiração e limpeza.
- `SESSION_SECRET` passou a ser obrigatório e precisa ter pelo menos 64 bytes.
- Cookies de sessão usam `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O estado e o perfil do usuário são consultados no banco em cada requisição autenticada. Contas inativas perdem a sessão; alterações de perfil passam a valer imediatamente.
- Tentativas de login são limitadas no MySQL por IP e por conta, com hashes HMAC em vez de IP/e-mail em texto puro e incremento atômico.
- CSRF usa token de 256 bits, valida formato e tamanho em bytes antes de comparação em tempo constante.
- Redirecionamento pós-login aceita somente caminhos internos.
- Limites de corpo de requisição, parâmetros, exportações e tamanho de relatórios foram adicionados.
- Configuração de banco em produção recusa usuário `root` e senha vazia; suporte a TLS do MySQL.
- Melhorias nos cabeçalhos CSP e na resposta de erros.
- Contas de demonstração desativadas; incluído script para criar o primeiro administrador.
- `.env` removido do pacote; `.env.example` contém somente marcadores e configurações seguras de exemplo.

## Antes de executar
1. Gere um novo `SESSION_SECRET` (a chave presente no ZIP antigo deve ser considerada comprometida).
2. Preencha `.env` com usuário e senha de banco dedicados.
3. Banco novo: execute `sql/schema.sql` e depois `sql/dados.sql`.
4. Banco existente: faça backup e execute `sql/migracao-seguranca.sql` (não execute o schema destrutivo em uma base com dados).
5. Crie uma conta administrativa com `npm run create-admin`.
6. Em produção, habilite HTTPS, `NODE_ENV=production` e configure `TRUST_PROXY=1` somente se houver um proxy reverso confiável.

## Validação realizada neste pacote
- Verificação sintática (`node --check`) de todos os arquivos JavaScript da aplicação e do script administrativo.
- Dependências instaladas conferidas com `npm ls --depth=0`.
- A auditoria `npm audit` foi tentada, mas o registry npm estava inacessível por falha de DNS/rede nesta execução. Portanto, o estado atual de advisories das dependências não pôde ser confirmado.
- Não foi possível executar testes integrados contra MySQL porque não havia servidor/cliente MySQL disponível neste ambiente.
