/**
 * Histórico de versões mostrado pra pessoa usuária (selo "vX.Y.Z" no
 * canto do menu → clique abre o que mudou). Fonte ÚNICA da versão do
 * app: `APP_VERSION` é sempre a primeira entrada daqui, e o teste em
 * `__tests__/changelog.test.ts` garante que `package.json#version` bate
 * com ela.
 *
 * Toda mudança que a pessoa perceba usando o sistema ganha uma entrada
 * NOVA no topo (nunca editar uma versão já publicada — é histórico).
 * Texto em linguagem simples, não de programador: o que ela vai notar, não
 * como foi feito (o "como" fica em docs/decisoes.md).
 *
 * Semver simples: correção = patch, algo novo = minor.
 */

export type ChangeType = "novo" | "melhoria" | "correcao";

export interface ChangelogEntry {
  version: string;
  /** AAAA-MM-DD */
  date: string;
  changes: { type: ChangeType; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.15.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "Lembrete de backup: o sistema avisa o responsável, a cada 3 horas (ou no intervalo que ele escolher em Backup), para baixar um backup e não perder o que foi feito se houver uma falha. Baixar o backup zera o lembrete.",
      },
    ],
  },
  {
    version: "0.14.1",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "No controle remoto, janelas e avisos que aparecem na tela da pessoa (como a pergunta de salvar alterações) agora aparecem no espelho do dono — antes ficavam invisíveis por causa da animação.",
      },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "O histórico de acessos agora também aparece na ficha de cada organização (só os acessos das pessoas dela, com apagar um ou todos), além do histórico geral no painel do dono.",
      },
    ],
  },
  {
    version: "0.13.1",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "O aviso de alterações não salvas agora também percebe mudanças em listas de opções e interruptores (antes só percebia campos de texto), inclusive quando o dono edita pelo controle remoto.",
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: 'Painel do dono: novo cartão "Histórico de acessos" com cada login (e-mail, organização, data e hora exatas, IP, localização aproximada e aparelho). Dá para apagar um registro ou todos.',
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "Ao sair de uma tela com alterações não salvas (clicando no menu, em um link ou no botão Voltar), o sistema pergunta se você quer continuar editando, descartar e sair ou salvar. Fechar a aba ou recarregar também avisa.",
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "Painel do admin: os blocos da ficha da empresa (suporte ao vivo, cobrança, usuários, módulos, histórico etc.) e o do Telegram agora começam recolhidos e abrem ao clicar no título. O suporte ao vivo já abre sozinho quando há uma conversa ou tela em andamento.",
      },
    ],
  },
  {
    version: "0.10.3",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "No controle remoto, o dono agora recolhe/expande a caixa de conversa que aparece na tela da pessoa e a move para os lados, com botões próprios (o alvo é pequeno e o arrasto não passa pelo espelho).",
      },
    ],
  },
  {
    version: "0.10.2",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "No controle remoto, os menus suspensos agora funcionam: tocar numa lista de opções mostra as opções para o dono escolher (a lista nativa do navegador não aparece no espelho), e menus feitos em JS passam a abrir com o clique do dono.",
      },
    ],
  },
  {
    version: "0.10.1",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "No controle remoto pelo celular, um dedo agora rola o seu lado (a tela do dono) e dois dedos rolam a tela da pessoa — antes qualquer arrasto só rolava a tela dela.",
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "No celular, dá para rolar a tela da pessoa arrastando o dedo sobre o espelho (como a roda do mouse no computador), e há botões de rolar para cima e para baixo.",
      },
      {
        type: "correcao",
        text: "No controle remoto pelo celular, o teclado só abre quando você toca num campo de texto — antes abria até ao tocar em botões e textos.",
      },
      {
        type: "correcao",
        text: 'Ao tocar num campo que já tem texto, o campo de digitação começa com esse texto: dá para apagar o que já estava escrito, e há o botão "Limpar campo".',
      },
    ],
  },
  {
    version: "0.9.2",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: "No celular em pé, os botões do suporte ao vivo (como Encerrar) não passam mais da largura da tela: a barra de controles quebra de linha e o texto longo se ajusta.",
      },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-10-07",
    changes: [
      {
        type: "correcao",
        text: 'No celular, ao usar o controle remoto da tela de alguém, o teclado não aparece e some mais. Há um campo "Digitar na tela da pessoa": toque num campo na tela dela, digite ali e o texto vai para o campo (inclusive com correção automática de palavras).',
      },
      {
        type: "correcao",
        text: "Removido um aviso de erro no console causado por extensões do navegador que alteram a página antes de ela carregar.",
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: 'Na lista de pedidos de suporte, o responsável agora pode "Enviar mensagem" para a pessoa sem pedir a tela (a conversa abre na caixa dela), e "Encerrar" um pedido que não precisa mais.',
      },
      {
        type: "novo",
        text: 'Numa conversa por texto, dá para "Cancelar pedido de tela" se o responsável desistir de ver a tela da pessoa.',
      },
      {
        type: "melhoria",
        text: "Quando a pessoa escreve na conversa, o responsável é avisado em qualquer página do painel (som e aviso); o Telegram só é usado quando ele não está com o painel aberto.",
      },
      {
        type: "melhoria",
        text: "O painel confere sozinho se as respostas pelo Telegram estão apontando para o endereço certo e avisa quando não estão.",
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-10-07",
    changes: [
      {
        type: "novo",
        text: "Se você pedir suporte e ninguém estiver online, o responsável pode te responder pelo próprio Telegram e a resposta aparece na sua caixa de conversa. Quando você liberar a tela, a conversa continua na mesma caixa, sem trocar de lugar.",
      },
      {
        type: "melhoria",
        text: "O tempo de espera por atendimento agora é combinado com cada empresa, em vez de ser igual para todas.",
      },
      {
        type: "correcao",
        text: "As tarefas automáticas (como o backup diário) não são mais redirecionadas para a tela de login.",
      },
    ],
  },
  {
    version: "0.7.3",
    date: "2026-10-06",
    changes: [
      {
        type: "novo",
        text: "A caixa de conversa do suporte agora pode ser redimensionada: puxe o canto superior esquerdo ou o inferior direito (ou use as setas do teclado com o canto selecionado).",
      },
      {
        type: "novo",
        text: 'Em Administração, o botão "Enviar mensagem de teste" confirma se o aviso por Telegram está funcionando e explica o que falta quando não está.',
      },
    ],
  },
  {
    version: "0.7.2",
    date: "2026-10-06",
    changes: [
      {
        type: "novo",
        text: "Quando chega uma mensagem na conversa do suporte, toca um aviso sonoro (dá para silenciar no ícone de som), o título da aba pisca se você estiver em outra aba e, com a conversa recolhida, aparece o número de mensagens não lidas.",
      },
      {
        type: "melhoria",
        text: "A caixa de conversa do suporte também pode ser arrastada para qualquer lugar da tela e recolhida.",
      },
    ],
  },
  {
    version: "0.7.1",
    date: "2026-10-06",
    changes: [
      {
        type: "correcao",
        text: 'Na tela compartilhada com o suporte, o aviso de permissão não fica mais preso no espelho depois que você clica em Permitir. O suporte também ganhou o botão "Atualizar tela" para renovar a imagem se ela parecer travada.',
      },
      {
        type: "melhoria",
        text: "A caixa de conversa com o suporte agora pode ser arrastada para qualquer lugar da tela (com o mouse, o dedo ou as setas do teclado).",
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-10-06",
    changes: [
      {
        type: "novo",
        text: 'O "Chamar suporte" agora avisa na hora quando o suporte não está online, e o responsável pela plataforma é avisado para entrar em contato. Se houver alguém online, você vê uma contagem enquanto aguarda atendimento.',
      },
      {
        type: "novo",
        text: "Durante o atendimento, usuário e suporte conversam por uma caixa de texto ao lado da tela compartilhada.",
      },
      {
        type: "correcao",
        text: "Em empresas com vários usuários, o pedido de suporte e o acesso à tela passaram a valer só para a pessoa que pediu ajuda — antes apareciam para todos da empresa.",
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-10-06",
    changes: [
      {
        type: "melhoria",
        text: "Em empresas com vários usuários, o Backup passou a ser exclusivo do responsável pela conta, e liberar um módulo para alguém já libera os módulos de que ele depende (ex.: Pedidos libera Clientes).",
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-05",
    changes: [
      {
        type: "novo",
        text: 'Empresas com o modo "vários usuários" liberado ganham a tela Equipe (menu da sua conta): o responsável adiciona pessoas, define o setor de cada uma e escolhe quais módulos ela pode abrir.',
      },
      {
        type: "melhoria",
        text: "Quem é desativado na Equipe perde o acesso na hora, e o lugar dele fica livre para outra pessoa.",
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-10-01",
    changes: [
      {
        type: "melhoria",
        text: "A logo da empresa no topo do menu lateral ficou maior e mais fácil de ver.",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-09-30",
    changes: [
      {
        type: "novo",
        text: 'Em Perfil › "Dados da empresa", o responsável pela conta agora edita o nome que aparece nos documentos enviados ao cliente, além de CNPJ/CPF, telefone e endereço.',
      },
    ],
  },
  {
    version: "0.4.2",
    date: "2026-09-30",
    changes: [
      {
        type: "correcao",
        text: 'A janela "Enviar ao cliente" não passa mais do tamanho da tela: em telas pequenas ela rola por dentro e os botões ficam sempre dentro da janela.',
      },
    ],
  },
  {
    version: "0.4.1",
    date: "2026-09-30",
    changes: [
      {
        type: "melhoria",
        text: 'A janela "Enviar ao cliente" ficou mais clara, com botões nas cores do WhatsApp e do Telegram.',
      },
      {
        type: "novo",
        text: "A mensagem de envio agora é editável: toque nos botões (nome do cliente, número, valor, empresa) para inserir dados, veja a prévia e salve como seu texto padrão.",
      },
      {
        type: "correcao",
        text: "O link enviado ao cliente agora sai completo também quando o endereço do site não está configurado.",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-09-30",
    changes: [
      {
        type: "novo",
        text: 'Botão "Enviar ao cliente": gera um link seguro (válido por 30 dias) e um PDF do documento, e envia por WhatsApp, e-mail ou pelo compartilhamento do celular, com o PDF anexado.',
      },
      {
        type: "novo",
        text: "Em Perfil, opção avançada para configurar o e-mail da sua empresa e enviar documentos por e-mail com PDF anexo, direto pelo sistema.",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-28",
    changes: [
      {
        type: "novo",
        text: 'Em Perfil, a cor de destaque (botões) e a cor do menu lateral agora são dois controles separados, com botão "Restaurar cor padrão" e botão pra remover o logo enviado.',
      },
      {
        type: "novo",
        text: "Botão para mostrar/esconder a senha digitada, tanto no login quanto ao trocar a senha.",
      },
      {
        type: "novo",
        text: "O administrador da plataforma agora pode renomear uma organização depois de criada.",
      },
      {
        type: "novo",
        text: "O ícone na aba do navegador e a imagem que aparece ao compartilhar o link agora mostram a marca do sistema.",
      },
      {
        type: "correcao",
        text: "Ao apagar definitivamente uma organização, a conta de acesso de cada pessoa dela também é removida agora — antes só os dados ficavam apagados.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-28",
    changes: [
      {
        type: "novo",
        text: "Quem entra pela primeira vez com uma senha provisória (criada pelo administrador) agora é obrigado a trocar a senha antes de acessar qualquer tela. Se esquecer a senha depois, o administrador pode gerar uma nova senha provisória a qualquer momento, sem apagar nada do que já foi cadastrado.",
      },
      {
        type: "novo",
        text: "Chegou o menu Perfil (clique no seu nome, no canto superior direito): dá pra trocar o nome de exibição, o tema claro/escuro e a senha. Quem é dono da organização também escolhe ali a cor e o logo que aparecem pra toda a equipe.",
      },
      {
        type: "correcao",
        text: 'Na área do administrador, a lista de "Pessoas com acesso" de cada organização e o histórico de ações mostravam só um código longo (o identificador interno da conta). Agora mostram o nome da pessoa junto com esse código.',
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-24",
    changes: [
      {
        type: "novo",
        text: "Primeira versão do template: login, painel administrativo da plataforma, suporte ao vivo e notificações.",
      },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
