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
| `supabase/10_custos_gestao.sql` | Custos (km, hora da equipe, extras), orçamento por unidade e painel de Gestão |
| `supabase/11_reposicao_pendencias.sql` | Valor de reposição e vida útil dos equipamentos (consertar ou trocar) |
| `supabase/12_equipe_campo.sql` | Acesso da equipe de campo (usuário e senha, só as próprias missões) |
| `supabase/13_setores_sem_andar.sql` | Junta os setores que só mudavam de andar (Jogo 2, 3, 4… → Jogo) e cria o "Juntar com…" |
| `supabase/14_locais_setores_oficiais.sql` | Deixa locais e setores exatamente como a lista oficial (pode ser rodado sem o 13) |
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
6. Repita com `supabase/03_novidades.sql`, depois `supabase/04_km_whatsapp.sql` `supabase/05_solicitantes_whatsapp_auto.sql` `supabase/06_locais_permissoes.sql`, `supabase/07_setores_por_local.sql`, `supabase/08_manutencao.sql`, `supabase/09_acesso_por_area.sql`, `supabase/10_custos_gestao.sql`, `supabase/11_reposicao_pendencias.sql`, `supabase/12_equipe_campo.sql` e por fim `supabase/14_locais_setores_oficiais.sql` (o 13 é opcional: o 14 já faz o trabalho dele).
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

## Funções da atualização 12 · Custos e Gestão

Nova tela **Gestão**, para a coordenação (acesso às duas áreas) e para quem tem *Somente leitura* (diretoria, que já abre nela).

**O que mostra, mês a mês**
- Custo total de Facilities, logística e manutenção, com a comparação com o mês anterior.
- Orçamento usado, % concluídas no prazo e custo médio por OS.
- **Pontos de atenção** automáticos: unidade acima de 80% ou de 100% do orçamento, custo que subiu mais de 20%, queda no prazo, equipamento que concentra o custo, chamados abertos há mais de 7 dias e cadastros incompletos que deixam o custo subestimado.
- Gráfico dos últimos 12 meses (logística e manutenção), também em tabela.
- Custo por unidade, com orçamento e barra de uso; setores com maior custo; composição do custo (veículos, equipe, extras, peças, terceiros, mão de obra).
- **Resumo para a gerência** pronto para copiar ou enviar no WhatsApp, **Imprimir / PDF** e **Exportar CSV** com o custo de cada OS.

**Como o custo é calculado (OS concluídas no mês)**
- Logística: km rodado × custo por km do veículo + horas em rota × custo por hora de cada pessoa + custos extras (pedágio, estacionamento…) lançados no botão *Custos extras* da OS.
- Manutenção: custos lançados (peças, material, terceiros) + horas de trabalho × custo por hora dos técnicos. Ao concluir uma OS interna, informe as *Horas de trabalho*, sem as esperas.
- Unidade: a do setor que pediu; se não houver, o destino ou a origem (fornecedores não contam como unidade).

**Como instalar e configurar**
1. No Supabase, rode `supabase/10_custos_gestao.sql` no SQL Editor.
2. No GitHub, envie `app.js`, `styles.css`, `README.md` e o `10_custos_gestao.sql` dentro da pasta `supabase`.
3. Em **Cadastros → Regras → Custos padrão**, defina um custo por km e um custo por hora para todos. Depois, se quiser, valores próprios em **Veículos** (custo por km: combustível, manutenção, seguro e depreciação) e em **Equipe** (custo por hora: salário com encargos ÷ horas do mês).
4. Em **Cadastros → Locais**, preencha o **Orçamento mensal** de cada unidade.
5. A visão `os_custos` do Supabase traz o custo de cada OS de logística para o Power BI; junto com `manutencoes_custos`, cobre as duas áreas.

## Funções da atualização 13 · Consertar ou trocar e fila de pendências

**Consertar ou trocar**
- No cadastro de cada equipamento há dois campos novos: **Valor de um novo (R$)** e **Vida útil (anos)**. Se a vida útil ficar em branco, vale a típica da categoria (ar-condicionado e refrigeração 10 anos, gerador 20, elevador 25…).
- O sistema avalia cada equipamento:
  - **Trocar:** reparos dos últimos 12 meses ≥ 70% do valor de um novo, ou passou da vida útil com reparos frequentes ou caros.
  - **Avaliar troca:** reparos ≥ 40% do valor de um novo, 3 ou mais corretivas em 90 dias, passou da vida útil, ou está perto do fim dela com 2 ou mais corretivas no ano.
- O selo aparece na lista de equipamentos (com o filtro *Só com alerta de troca*). A página do equipamento explica os motivos e dá a recomendação. Há também uma lista no Painel da manutenção e na Gestão, e os casos de *Trocar* entram nos Pontos de atenção.
- A visão `equipamentos_reposicao` do Supabase traz esses números para o Power BI.

