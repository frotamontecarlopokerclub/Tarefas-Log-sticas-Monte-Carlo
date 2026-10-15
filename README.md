# Logística MC · Ordens de Serviço

Sistema de ordens de serviço (OS) da logística interna do Grupo Monte Carlo: pedidos dos setores, OS com equipe e veículo, saída, entrega com foto e assinatura, agenda, painel de indicadores e relatório mensal.

**Como funciona por dentro**
- **Supabase** guarda os dados (banco PostgreSQL), as fotos e cuida do login.
- **GitHub** guarda o código.
- **Vercel** publica o site num endereço próprio. A cada mudança no GitHub, a Vercel atualiza o site sozinha.

Não há instalação nem programação. São três contas gratuitas e cerca de 40 minutos.

---

## Arquivos do projeto

| Arquivo | Para que serve |
|---|---|
| `index.html`, `app.js`, `styles.css` | O sistema |
| `config.js` | Endereço e chave do Supabase (você preenche) |
| `manifest.webmanifest`, `assets/` | Ícone e nome do app no celular |
| `supabase/01_estrutura.sql` | Cria tabelas, regras de segurança e o armazenamento de fotos |
| `supabase/02_cadastros.sql` | Carrega locais, setores, equipe e veículos atuais |

---

## Etapa 1 · Criar as três contas

1. **GitHub:** acesse github.com e clique em *Sign up*. Use o e-mail da empresa.
2. **Supabase:** acesse supabase.com, clique em *Start your project* e entre com a conta do GitHub.
3. **Vercel:** acesse vercel.com, clique em *Sign Up*, escolha o plano *Hobby* e entre com a conta do GitHub.

Entrar no Supabase e na Vercel com o GitHub deixa tudo ligado com um único login.

## Etapa 2 · Criar o banco no Supabase

1. No Supabase, clique em **New project**.
   - *Name:* `logistica-mc`
   - *Database password:* clique em *Generate a password* e **guarde essa senha** num local seguro.
   - *Region:* **South America (São Paulo)**.
2. Aguarde o projeto ficar pronto (1 a 2 minutos).
3. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
4. Abra o arquivo `supabase/01_estrutura.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**. Deve aparecer *Success. No rows returned*.
5. Abra outra *New query*, faça o mesmo com `supabase/02_cadastros.sql` e clique em **Run**.
6. Confira em **Table Editor**: devem aparecer as tabelas `os`, `pedidos`, `locais` e as outras, com os seus locais e setores já preenchidos.

## Etapa 3 · Ajustar o login no Supabase

1. Menu **Authentication** → **Sign In / Providers** → **Email**.
   - Deixe **Enable Email provider** ligado.
   - **Desligue "Confirm email"** e salve. Assim, quem se cadastra entra direto na tela "aguardando liberação", sem depender de e-mail. A segurança continua, porque ninguém vê nada até a logística liberar o acesso.
2. O envio de e-mail do Supabase gratuito tem limite baixo por hora, e ele é usado no "Esqueci minha senha". Se a equipe precisar disso com frequência, dá para ligar o e-mail da empresa depois, em **Authentication → Emails → SMTP Settings**.

## Etapa 4 · Colocar o endereço e a chave no `config.js`

1. No Supabase, clique no botão **Connect**, no topo do projeto (ou vá em **Settings → API Keys**).
2. Copie dois valores:
   - **Project URL**, algo como `https://abcdxyz.supabase.co`;
   - **Publishable key**, que começa com `sb_publishable_`. Em projetos mais antigos, ela aparece como **anon public**.
3. Abra o `config.js` no Bloco de Notas e cole cada valor entre as aspas:

```js
window.MC_CONFIG = {
  supabaseUrl: "https://abcdxyz.supabase.co",
  supabaseAnonKey: "sb_publishable_xxxxxxxxxxxxxxxx"
};
```

4. Salve o arquivo.

> Nunca use a **secret key** nem a **service_role** no `config.js`. Elas dão acesso total ao banco.

## Etapa 5 · Subir o código no GitHub

1. No GitHub, clique em **+** (canto superior direito) → **New repository**.
   - *Repository name:* `logistica-mc`
   - Marque **Private**.
   - Clique em **Create repository**.
2. Na página do repositório vazio, clique no link **uploading an existing file**.
3. Arraste **todo o conteúdo** da pasta do projeto: os arquivos e as pastas `assets` e `supabase`. Não arraste a pasta de fora, só o que está dentro dela.
4. Embaixo, clique em **Commit changes**.

## Etapa 6 · Publicar na Vercel

1. Na Vercel, clique em **Add New… → Project**.
2. Em *Import Git Repository*, autorize o GitHub se for pedido e clique em **Import** ao lado de `logistica-mc`.
3. Em *Framework Preset*, deixe **Other**. Não precisa mudar mais nada.
4. Clique em **Deploy**. Em menos de um minuto aparece o endereço, algo como `https://logistica-mc.vercel.app`.

## Etapa 7 · Informar o endereço do site ao Supabase

1. No Supabase: **Authentication → URL Configuration**.
2. Em **Site URL**, cole o endereço da Vercel (ex.: `https://logistica-mc.vercel.app`) e salve.
3. Em **Redirect URLs**, clique em *Add URL*, cole o mesmo endereço e salve.

Sem isso, o link de "Esqueci minha senha" não volta para o sistema.

## Etapa 8 · Primeiro acesso

1. Abra o endereço da Vercel e clique em **Criar conta**.
2. **A primeira pessoa a se cadastrar vira a administradora (Logística).** Faça esse cadastro você, antes de divulgar o link.
3. Entre e confira **Cadastros**: troque a equipe e os veículos de exemplo pelos reais.

## Etapa 9 · Liberar a equipe

1. Envie o endereço para a equipe. Cada pessoa clica em **Criar conta** e cai na tela "aguardando liberação".
2. Em **Cadastros → Usuários**, defina o acesso de cada um e clique em **Salvar**:
   - **Logística:** coordenação, motoristas e ajudantes. Registram e movimentam OS e atendem pedidos.
   - **Setor:** quem faz pedidos à logística. Escolha também o setor da pessoa.
   - **Somente leitura:** diretoria e gestores que só acompanham.
   - **Bloqueado:** quem saiu da empresa.
3. No celular, abra o endereço e use **Adicionar à tela de início**. O app aparece com o ícone MC.

---

## Mudanças futuras

Qualquer arquivo alterado e enviado de novo ao GitHub (**Add file → Upload files**, com o mesmo nome) é publicado pela Vercel automaticamente em cerca de um minuto.

## Backup e relatórios externos

- **Planilha:** o botão *Exportar CSV* no Painel e no Relatório gera uma planilha que abre no Excel.
- **Banco:** o plano gratuito não inclui backup automático para baixar. Exporte o CSV todo mês; quando o uso crescer, avalie o plano pago. No plano gratuito, projetos parados por alguns dias são pausados; com uso diário, isso não acontece.
- **Power BI:** pode se conectar direto ao PostgreSQL do Supabase, com os dados de conexão em *Connect → Connection string*.
