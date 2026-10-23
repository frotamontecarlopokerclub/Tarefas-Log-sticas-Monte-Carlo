# Facilities MC · Ordens de Serviço

Sistema de ordens de serviço (OS) de Facilities do Grupo Monte Carlo, com duas áreas. **Logística:** pedidos dos setores, OS com equipe e veículo, entrega com foto e assinatura, agenda, painel e relatório mensal. **Manutenção:** chamados dos setores, triagem, execução com fotos de antes e depois, custos, preventivas e equipamentos com QR Code.

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
| `supabase/03_novidades.sql` | Várias paradas, checklist do veículo e rotas fixas |
| `supabase/04_km_whatsapp.sql` | WhatsApp de quem pediu, aviso de conclusão e visão de km rodados |
| `supabase/05_solicitantes_whatsapp_auto.sql` | Cadastro de solicitantes e envio automático do aviso |
| `supabase/06_locais_permissoes.sql` | Cadastro de local direto na OS e permissão por usuário para cadastrar fornecedor |
| `supabase/07_setores_por_local.sql` | Os 72 setores de cada unidade (M.C., M.G., Doryo, Prédio Cardoso e CD 1) |
| `supabase/08_manutencao.sql` | Manutenção: chamados, OS, equipamentos, prestadores, preventivas e custos |
| `supabase/09_acesso_por_area.sql` | Acesso da equipe por área (só logística, só manutenção ou as duas) |
| `assets/qrcode.js` | Gerador das etiquetas com QR Code dos equipamentos |
| `supabase/functions/enviar-whatsapp/index.ts` | Função do servidor que envia o WhatsApp automático |
| `WHATSAPP-AUTOMATICO.md` | Passo a passo da Meta e do Supabase para o envio automático (opcional) |

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
6. Repita com `supabase/03_novidades.sql`, depois `supabase/04_km_whatsapp.sql` `supabase/05_solicitantes_whatsapp_auto.sql` `supabase/06_locais_permissoes.sql`, `supabase/07_setores_por_local.sql`, `supabase/08_manutencao.sql` e por fim `supabase/09_acesso_por_area.sql`.
7. Confira em **Table Editor**: devem aparecer as tabelas `os`, `pedidos`, `locais` e as outras, com os seus locais e setores já preenchidos.

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

---

## Funções da atualização 03

- **Várias paradas:** no formulário, use *Adicionar parada* para montar rotas com várias retiradas e entregas, por exemplo CD 1 → CD 2 → Doryo. Em rota, cada parada é registrada com foto e assinatura. A última parada fecha a OS.
- **Rotas fixas:** marque *Repetir toda semana* e escolha os dias. O sistema cria as OS sozinho com 7 dias de antecedência, sem duplicar. Gerencie em **Cadastros → Rotas fixas**: editar, pausar ou excluir.
- **Checklist do veículo:** antes de *Iniciar rota*, a equipe responde OK ou Problema em cada item. Problemas ficam registrados na OS e aparecem no Painel, na tabela de veículos. Os itens são editados em **Cadastros → Regras**.
- **Duplicar e excluir:** no detalhe da OS. Excluir apaga de vez; para manter o registro, use *Cancelar*.

## Funções da atualização 04

- **Quilometragem:** com veículo definido, o km de saída e o km de chegada são obrigatórios. O sistema sugere o último km registrado do veículo, alerta se o número for menor que o último registro ou se a missão passar de 1.500 km, e mostra quanto rodou em cada OS. O Painel ganhou o indicador *Km rodados*, e o cadastro de veículos mostra o odômetro atual.
- **Aviso no WhatsApp:** informe o WhatsApp de quem pediu na OS. Ao concluir, o sistema abre o aviso com a mensagem de conclusão pronta; um toque abre a conversa direto com a pessoa. O botão *Avisar no WhatsApp* também fica no detalhe da OS concluída.
- **Relatórios externos:** a visão `os_km` no Supabase traz os km rodados de cada OS, pronta para Power BI ou planilhas.

## Funções da atualização 05

- **Solicitantes:** nome e WhatsApp de quem pediu passam a ser obrigatórios em toda OS. Ao digitar o nome, os contatos cadastrados aparecem na lista e o WhatsApp é preenchido sozinho. Quem é novo é salvo automaticamente ao registrar a OS. A lista fica em **Cadastros → Solicitantes**. Nos pedidos feitos pelos setores, o WhatsApp de quem pede também é obrigatório e fica lembrado para os próximos pedidos.
- **WhatsApp automático:** com a configuração do guia `WHATSAPP-AUTOMATICO.md`, o aviso de conclusão sai sozinho pelo número oficial da empresa assim que a OS é encerrada. Sem a configuração, o sistema continua abrindo a conversa no WhatsApp de quem está usando.

## Funções da atualização 06

- **Busca de local:** nas paradas da OS e no pedido do setor, digite parte do nome ou do endereço e escolha na lista.
- **Cadastrar local sem sair da tela:** se o local não existir, toque em *+ Cadastrar novo local*, informe nome, endereço e contato e salve. Ele já fica escolhido na parada. O sistema avisa quando já existe um local com nome parecido.
- **Maps e Waze:** no detalhe da OS, cada parada com endereço tem os botões para abrir a rota.
- **Permissões por usuário (Cadastros → Usuários):** *Solicitante* faz pedidos; *Somente leitura* acompanha sem fazer pedidos. Para solicitantes, marque *Cadastra fornecedor* para permitir incluir fornecedores novos no pedido (só do tipo Fornecedor; clubes, CDs e demais locais continuam com a logística).

## Funções da atualização 07