**Fila de pendências por idade**
- Mostra tudo o que está em aberto, separado por idade (0 a 2 dias, 3 a 7, 8 a 30, mais de 30), por área e por responsável (técnico, prestador, equipe da logística ou *Aguardando triagem*), com a mais antiga de cada um.
- Lista as pendências mais antigas, que abrem com um toque.
- Aparece no Painel da logística, no Painel da manutenção e, com as duas áreas juntas, na Gestão. Pendências com mais de 30 dias entram nos Pontos de atenção.
- Não entram as OS programadas para o futuro.

**Como instalar:** no Supabase, rode `supabase/11_reposicao_pendencias.sql`. No GitHub, envie `app.js`, `styles.css`, `README.md` e o `.sql` dentro da pasta `supabase`. Depois, preencha o valor de um novo e a data de instalação dos equipamentos principais.

## Atualização 14 · Fundo da tela de login

Ilustração no estilo Monte Carlo (marsala e dourado) com a rota entre as unidades, a van da logística, os prédios e as ferramentas da manutenção. É um arquivo vetorial leve (`assets/fundo-login.svg`), nítido em qualquer tela.

**Como instalar:** no GitHub, envie `styles.css` e o `fundo-login.svg` dentro da pasta `assets`. Não há SQL nesta atualização.

## Atualização 15 · Equipe de campo e lançamento passo a passo

**Acesso da equipe de campo (motoristas, ajudantes e técnicos da casa)**
1. A pessoa abre o site, toca em **Criar conta** e escolhe um **nome de usuário** (ex.: `joao.silva`) e uma senha. Não precisa de e-mail.
2. Em **Cadastros → Usuários**, escolha **Equipe de campo** e a **pessoa do cadastro da equipe** que usa aquele login. Clique em **Salvar**.
3. Pronto: no celular, ela entra com usuário e senha e vê **Minhas missões**, só com as OS em que foi escalada. Toque em *Adicionar à tela de início* para ficar como um app.
4. **Esqueceu a senha?** Em Cadastros → Usuários, clique em **Nova senha**. O sistema mostra uma senha provisória de 6 números para você passar à pessoa. No próximo acesso, ela cria a própria senha.

**O que a equipe vê no celular**
- **Minhas missões:** em andamento, para hoje e próximos dias, com o horário e o que fazer em cada uma, além das feitas no dia.
- **Logística:** *Antes de sair* (checklist do veículo e km) → em cada parada, o endereço com botões do Maps e do Waze, o que levar, a foto obrigatória e o nome de quem entregou ou recebeu → na entrega final, foto, nome, assinatura e km de chegada.
- **Manutenção:** *Começar serviço* (foto do antes, opcional) → **Terminei o serviço** (o que fez, foto do pronto, peças usadas, horas e assinatura) ou **Preciso parar** (falta peça, orçamento, prestador…) → *Retomar* quando puder.
- No banco de dados, a equipe de campo só vê e altera as próprias missões. Não consegue mudar equipe, horário, prioridade nem cancelar.

**Nova OS passo a passo (coordenação)**
- *Nova OS*, nas duas áreas, agora faz uma pergunta por tela, com botões grandes e um resumo no fim para conferir.
  - Logística: o que vai ser feito → de onde sai → para onde vai → o que vai → quem pediu → quando → quem vai.
  - Manutenção: o que precisa ser feito → tipo → onde → urgência → quem faz → quando.
- Quem gosta do formulário completo toca em *Prefere o formulário completo?* no fim da tela. Editar, duplicar, criar a partir de pedido e rota fixa continuam no formulário completo.

**Como instalar:** no Supabase, rode `supabase/12_equipe_campo.sql`. No GitHub, envie `app.js`, `styles.css`, `README.md` e o `.sql` dentro da pasta `supabase`. Confira em **Authentication → Sign In / Providers → Email** que *Confirm email* continua desligado (Etapa 3); sem isso, o cadastro por usuário não funciona.

> Os logins por usuário usam internamente o endereço `usuario@campo.facilities-mc.com`, que não recebe e-mail. Para trocar esse final, inclua `dominioUsuarios: "seu.dominio.com"` no `config.js` antes de criar as primeiras contas.

## Atualização 15.1 · Nomes dos acessos

Em **Cadastros → Usuários**, os acessos ficaram com nomes que dizem o que cada um faz, com um quadro explicativo no topo:
- **Equipe de campo · só executa:** motoristas, ajudantes e técnicos. Veem no celular só as missões em que foram escalados. Não criam nem alteram OS.
- **Gestão · cria e distribui OS:** o antigo "Facilities · equipe". Recebe os pedidos, cria as OS e escala equipe, veículo e horário.
- **Solicitante**, **Somente leitura** e **Bloqueado** continuam iguais.

