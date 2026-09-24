"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MouseInteractions, Replayer, ReplayerEvents } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
// A classe crua `Replayer` (diferente do pacote `rrweb-player`) não injeta
// seu próprio CSS. Sem isso, o cursor do rrweb (`.replayer-mouse`) e o
// canvas do rastro do mouse (`.replayer-mouse-tail`) ficam sem
// `position: absolute` e empilham em fluxo normal ACIMA do iframe — cada
// um do tamanho da tela gravada (ex.: 720px) — empurrando o conteúdo real
// para fora da janela visível. Era a causa do "só aparece fundo cinza".
import "rrweb/dist/style.css";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/core/logger";
import { getRealtimeChannel, liveSessionChannelName } from "../realtime";
import { endLiveSession, getFullSnapshot } from "../actions";

// `target` de um evento "mouse-interaction" do Replayer vem do
// `contentDocument` do iframe — outro realm de JS, com seu próprio
// `HTMLElement`. `instanceof HTMLElement` (a classe do realm de FORA)
// sempre dá falso mesmo pra um elemento real; checar "por pato" (tem
// `.style`?) funciona em qualquer realm.
interface StyledElement {
  style: CSSStyleDeclaration;
}
function isStyledElement(value: unknown): value is StyledElement {
  return (
    typeof value === "object" &&
    value !== null &&
    "style" in value &&
    typeof (value as { style?: unknown }).style === "object"
  );
}

function clearHighlight(el: StyledElement) {
  el.style.removeProperty("outline");
  el.style.removeProperty("outline-offset");
  el.style.removeProperty("background-color");
  el.style.removeProperty("box-shadow");
}

/**
 * Player ao vivo do lado do admin: espelha a tela do app do usuário
 * (rrweb) e, quando `controlGranted`, envia os movimentos/cliques/teclas
 * do admin de volta como eventos de controle remoto (ver
 * apply-control-event.ts do lado de quem recebe). O admin nunca controla
 * sem o usuário ter concedido explicitamente — esse estado só chega aqui
 * via broadcast, nunca é decidido neste componente.
 */
