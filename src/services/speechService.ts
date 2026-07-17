export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

type TranscriptCallback = (transcript: string, isFinal: boolean) => void;
type StateCallback = (state: SpeechState) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

class SpeechService {
  private recognition: AnyRecognition = null;
  private _isListening = false;

  isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  startListening(onTranscript: TranscriptCallback, onStateChange: StateCallback): void {
    if (!this.isSupported()) {
      onStateChange('error');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = 'he-IL';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this._isListening = true;
      onStateChange('listening');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript = event.results[i][0].transcript;
        isFinal = event.results[i].isFinal;
      }
      onTranscript(transcript, isFinal);
    };

    this.recognition.onend = () => {
      this._isListening = false;
      onStateChange('idle');
    };

    this.recognition.onerror = () => {
      this._isListening = false;
      onStateChange('error');
    };

    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition && this._isListening) {
      this.recognition.stop();
    }
  }

  // Future TTS support — architecture ready for voice responses
  speak(text: string): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'he-IL';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      const hebrewVoice = window.speechSynthesis
        .getVoices()
        .find(v => v.lang.startsWith('he'));
      if (hebrewVoice) utterance.voice = hebrewVoice;
      window.speechSynthesis.speak(utterance);
    }
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
