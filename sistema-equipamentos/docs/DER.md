# Diagrama Entidade-Relacionamento (DER)

Cole o bloco abaixo em https://mermaid.live (ou veja no GitHub, que renderiza automaticamente).
Para o DER formal do MySQL, use o **MySQL Workbench**: *Database → Reverse Engineer* sobre o banco `equipamentos_db` e depois *File → Export → PNG/PDF*.

```mermaid
erDiagram
  SETORES ||--o{ EQUIPAMENTOS : "possui"
  CATEGORIAS ||--o{ EQUIPAMENTOS : "classifica"
  EQUIPAMENTOS ||--o{ HISTORICO_EQUIPAMENTOS : "registra"
  USUARIOS ||--o{ HISTORICO_EQUIPAMENTOS : "realiza"
  USUARIOS ||--o{ EQUIPAMENTOS : "cadastra"

  USUARIOS { int id_usuario PK
    string nome
    string email UK
    string senha_hash
    enum perfil
    bool ativo
    datetime data_cadastro }
  SETORES { int id_setor PK
    string nome UK
    string descricao
    string localizacao
    string responsavel
    bool ativo }
  CATEGORIAS { int id_categoria PK
    string nome UK
    string descricao }
  EQUIPAMENTOS { int id_equipamento PK
    string numero_patrimonio UK
    string nome
    int id_categoria FK
    string marca
    string modelo
    string numero_serie
    int id_setor FK
    date data_aquisicao
    enum situacao
    text observacoes
    bool ativo
    datetime data_cadastro
    int id_usuario_cadastro FK }
  HISTORICO_EQUIPAMENTOS { int id_historico PK
    int id_equipamento FK
    int id_usuario FK
    string situacao_anterior
    string situacao_nova
    string justificativa
    datetime data_alteracao }
```
