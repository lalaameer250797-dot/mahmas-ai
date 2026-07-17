import { useState, useRef, useEffect, useCallback } from 'react';
import { Message } from '../types';

interface VoiceAssistantProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onSendAudio: (base64: string, mimeType: string) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';
}

export function VoiceAssistant({ messages, isLoading, onSendMessage, onSendAudio }: VoiceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const base64 = await blobToBase64(blob);
          onSendAudio(base64, mimeType.split(';')[0]);
        }
        setIsRecording(false);
        setSeconds(0);
      };

      recorder.start(100);
      mediaRef.current = recorder;
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      alert('לא ניתן לגשת למיקרופון. אפשר הרשאה בדפדפן.');
    }
  }, [onSendAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleClose = useCallback(() => {
    stopRecording();
    setOpen(false);
    setText('');
  }, [stopRecording]);

  const handleSendText = useCallback(() => {
    const t = text.trim();
    if (!t || isLoading) return;
    onSendMessage(t);
    setText('');
  }, [text, isLoading, onSendMessage]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, open]);

  useEffect(() => () => { stopRecording(); }, [stopRecording]);

  const recentMessages = messages.filter(m => !m.skipFromHistory || m.id === 'welcome').slice(-6);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
          aria-label="פתח עוזר קולי"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h2v-2.07A7.002 7.002 0 0 0 19 12h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6 6.93z" />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-4 sm:left-4 z-40 sm:w-96 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          dir="rtl"
          style={{ height: '75vh', maxHeight: '600px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-l from-blue-700 to-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="font-bold text-sm">עוזר קולי</p>
                <p className="text-blue-100 text-[10px]">לחץ על המיקרופון ודבר</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">×</button>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {recentMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-end">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full dot-1" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full dot-2" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full dot-3" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0 space-y-2">
            {/* Mic button — big, centre-stage */}
            <div className="flex justify-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all shadow-lg disabled:opacity-50 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-red-200 scale-110 mic-active'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  {isRecording
                    ? <rect x="6" y="6" width="12" height="12" rx="2" />
                    : <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h2v-2.07A7.002 7.002 0 0 0 19 12h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6 6.93z" />
                  }
                </svg>
                {isRecording && <span className="text-[10px] font-bold">{fmtTime(seconds)}</span>}
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-400">
              {isRecording ? 'מקליט... לחץ שוב לשליחה' : isLoading ? 'מעבד...' : 'לחץ להקלטה'}
            </p>

            {/* Text fallback */}
            <div className="flex gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                placeholder="או הקלד כאן..."
                className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
                rows={1}
                dir="rtl"
                disabled={isLoading || isRecording}
                style={{ minHeight: '38px', maxHeight: '70px' }}
              />
              <button
                onClick={handleSendText}
                disabled={!text.trim() || isLoading || isRecording}
                className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
