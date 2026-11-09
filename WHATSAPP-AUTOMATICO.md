# WhatsApp automático · passo a passo

Com isto configurado, o aviso de conclusão sai sozinho pelo **número oficial da empresa** assim que a OS é encerrada. O WhatsApp de quem fez a entrega não é aberto.

Enquanto não estiver configurado, o sistema continua funcionando como hoje: abre a conversa no WhatsApp de quem está usando.

**Antes de começar, você vai precisar de:**
- Um **número de telefone exclusivo para a empresa**, que **não** esteja em uso no aplicativo WhatsApp nem no WhatsApp Business. Pode ser um chip novo ou um número fixo que receba SMS ou ligação. Se usar um número que já está no aplicativo, ele precisa ser removido de lá antes.
- Acesso de administrador ao **Meta Business** (o portfólio empresarial do Facebook) do Grupo.
- Cerca de 1 hora, mais o tempo de aprovação do modelo de mensagem pela Meta (de minutos a algumas horas).

**Custo:** a Meta cobra por mensagem de modelo entregue. O aviso de conclusão é da categoria **Utilidade**. Consulte a tabela de preços em reais na página de preços da plataforma WhatsApp Business.

---

## Etapa 1 · Criar o aplicativo na Meta

1. Acesse **developers.facebook.com** e entre com o Facebook do administrador.
2. Clique em **Meus apps → Criar app**.
3. Escolha o caso de uso de **WhatsApp** (ou o tipo **Empresa** / *Business*), dê o nome `Logística MC` e vincule ao portfólio empresarial do Grupo.
4. No painel do app, adicione o produto **WhatsApp** (se ainda não estiver adicionado).

## Etapa 2 · Cadastrar o número da empresa

1. Em **WhatsApp → Configuração da API** (*API Setup*), clique em **Adicionar número de telefone**.
2. Informe o nome de exibição (ex.: `Logística Monte Carlo`), a categoria e o número exclusivo.
3. Confirme o código recebido por SMS ou ligação.
4. Na mesma tela, **copie o "Identificação do número de telefone"** (*Phone number ID*). É um número longo, diferente do telefone. Ele será o `WHATSAPP_PHONE_ID`.

> Para testar antes, a Meta oferece um número de teste que só envia para até 5 números cadastrados por você. Serve para validar tudo; depois troque pelo número oficial.

## Etapa 3 · Criar o modelo de mensagem

1. Acesse **business.facebook.com → WhatsApp Manager → Modelos de mensagem → Criar modelo**.
2. Preencha **exatamente** assim:
   - **Categoria:** Utilidade
   - **Nome:** `os_concluida`
   - **Idioma:** Português (BR)
   - **Corpo:**

```
Olá, {{1}}! Sua solicitação {{2}} foi concluída. A entrega foi feita em {{3}} no dia {{4}}, recebida por {{5}}. Qualquer dúvida, fale com a Logística do Grupo Monte Carlo.
```

3. Exemplos de variáveis pedidos pela Meta: `Laura`, `OS-0012`, `Monte Carlo Poker Club (Bar)`, `16/10/2026 às 10:05`, `Eduardo`.
4. Envie para análise e aguarde o status **Aprovado**.

## Etapa 4 · Gerar o token permanente

O token temporário da tela de teste expira em 24 horas. Para uso real, gere um permanente:

1. Em **business.facebook.com → Configurações do negócio → Usuários → Usuários do sistema**, clique em **Adicionar**, dê o nome `logistica-sistema` e a função **Administrador**.
2. Em **Atribuir ativos**, dê acesso ao app `Logística MC` e à **conta do WhatsApp Business**, com controle total.
3. Clique em **Gerar novo token**, escolha o app e marque as permissões `whatsapp_business_messaging` e `whatsapp_business_management`. Em validade, escolha **Nunca expira**.
4. **Copie o token** e guarde num lugar seguro. Ele será o `WHATSAPP_TOKEN`. Não o envie a ninguém nem o coloque no `config.js`.

## Etapa 5 · Publicar a função no Supabase

1. No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**.
2. Nome da função: `enviar-whatsapp` (exatamente assim).
3. Apague o código de exemplo, cole todo o conteúdo do arquivo `supabase/functions/enviar-whatsapp/index.ts` e clique em **Deploy function**.
4. Abra a função publicada → **Details** (ou *Settings*) e **desligue "Verify JWT with legacy secret"**. A própria função confere quem está chamando e só aceita usuários da Logística.
5. Vá em **Edge Functions → Secrets** e adicione:

| Nome | Valor |
|---|---|
| `WHATSAPP_TOKEN` | o token permanente da etapa 4 |
| `WHATSAPP_PHONE_ID` | o *Phone number ID* da etapa 2 |
| `WHATSAPP_TEMPLATE` | `os_concluida` |

## Etapa 6 · Ligar no sistema

1. No sistema, vá em **Cadastros → Regras → WhatsApp automático**.
2. Informe o seu celular em **Enviar teste para** e clique em **Enviar mensagem de teste**. A mensagem deve chegar em segundos, vinda do número da empresa.
3. Se chegou, marque **Enviar o aviso de conclusão automaticamente**.

Pronto: a cada OS encerrada, o aviso vai sozinho para o WhatsApp de quem pediu, e a OS mostra "aviso enviado automaticamente". Se algo falhar, o sistema mostra o motivo e oferece reenviar ou mandar pelo próprio WhatsApp.

## Erros comuns

| Mensagem | O que fazer |
|---|---|
| `nao_configurado` | Faltam os segredos da etapa 5. |
| `(#132001) Template name does not exist` | Nome ou idioma do modelo diferente de `os_concluida` / `pt_BR`, ou o modelo ainda não foi aprovado. |
| `(#132000) Number of parameters does not match` | O corpo do modelo não tem exatamente as 5 variáveis `{{1}}` a `{{5}}`. |
| `(#131030) Recipient phone number not in allowed list` | Você está usando o número de teste da Meta; cadastre o destinatário na lista de teste ou use o número oficial. |
| `(#190) ... access token` | Token expirado ou sem permissão. Gere o token permanente da etapa 4. |
| `sem_permissao` | Quem encerrou a OS não tem acesso de Logística. |
| "Não foi possível falar com a função" | A função não foi publicada com o nome `enviar-whatsapp`. |
