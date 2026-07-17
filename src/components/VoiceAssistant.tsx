import { useState, useRef, useEffect } from 'react';
import { speechService } from '../services/speechService';
import { Message } from '../types';

interface VoiceAssistantProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
}

export function VoiceAssistant({ messages, isLoading, onSendMessage }: VoiceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const startListening = () => {
    if (!speechService.isSupported()) {
      setIsError(true);
      setErrorMessage('הדפדפן שלך אינו תומך בזיהוי קולי. השתמש ב-Chrome או Edge.');
      return;
    }
    setEditedText('');
    setIsError(false);
    setErrorMessage('');
    setIsListening(true);

    speechService.startListening(
      (text, isFinal) => {
        setEditedText(text);
        if (isFinal) setIsListening(false);
      },
      (state) => {
        if (state === 'idle') setIsListening(false);
        if (state === 'error') {
          setIsListening(false);
          setIsError(true);
          setErrorMessage('לא הצלחתי לזהות דיבור. נסה שוב או הקלד את הפקודה.');
        }
      }
    );
  };

  const stopListening = () => {
    speechService.stopListening();
    setIsListening(false);
  };

  const handleSend = () => {
    const text = editedText.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setEditedText('');
  };

  const handleClose = () => {
    speechService.stopListening();
    setIsListening(false);
    setOpen(false);
    setEditedText('');
    setIsError(false);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, open]);

  // Show only recent conversation (last 6 messages)
  const recentMessages = messages.filter(m => !m.skipFromHistory || m.id === 'welcome').slice(-6);

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
          aria-label="פתח עוזר קולי"
          dir="rtl"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h2v-2.07A7.002 7.002 0 0 0 19 12h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6 6.93z" />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute bottom-full mb-2 right-0 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            דבר איתי 🎙️
          </div>
        </button>
      )}

      {/* Assistant Panel — full sheet on mobile, floating panel on desktop */}
      {open && (
        <div
          className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-4 sm:left-4 z-40 sm:w-96 sm:max-w-[calc(100vw-2rem)] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
          dir="rtl"
          style={{ height: '75vh', maxHeight: '600px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-l from-blue-700 to-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="font-bold text-sm">עוזר קולי</p>
                <p className="text-blue-100 text-[10px]">דבר או הקלד — עברית</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="סגור"
            >×</button>
          </div>

          {/* Conversation area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {recentMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                  }`}
                >
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

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
            {isError && (
              <p className="text-xs text-red-500 mb-2 bg-red-50 px-2 py-1 rounded-lg text-center">
                {errorMessage}
              </p>
            )}

            <div className="flex items-end gap-2">
              {/* Mic button */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                  isListening
                    ? 'bg-red-500 text-white mic-active shadow-lg shadow-red-200'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                } disabled:opacity-50`}
                aria-label={isListening ? 'עצור הקלטה' : 'התחל הקלטה'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  {isListening ? (
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  ) : (
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h2v-2.07A7.002 7.002 0 0 0 19 12h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6 6.93z" />
                  )}
                </svg>
              </button>

              {/* Text input */}
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? 'מאזין... דבר עכשיו' : 'הקלד או לחץ על מיקרופון...'}
                className="flex-1 border border-gray-300 bg-gray-50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-colors"
                rows={1}
                dir="rtl"
                disabled={isLoading}
                style={{ minHeight: '42px', maxHeight: '80px' }}
              />

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={!editedText.trim() || isLoading}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                aria-label="שלח"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
