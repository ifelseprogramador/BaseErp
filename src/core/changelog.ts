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
