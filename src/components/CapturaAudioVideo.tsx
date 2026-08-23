import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { OrigemCaptura } from '@/types/database';
import { Mic, Video, MonitorUp, Square, AlertCircle } from 'lucide-react';

interface Props {
  modo: Extract<OrigemCaptura, 'presencial' | 'presencial_video' | 'navegador_aba' | 'navegador_aba_video'>;
  onGravado: (arquivo: Blob, nomeArquivo: string) => void;
  onLimpar: () => void;
  gravacaoPronta: boolean;
}

const MODO_INFO: Record<Props['modo'], { icone: typeof Mic; titulo: string; ajuda: string }> = {
  presencial: {
    icone: Mic,
    titulo: 'Gravação presencial (áudio)',
    ajuda: 'Usa o microfone deste dispositivo. Ideal para reuniões com várias pessoas na mesma sala.',
  },
  presencial_video: {
    icone: Video,
    titulo: 'Gravação presencial (áudio e vídeo)',
    ajuda: 'Usa a câmera e o microfone deste dispositivo.',
  },
  navegador_aba: {
    icone: MonitorUp,
    titulo: 'Captura de aba/janela (Meet, Zoom, Teams...)',
    ajuda: 'O navegador vai pedir para você escolher a aba ou janela da reunião — marque a opção "Compartilhar áudio da aba".',
  },
  navegador_aba_video: {
    icone: MonitorUp,
    titulo: 'Captura de aba/janela com vídeo (Meet, Zoom, Teams...)',
    ajuda: 'O navegador vai pedir para você escolher a aba ou janela da reunião — marque a opção "Compartilhar áudio da aba".',
  },
};

/**
 * Grava áudio/vídeo diretamente no navegador (microfone/câmera do dispositivo, ou
 * uma aba/janela compartilhada — usada para capturar reuniões do Google Meet, Zoom,
 * Teams etc. quando a própria reunião roda no navegador do usuário).
 *
 * PRINCÍPIO ARQUITETURAL INEGOCIÁVEL: a gravação fica só na memória do navegador
 * enquanto o usuário revisa; ao confirmar o envio, ela vai direto para o provedor de
 * transcrição — nunca é salva em disco/armazenamento neste sistema.
 */
export function CapturaAudioVideo({ modo, onGravado, onLimpar, gravacaoPronta }: Props) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);

  const info = MODO_INFO[modo];

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  async function iniciar() {
    setErro(null);
    try {
      let stream: MediaStream;
      if (modo === 'presencial') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (modo === 'presencial_video') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } else {
        // navegador_aba / navegador_aba_video — captura de aba/janela/tela
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: modo === 'navegador_aba_video',
        });
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error(
            'Nenhum áudio foi compartilhado. Ao selecionar a aba/janela, marque a opção "Compartilhar áudio da aba" antes de confirmar.',
          );
        }
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extensao = blob.type.includes('video') ? 'webm' : 'webm';
        onGravado(blob, `gravacao-${modo}-${Date.now()}.${extensao}`);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;

      setGravando(true);
      setSegundos(0);
      intervalRef.current = window.setInterval(() => setSegundos((s) => s + 1), 1000);

      // Se o usuário parar o compartilhamento pela UI do navegador, encerra a gravação também.
      stream.getVideoTracks()[0]?.addEventListener('ended', pararGravacao);
      stream.getAudioTracks()[0]?.addEventListener('ended', pararGravacao);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível acessar microfone/câmera/tela. Verifique as permissões do navegador.',
      );
    }
  }

  function pararGravacao() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setGravando(false);
  }

  function refazer() {
    onLimpar();
    setSegundos(0);
  }

  const minutos = String(Math.floor(segundos / 60)).padStart(2, '0');
  const segs = String(segundos % 60).padStart(2, '0');

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        <info.icone className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-800">{info.titulo}</p>
          <p className="text-xs text-slate-500 mt-0.5">{info.ajuda}</p>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {gravacaoPronta ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-teal-700 font-medium">✓ Gravação concluída ({minutos}:{segs})</p>
          <Button type="button" variant="outline" size="sm" onClick={refazer}>
            Regravar
          </Button>
        </div>
      ) : gravando ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-slate-700">{minutos}:{segs}</span>
          </div>
          <Button type="button" variant="danger" size="sm" onClick={pararGravacao}>
            <Square className="w-3.5 h-3.5" />
            Parar gravação
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={iniciar}>
          <info.icone className="w-3.5 h-3.5" />
          Iniciar gravação
        </Button>
      )}
    </div>
  );
}