Quem já estava como "Facilities · equipe" continua com o mesmo acesso, agora chamado Gestão. Mude para *Equipe de campo* quem deve só executar.

## Atualização 15.2 · Tela de usuários reorganizada

Em **Cadastros → Usuários**, cada pessoa agora tem um cartão, e os cartões ficam agrupados por tipo de acesso: *Aguardando liberação* (em destaque no topo), *Equipe de campo*, *Gestão*, *Solicitantes*, *Somente leitura* e *Bloqueados*. Cada cartão mostra só os campos daquele acesso:
- **Equipe de campo:** quem é a pessoa no cadastro da equipe.
- **Gestão:** a área (logística, manutenção ou as duas).
- **Solicitante:** o setor e a permissão de cadastrar fornecedor.

A explicação dos tipos de acesso fica em *Entenda os tipos de acesso*, e com mais de 6 contas aparece uma busca por nome.

## Atualização 16 · Cadastrar na hora, dentro da OS

Ao criar uma OS, no passo a passo ou no formulário completo, dá para cadastrar o que faltar sem sair da tela. O item cadastrado já fica escolhido na OS:
- **Local:** no campo de busca do local, o primeiro botão da lista é *+ Cadastrar novo local* (nome, tipo, endereço e contato).
- **Setor:** *+ Cadastrar setor*, com o nome e a unidade. Na manutenção, a unidade já vem marcada pelo local escolhido.
- **Pessoa da equipe** (motorista, ajudante, técnico): *+ Cadastrar pessoa na equipe*, com nome, função e telefone. Aparece no passo *Quem vai?* da logística, em *Quem vai fazer?* da manutenção e na triagem.
- **Veículo:** *+ Cadastrar veículo*, com nome, placa e tipo.
- **Prestador terceirizado:** *+ Cadastrar prestador terceirizado*, com empresa, especialidade, telefone e contato.
- **Solicitante:** basta digitar o nome e o WhatsApp de alguém novo. O sistema avisa *Solicitante novo* e cadastra ao criar a OS. A manutenção ganhou o passo *Quem pediu?* (opcional).

Se o nome já existir, o sistema usa o cadastro que já existe em vez de duplicar. Os dados completos (custo por hora, custo por km, CNPJ…) continuam em Cadastros.

**Como instalar:** no GitHub, envie `app.js`, `styles.css` e `README.md`. Não há nada para rodar no Supabase.

## Atualização 17 · Setores sem andar

**Um setor por local, sem andar:** *Jogo · M.C.*, *Bar · M.G.*, *Cozinha · M.C.*… O andar, a sala ou a mesa vão no campo **Observação** da OS (por exemplo: "3º andar, mesa de Omaha 5"), que sugere Térreo, 1º a 4º andar, Arena, Área VIP, Doca…

**O script 13 faz a conversão sozinho**, local por local:
- **M.C.:** Jogo (2, 3, 4 e Arena) → *Jogo*; Bar 2, 3, 4 e Arena → *Bar*; Caixa 2, 3, 4 e Arena → *Caixa*; Cozinha 1º a 4º → *Cozinha*; Decoração e Eventos (todos os andares) → *Decoração e Eventos*; Estacionamento (2) e (3) → *Estacionamento*; Estacionamento (Frota) → *Frota*; Sala de Segurança e Alojamento Segurança → *Segurança*; Estoque Central M.C. → *Estoque*; Recepção Arena → *Recepção*.
- **M.G.:** Jogo (1 Andar) e (Vip) → *Jogo*; Bar, Caixa e Cozinha (1 Andar e Vip) → *Bar*, *Caixa* e *Cozinha*; Cozinha (Funcionários) e Refeitório (Funcionários) → *Refeitório*.
- **Prédio Cardoso:** 2 Andar, 3 Andar e Térreo → *Administrativo*; Cozinha (2, 3 e Térreo) → *Cozinha*.
- Resultado: de 72 para 43 setores. As OS, pedidos, chamados, equipamentos, usuários, solicitantes e rotas fixas antigos passam para o setor novo, sem perder histórico.

**Juntar com…:** em **Cadastros → Setores** e **Cadastros → Locais**, a coordenação pode juntar um cadastro repetido com o certo. Tudo o que estava ligado ao repetido passa para o certo, e o repetido é apagado. Setores só se juntam com setores do mesmo local. A lista de locais aparece separada em Unidades e escritórios, Centros de distribuição, Residências e Fornecedores.

**Cadastro rápido de setor:** recusa nomes com andar ("Jogo 3º andar") e lembra que o andar vai na observação.

**Como instalar:** no Supabase, rode `supabase/13_setores_sem_andar.sql`. No GitHub, envie `app.js`, `styles.css`, `README.md` e o `.sql` dentro da pasta `supabase`.