- **Setores por local:** cada setor pertence a uma unidade e aparece sempre com a sigla, por exemplo *Valet · M.G.* ou *Cozinha 2º Andar · M.C.*. Nas listas, os setores vêm agrupados por unidade.
- **Sugestão de setor na parada:** ao escolher o local de uma parada, o campo de detalhe sugere os setores daquela unidade.
- **Cadastros:** em *Setores*, cada um tem o campo *Local*; em *Locais*, cada um tem uma *Sigla*.

## Funções da atualização 09

- **Iniciar rota = saída do veículo:** ao sair (por exemplo, do Monte Carlo rumo ao fornecedor), basta o checklist e o km. Não pede mais foto na saída.
- **Foto em cada parada:** em rota, o botão principal mostra sempre o próximo passo: *Registrar retirada em Fornecedor A*, depois *Registrar retirada em Fornecedor B*, e por fim *Concluir entrega em Destino*.
  - **Retirada:** foto da mercadoria obrigatória; nome de quem liberou é opcional.
  - **Entrega:** foto do material entregue, assinatura e nome de quem recebeu.
- **Ordem garantida:** a OS só é concluída depois que todas as retiradas foram registradas com foto. Vale para qualquer OS, com 2 ou mais paradas.
- **OS antigas** que já saíram com foto na saída continuam valendo: aquela foto conta como a primeira retirada.

## Funções da atualização 10 · Manutenção

O sistema passa a se chamar **Facilities MC**. No topo, o seletor **Logística | Manutenção** troca de área. Cadastros, usuários e locais são os mesmos para as duas.

**Como instalar esta atualização**
1. No Supabase, abra **SQL Editor → New query**, cole o conteúdo de `supabase/08_manutencao.sql` e clique em **Run**.
2. No GitHub, envie os arquivos `app.js`, `styles.css`, `index.html`, `manifest.webmanifest`, `README.md`, a pasta `supabase` (com o `08_manutencao.sql`) e o arquivo `assets/qrcode.js` (dentro da pasta `assets`).
3. Em **Cadastros → Equipe**, marque a área de cada pessoa: técnicos em *Manutenção*; quem faz as duas coisas em *Logística e manutenção*.
4. Em **Cadastros → Prestadores**, cadastre as empresas terceirizadas.

**Fluxo da manutenção**
- **Chamado:** o solicitante toca em *Abrir chamado*, descreve o problema, escolhe o local, a urgência e manda foto. Acompanha tudo em *Meus chamados* e pode cancelar enquanto ninguém atendeu.
- **Triagem:** em *Chamados e OS → Chamados novos*, Facilities define categoria, prioridade, técnico ou prestador, data e prazo.
- **Execução:** *Iniciar serviço* (foto do antes e diagnóstico, opcionais) → se faltar algo, *Aguardando peça ou orçamento* (com valor do orçamento) → *Retomar* → *Concluir serviço*, com o que foi feito, foto do serviço pronto (obrigatória), custos, nome e assinatura de quem recebeu. Se houver WhatsApp de quem pediu, o aviso de conclusão fica pronto para enviar.
- **Prazos:** sem prazo definido na triagem, vale o prazo da prioridade (urgente 4 h, alta 24 h, normal 72 h, baixa 7 dias). Ajuste em **Cadastros → Regras**.
- **Preventivas:** em *Preventivas → Novo plano*, escolha o equipamento ou o local, a frequência (semanal a anual), a primeira data, o executor e o checklist. As OS são criadas sozinhas 14 dias antes, e o checklist precisa ser respondido para concluir.
- **Equipamentos e QR Code:** em *Equipamentos*, cadastre com patrimônio, local, setor, marca e garantia. *Imprimir etiquetas* gera uma folha A4 com QR Codes para colar nos equipamentos. Quem aponta a câmera para o QR abre a página do equipamento (histórico, custo acumulado) e o chamado já preenchido.
- **Painel da manutenção:** chamados por dia, aguardando triagem, atrasadas, % no prazo, tempo até o atendimento, tempo de solução, custo, categorias, locais, equipamentos com mais chamados, prestadores e equipe. *Exportar CSV* gera a planilha. A visão `manutencoes_custos` do Supabase traz o custo de cada OS para o Power BI.

**Logística mais rápida:** a Nova OS mostra só o essencial: de onde e para onde, o que vai, quem pediu, quando, equipe e veículo. Tipo, prioridade, canal, previsão, observações e rota fixa ficam em *Mais detalhes*. Se o tipo não for escolhido, o sistema define pelo trajeto (fornecedor → *Coleta em fornecedor*; CD → unidade → *Abastecimento de estoque*; para residência → *Entrega*).

## Funções da atualização 11 · Acesso por área

Em **Cadastros → Usuários**, quem tem acesso *Facilities · equipe* ganhou a coluna **Área**:
- **Só logística** (motoristas e ajudantes): veem e operam apenas OS de logística, pedidos, agenda, rotas fixas e veículos.
- **Só manutenção** (técnicos): veem e operam apenas chamados, OS de manutenção, preventivas, equipamentos e prestadores.
- **As duas áreas** (coordenação): veem tudo, trocam de área no topo e são os únicos que liberam usuários e definem acessos.

Locais, setores, solicitantes e equipe são compartilhados e podem ser editados pelas duas áreas. Cada área vê só as suas regras em *Cadastros → Regras*. A separação vale também no banco de dados: mesmo que alguém tente acessar a outra área por fora do app, o Supabase bloqueia. Solicitantes e somente leitura não mudam.

**Como instalar:** no Supabase, rode `supabase/09_acesso_por_area.sql` no SQL Editor. No GitHub, envie `app.js`, `styles.css`, `README.md` e o `09_acesso_por_area.sql` dentro da pasta `supabase`. Quem já é da equipe continua com as duas áreas até você mudar.