export function LiveSessionViewer({
  sessionId,
  initialStatus,
  initialControlGranted,
  onEnded,
}: {
  sessionId: string;
  initialStatus: "pending" | "active";
  initialControlGranted: boolean;
  onEnded: () => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [controlGranted, setControlGranted] = useState(initialControlGranted);
  const [connectionError, setConnectionError] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const replayerRootRef = useRef<HTMLDivElement | null>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const channelRef = useRef<ReturnType<typeof getRealtimeChannel> | null>(null);
  const controlGrantedRef = useRef(controlGranted);
  const hoveringRef = useRef(false);
  // Incrementais que chegam antes do instantâneo completo (buscado via
  // Server Action, não pelo Broadcast — ver getFullSnapshot) ficam aqui
  // até o Replayer existir, pra não se perder.
  const pendingEventsRef = useRef<eventWithTime[]>([]);
  // O instantâneo pode chegar da Server Action antes do container do
  // espelho existir no DOM (só é renderizado quando status === "active",
  // e um `setStatus` dentro de um handler de broadcast não atualiza o
  // DOM na hora — só depois do próximo efeito). Guarda aqui pra tentar
  // de novo assim que o container aparecer.
  const fetchedSnapshotRef = useRef<{ meta: eventWithTime | null; snapshot: eventWithTime } | null>(
    null,
  );
  const tryCreateReplayerRef = useRef<() => void>(() => {});
  // Elemento marcado como "focado" no espelho — ver comentário no listener
  // de "mouse-interaction" abaixo (por que precisa disso em vez do
  // `:focus` nativo).
  const highlightedElementRef = useRef<StyledElement | null>(null);

  useEffect(() => {
    controlGrantedRef.current = controlGranted;
  }, [controlGranted]);

  useEffect(() => {
    const channel = getRealtimeChannel(liveSessionChannelName(sessionId));
    channelRef.current = channel;

    function tryCreateReplayer() {
      if (replayerRef.current || !replayerRootRef.current || !fetchedSnapshotRef.current) return;
      // O instantâneo entra pelo mesmo `.addEvent()` usado por tudo mais
      // (nunca pelo array do construtor) — passá-lo no construtor faz o
      // Replayer processá-lo por um caminho interno próprio, que não
      // necessariamente termina de forma síncrona antes dos incrementais
      // em fila serem aplicados logo em seguida, causando "Node not
      // found" nos primeiros eventos mesmo com tudo correto.
      replayerRef.current = new Replayer([], {
        root: replayerRootRef.current,
        liveMode: true,
        UNSAFE_replayCanvas: true,
        // `useVirtualDom` (default true no rrweb) só ativa quando um
        // evento é tratado como "isSync" — o que, com o baselineTime lá
        // embaixo, é SEMPRE aqui. Ligado, cada mutação vai pra uma
        // representação virtual (otimização pra avanço rápido em
        // playback normal) e só volta pro DOM real quando o replayer sai
        // do modo "sync" — o que nunca acontece no nosso caso (é sempre
        // "sync" de propósito). Sem desligar isto, toda mutação depois
        // do instantâneo inicial "aplica com sucesso" (sem erro nenhum)
        // mas nunca aparece na tela — era a causa real do espelho travar
        // depois da primeira mutação incremental que chegasse.
        useVirtualDom: false,
      });
      // `startLive()` sem argumento usa `Date.now()` como "baselineTime":
      // eventos com timestamp anterior a isso (o instantâneo inicial e o
      // que estiver em fila) contam como "isSync" e aplicam na hora;
      // eventos "no futuro" relativo a esse instante (a imensa maioria,
      // já que a sessão continua depois da conexão) agendam via timer,
      // mas com um atraso ≈ tempo real decorrido — na prática quase
      // instantâneo pra quem chega ao vivo. Cheguei a forçar um
      // `baselineTime` no futuro pra fazer TUDO contar como "isSync" (um
      // desvio que resolvia o espelho travar, mas por engano: isSync
      // também é o gatilho do `useVirtualDom` — ver acima — e além disso
      // o rastro do MOUSE só atualiza visualmente no caminho "não
      // síncrono" (`applyIncremental`/`MouseMove`); forçar isSync deixava
      // o cursor do usuário parado num canto pra sempre). Com
      // `useVirtualDom: false` já resolvendo a causa de verdade, não
      // precisa mais mexer no baselineTime — o padrão está certo.
      replayerRef.current.startLive();
      // O espelho não mostra o cursor de texto piscando de verdade — o
      // rrweb até chama `.focus()` no elemento certo dentro do iframe,
      // mas isso também foca o `<iframe>` do ponto de vista do admin, e
      // o polling que desfoca o iframe (pra ele não roubar o teclado do
      // admin, ver useEffect mais abaixo) cancela esse foco junto. Em
      // vez de brigar com isso, desenha um contorno visível no campo
      // focado à mão — dá pra ver ONDE a organização está digitando,
      // mesmo sem o cursor piscando nativo.
      replayerRef.current.on(ReplayerEvents.MouseInteraction, (payload) => {
        const { type, target } = payload as { type: MouseInteractions; target: unknown };
        // `target` vem do `contentDocument` do iframe — outro realm de
        // JS, com seu próprio `HTMLElement`. `target instanceof
        // HTMLElement` (usando a classe do realm de FORA) sempre dá
        // falso mesmo pra um elemento real — precisa checar "por pato"
        // (tem `.style`?), não por classe.
        if (!isStyledElement(target)) return;
        if (type === MouseInteractions.Focus) {
          if (highlightedElementRef.current && highlightedElementRef.current !== target) {
            clearHighlight(highlightedElementRef.current);
          }
          // `outline` sozinho pode ser cortado por um ancestral com
          // `overflow: hidden` em alguns layouts — soma um
          // `background-color` e `box-shadow` também, bem mais difícil
          // de "sumir" em qualquer contexto. `!important` porque alguns
          // campos (ex.: inputs do shadcn/ui) já têm `background` e
          // `box-shadow` próprios via classe, que ganhariam de um style
          // inline comum por causa de `:focus`/variantes mais
          // específicas.
          target.style.setProperty("outline", "2px solid #3b82f6", "important");
          target.style.setProperty("outline-offset", "1px", "important");
          target.style.setProperty("background-color", "#dbeafe", "important");
          target.style.setProperty(
            "box-shadow",
            "0 0 0 2px #3b82f6, 0 0 0 4px #93c5fd",
            "important",
          );
          highlightedElementRef.current = target;
        } else if (type === MouseInteractions.Blur && target === highlightedElementRef.current) {
          clearHighlight(target);
          highlightedElementRef.current = null;
        }
      });
      // O Meta entra ANTES do FullSnapshot — é ele que revela o iframe
      // (o rrweb cria o iframe do Replayer com `display: none` por
      // padrão e só troca pra `inherit` ao aplicar um Meta, que também
      // carrega a largura/altura da tela gravada). Sem isso, o conteúdo
      // renderiza dentro do iframe mas ele continua invisível.
      if (fetchedSnapshotRef.current.meta) {
        replayerRef.current.addEvent(fetchedSnapshotRef.current.meta);
      }
      replayerRef.current.addEvent(fetchedSnapshotRef.current.snapshot);
      // Os incrementais que chegaram (pelo Broadcast, ao vivo) ANTES do
      // instantâneo ter sido buscado no banco são DESCARTADOS, não
      // aplicados — são duas corridas independentes (o polling no banco
      // vs. a inscrição no canal), então um incremental em fila pode ser
      // cronologicamente mais antigo que o instantâneo que acabou de ser
      // aplicado. Aplicar uma mutação velha por cima de um instantâneo
      // mais novo referencia nós que o instantâneo já mudou/removeu —
      // corrompe o espelho pro resto da sessão (nós órfãos que nunca são
      // limpos, mutações seguintes batendo no nó errado), mesmo sem
      // lançar nenhum erro visível depois. Perder essas poucas mutações
      // do primeiro segundo é bem mais barato que isso.
      pendingEventsRef.current = [];
      setHasFrame(true);
    }
    tryCreateReplayerRef.current = tryCreateReplayer;

    // O instantâneo completo (o DOM inteiro da tela gravada) não passa
    // pelo Broadcast — é grande demais (200KB+), o Realtime aceita o
    // envio mas descarta silenciosamente acima do limite de tamanho de
    // mensagem. Em vez disso, o admin busca sob demanda aqui. Precisa
    // ser um polling, não uma tentativa única: existe uma corrida real
    // entre a sessão virar "active" e o lado do usuário terminar de
    // iniciar a gravação e salvar o primeiro instantâneo (150-350ms na
    // prática) — uma busca isolada nesse meio-tempo não acha nada e,
    // sem repetir, o espelho nunca mais tenta de novo.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 40; // ~30s
    async function pollSnapshot() {
      if (replayerRef.current) return;
      const result = await getFullSnapshot(sessionId);
      if (result.ok && result.snapshot) {
        fetchedSnapshotRef.current = result.snapshot as {
          meta: eventWithTime | null;
          snapshot: eventWithTime;
        };
        tryCreateReplayer();
        return;
      }
      pollAttempts += 1;
      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        logger.error("live_support.snapshot_nao_chegou", { sessionId, pollAttempts });
        setConnectionError(true);
        return;
      }
      if (!replayerRef.current) {
        pollTimer = setTimeout(() => void pollSnapshot(), 700);
      }
    }
    void pollSnapshot();

    channel
      .on("broadcast", { event: "status" }, ({ payload }) => {
        const next = payload.status as string;
        if (next === "ended" || next === "declined") {
          onEnded();
        } else if (next === "active") {
          setStatus("active");
        }
      })
      .on("broadcast", { event: "control" }, ({ payload }) => {
        setControlGranted(Boolean(payload.granted));
      })
      .on("broadcast", { event: "rrweb" }, ({ payload }) => {
        const event = payload as eventWithTime;
        if (!replayerRef.current) {
          pendingEventsRef.current.push(event);
          return;
        }
        replayerRef.current.addEvent(event);
      })
      .subscribe((subscribeStatus, err) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setConnectionError(false);
        } else if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
          logger.error("live_support.canal_falhou", { sessionId, subscribeStatus, err });
          setConnectionError(true);
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      pendingEventsRef.current = [];
      if (pollTimer) clearTimeout(pollTimer);
      replayerRef.current?.destroy();
      replayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEnded é estável o bastante aqui (não recriamos o canal por causa dela)
  }, [sessionId]);

  // O container do espelho só existe no DOM quando status === "active"
  // (ver JSX abaixo) — se o instantâneo já tiver sido buscado antes
  // disso (pedido do admin, sessão ainda "pending"), tenta criar o
  // Replayer de novo agora que o container acabou de ser montado.
  useEffect(() => {
    if (status === "active") tryCreateReplayerRef.current();
  }, [status]);

  // Assim que o primeiro quadro chega, descobre o tamanho real da tela
  // gravada (o `<iframe>` que o Replayer cria usa esse tamanho nos
  // atributos width/height) e já ajusta o zoom pra caber tudo de largura
  // no espelho, sem cortar nada — "caber tudo nela" por padrão, com os
  // botões de zoom pra ajustar depois.
  useEffect(() => {
    if (!hasFrame) return;
    const iframe = containerRef.current?.querySelector("iframe");
    const width = Number(iframe?.getAttribute("width"));
    const height = Number(iframe?.getAttribute("height"));
    if (!width || !height) return;
    setNaturalSize({ width, height });
    const availableWidth = containerRef.current?.clientWidth ?? width;
    setZoom(Math.min(1, availableWidth / width));
  }, [hasFrame]);

  // Reaproveita o MESMO canal já inscrito (não cria um novo a cada envio —
  // um canal novo por evento, em sequência rápida como digitação, se
  // perde: o REST do Realtime não segura fila/ordem entre canais
  // efêmeros distintos).
  function sendControl(payload: object) {
    if (!controlGrantedRef.current || !channelRef.current) return;
    void channelRef.current.send({ type: "broadcast", event: "control-input", payload });
  }

  /**
   * O `Replayer` (a classe crua, sem o `rrweb-player`) NÃO escala o
   * iframe para caber no container — ele renderiza no tamanho real da
   * tela gravada. Por isso a fração de clique tem que ser calculada em
   * cima do próprio `<iframe>` (que corresponde 1:1 à página do
   * usuário), nunca do nosso `containerRef` (que só recorta/mostra uma
   * janela por cima dele via `overflow-hidden`).
   */
  function getIframeRect(): DOMRect | null {
    return containerRef.current?.querySelector("iframe")?.getBoundingClientRect() ?? null;
  }

  const lastMoveSentAtRef = useRef(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Throttle: mousemove dispara a cada pixel — sem isso, cada
    // movimento vira uma rajada de chamadas REST ao Realtime.
    const now = Date.now();
    if (now - lastMoveSentAtRef.current < 50) return;
    lastMoveSentAtRef.current = now;

    const rect = getIframeRect();
    if (!rect) return;
    sendControl({
      type: "move",
      xFrac: (e.clientX - rect.left) / rect.width,
      yFrac: (e.clientY - rect.top) / rect.height,
    });
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = getIframeRect();
    if (!rect) return;
    sendControl({
      type: "click",
      xFrac: (e.clientX - rect.left) / rect.width,
      yFrac: (e.clientY - rect.top) / rect.height,
    });
  }

  // A rolagem do mouse sobre o espelho, com controle concedido, rola a
  // página REAL do usuário (não o nosso container) — sem isso não tinha
  // como ver o que está fora da primeira tela sem pedir pro usuário
  // rolar. Precisa ser um listener NATIVO com `passive: false`: o React
  // anexa `onWheel` como passivo na raiz por padrão (otimização de
  // scroll), então `e.preventDefault()` num handler JSX normal não
  // bloqueia o scroll do navegador — sem isso, o container local rolaria
  // JUNTO com a página remota, confundindo os dois.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || status !== "active") return;
    function handleWheel(e: WheelEvent) {
      if (!controlGrantedRef.current) return;
      e.preventDefault();
      sendControl({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [status]);

  // O rrweb, ao repetir o evento de foco que ele mesmo gravou no usuário,
  // foca o iframe de replay por baixo dos panos — um iframe é outro
  // contexto de navegação, então o teclado dali NUNCA borbulha até o
  // `window` desta página (e o foco entrando num iframe nem sempre
  // dispara um evento `focus` capturável no documento pai, então um
  // listener de evento não é confiável aqui — só um polling curto é).
  // Sem isso, nenhum keydown chegaria no listener abaixo depois da
  // primeira vez que algo for focado do lado do usuário.
  useEffect(() => {
    if (status !== "active") return;

    const interval = setInterval(() => {
      if (document.activeElement instanceof HTMLIFrameElement) {
        document.activeElement.blur();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  // Captura o teclado em `window`, não no foco do container — pelo mesmo
  // motivo acima, nunca dá pra depender de um elemento específico ter
  // foco. Só encaminha teclas enquanto o mouse do admin está sobre o
  // espelho (`hoveringRef`).
  useEffect(() => {
    if (status !== "active") return;

    function handleWindowKeyDown(e: KeyboardEvent) {
      if (!hoveringRef.current || !controlGrantedRef.current) return;
      if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
        e.preventDefault();
        sendControl({ type: "key", key: e.key });
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [status, sessionId]);

  function handleEnd() {
    startTransition(async () => {
      await endLiveSession(sessionId);
      onEnded();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={status === "active" ? "secondary" : "outline"}>
          {status === "active" ? "Ao vivo" : "Aguardando aprovação da organização..."}
        </Badge>
        {controlGranted && <Badge>Controle remoto concedido</Badge>}
        {connectionError && (
          <Badge variant="destructive">Erro de conexão em tempo real — recarregue a página</Badge>
        )}
        {status === "active" && hasFrame && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              title="Diminuir zoom"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground w-12 text-center text-xs">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              title="Aumentar zoom"
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              title="Ajustar para caber"
              onClick={() => {
                if (naturalSize && containerRef.current) {
                  setZoom(Math.min(1, containerRef.current.clientWidth / naturalSize.width));
                }
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button variant="destructive" size="sm" onClick={handleEnd} disabled={isPending}>
          <X className="h-4 w-4" />
          Encerrar sessão
        </Button>
      </div>

      {/* pointer-events-none no iframe: um iframe é um contexto de
          navegação à parte — sem isso, o mouse "aterrissa" nele e os
          handlers deste div nunca disparam. O iframe continua 100%
          visível, só para de roubar o clique/mousemove.
          overflow-auto: o `Replayer` cru não escala a página pra caber —
          o zoom aqui é nosso, via CSS transform num wrapper dimensionado
          pro tamanho já escalado, então o scroll do container acompanha
          corretamente o zoom aplicado. */}
      {status === "active" && (
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => {
            hoveringRef.current = true;
          }}
          onMouseLeave={() => {
            hoveringRef.current = false;
          }}
          onClick={handleClick}
          className="bg-muted relative h-[75vh] w-full overflow-auto rounded-lg border [&_iframe]:pointer-events-none"
        >
          {!hasFrame && !connectionError && (
            <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
              Aguardando o primeiro quadro da tela da organização...
            </p>
          )}
          {/* A mesma estrutura de divs sempre — nunca troca de acordo
              com `naturalSize`/`zoom`, só o `style` muda. O Replayer
              guarda uma referência direta pro nó de `replayerRootRef` e
              insere seu wrapper como filho dele; se essa div fosse
              desmontada/trocada por outra (ex.: só aparecendo depois que
              `naturalSize` existisse), o wrapper viveria dentro de um nó
              já removido do DOM. */}
          <div
            style={
              naturalSize
                ? { width: naturalSize.width * zoom, height: naturalSize.height * zoom }
                : undefined
            }
          >
            <div
              ref={replayerRootRef}
              style={
                naturalSize
                  ? {
                      width: naturalSize.width,
                      height: naturalSize.height,
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
      {controlGranted && (
        <p className="text-muted-foreground text-xs">
          Passe o mouse sobre o espelho para usar o controle remoto (mouse e teclado).
        </p>
      )}
    </div>
  );
}