## Atualização 18 · Locais e setores oficiais

O script `14_locais_setores_oficiais.sql` deixa o cadastro exatamente assim:

| Local | Setores |
|---|---|
| Monte Carlo Poker Club (M.C.) | Jogo, A&B, Recepção, T.I., Administrativo, Financeiro, Manutenção, Segurança, Bombeiros, RH, Operações e Logística, Compras, Uniforme, Portaria, Estoque, Limpeza, Estacionamento, Eventos e Decoração, Controle de Acesso |
| Mirage (M.G.) | Os mesmos 19 e mais Marketing |
| Restaurante Doryo | Os mesmos 19 |
| Escritório Central | Os mesmos 19 |
| Escritório Guararapes, Casas do Chefe, Casas de Funcionários, Flats do Chefe | Sem setores |
| Depósitos: CD 1, CD 2, Prédio da Cardoso, Depósito Descarte, Depósito Manutenção | Sem setores |

O andar, a sala ou a mesa vão no campo **Observação** da OS.

**O que acontece com o que já existe**
- Locais com nome antigo são renomeados: *Residência da chefia* vira **Casas do Chefe**, *Residência de funcionário* vira **Casas de Funcionários** e *Prédio Cardoso de Melo* vira **Prédio da Cardoso**. Os que faltam são criados, sem endereço: preencha em Cadastros → Locais. Fornecedores não mudam.
- Os setores antigos passam para os oficiais do mesmo local, levando as OS, pedidos, chamados, equipamentos, usuários e rotas fixas:
  - Bar, Cozinha, Confeitaria e Refeitório → **A&B**;
  - Caixa → **Jogo**;
  - Valet e Garagem → **Estacionamento**;
  - Brigada → **Bombeiros**;
  - Frota → **Operações e Logística**;
  - Mídia e Som → **T.I.**;
  - Recursos Humanos → **RH**;
  - Sala de Uniformes → **Uniforme**;
  - Decoração e Eventos → **Eventos e Decoração**;
  - os andares (Jogo 2, 3, 4, Arena…) viram um só.
- *Disponível* e os setores do Prédio da Cardoso e do CD 1 deixam de existir. As OS ligadas a eles ficam sem setor, mas mantêm o local.
- Setores criados por vocês que não estão na lista oficial são desativados: somem das listas e ficam no histórico.

**Como instalar**
1. No Supabase, no projeto do Facilities e com o tradutor desligado, rode `supabase/14_locais_setores_oficiais.sql`. Não dá para desfazer a junção dos setores.
2. No GitHub, envie o pacote completo, **menos o `config.js`**.
3. Em **Cadastros**, o selo deve mostrar **Versão 18**.

## Atualização 19 · Só os locais oficiais
- Rode `supabase/15_locais_somente_oficiais.sql` **depois do 14**. Ele junta "Residência 1/2/3… da chefia" em **Casas do Chefe**, as de funcionário em **Casas de Funcionários**, "Estoque Central M.C." no **Monte Carlo** (setor Estoque) e desativa qualquer outro local que não seja oficial nem fornecedor.
- Os endereços das casas ficam todos juntos no endereço do local.
- Em Cadastros → Setores, a lista agora vem separada por local.

## Atualização 20 · Celular
- Campos com letra de 16px no celular: o iPhone não dá mais zoom sozinho ao tocar num campo.
- Telas mais compactas no celular (títulos, cartões, indicadores e listas).
- O número da versão aparece também na tela de login.
- `vercel.json` faz o navegador sempre buscar a versão nova; os arquivos são carregados com `?v=20`.
- No site publicado, se a configuração não carregar, aparece "Não foi possível conectar" em vez do modo demonstração.

## Atualização 21 · Frota
- Rode `supabase/17_frota.sql` (depois do 16).
- Novo menu **Frota** na logística: situação de cada veículo, alertas de conferência, troca de óleo e revisão.
- Cadastro completo do veículo: marca, modelo, cor, ano, combustível, RENAVAM, chassi, uso (logística, traslado, escolta, particular do chefe), km inicial, intervalos de óleo e revisão (km e, se quiser, meses) e documento em PDF ou foto (arquivo privado).
- Conferência semanal (prazo ajustável na tela Frota): óleo, água, vidros, travas, fechaduras, estepe, pneus e km. Item ruim abre na hora uma OS de manutenção (categoria Veículos, prioridade alta).
- O km do veículo se atualiza pela conferência, pelos serviços lançados e pelo km final das rotas.
- A equipe de campo vê no topo de "Minhas missões" os veículos que precisam de conferência.
- O Painel da logística mostra o quadro "Frota · atenção" com o que está vencido ou perto de vencer.
