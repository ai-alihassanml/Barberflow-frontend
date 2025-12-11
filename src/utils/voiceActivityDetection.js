/**
 * Voice Activity Detection (VAD) utility for real-time speech detection
 * Uses Web Audio API to analyze audio levels and detect speech patterns
 */

class VoiceActivityDetection {
  constructor(options = {}) {
    // Configuration options
    this.config = {
      silenceThreshold: options.silenceThreshold || 30, // dB level for silence detection
      speechTimeout: options.speechTimeout || 1500, // ms to wait after speech stops
      minSpeechDuration: options.minSpeechDuration || 500, // minimum speech duration to process
      maxSpeechDuration: options.maxSpeechDuration || 30000, // maximum continuous speech duration
      sampleRate: options.sampleRate || 16000, // audio sample rate
      fftSize: options.fftSize || 2048, // FFT size for frequency analysis
      smoothingTimeConstant: options.smoothingTimeConstant || 0.8, // audio analysis smoothing
    };

    // State variables
    this.isActive = false;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.lastSpeechTime = null;
    this.silenceStartTime = null;
    
    // Audio context and nodes
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.animationFrame = null;
    
    // Event callbacks
    this.callbacks = {
      onSpeechStart: options.onSpeechStart || (() => {}),
      onSpeechEnd: options.onSpeechEnd || (() => {}),
      onVolumeChange: options.onVolumeChange || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Initialize voice activity detection with audio stream
   * @param {MediaStream} stream - Audio stream from getUserMedia
   * @returns {Promise<void>}
   */
  async initialize(stream) {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.config.sampleRate,
      });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      // Initialize data array for frequency analysis
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      console.log('Voice Activity Detection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Voice Activity Detection:', error);
      this.callbacks.onError(error);
      throw error;
    }
  }

  /**
   * Start voice activity detection
   */
  start() {
    if (!this.audioContext || !this.analyser) {
      throw new Error('VAD not initialized. Call initialize() first.');
    }

    this.isActive = true;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.lastSpeechTime = null;
    this.silenceStartTime = null;

    // Start audio analysis loop
    this.analyzeAudio();
    
    console.log('Voice Activity Detection started');
  }

  /**
   * Stop voice activity detection
   */
  stop() {
    this.isActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // If currently speaking, trigger speech end
    if (this.isSpeaking) {
      this.handleSpeechEnd();
    }

    console.log('Voice Activity Detection stopped');
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.dataArray = null;
    console.log('Voice Activity Detection destroyed');
  }

  /**
   * Main audio analysis loop
   */
  analyzeAudio() {
    if (!this.isActive) return;

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate volume level
    const volume = this.calculateVolume();
    
    // Notify volume change
    this.callbacks.onVolumeChange(volume);

    // Determine if speech is detected
    const isSpeechDetected = volume > this.config.silenceThreshold;
    const currentTime = Date.now();

    if (isSpeechDetected) {
      this.handleSpeechDetected(currentTime);
    } else {
      this.handleSilenceDetected(currentTime);
    }

    // Continue analysis loop
    this.animationFrame = requestAnimationFrame(() => this.analyzeAudio());
  }

  /**
   * Calculate volume level from frequency data
   * @returns {number} Volume level (0-100)
   */
  calculateVolume() {
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    
    // Calculate average and normalize to 0-100 scale
    const average = sum / this.dataArray.length;
    return Math.min(100, (average / 255) * 100);
  }

  /**
   * Handle speech detection
   * @param {number} currentTime - Current timestamp
   */
  handleSpeechDetected(currentTime) {
    this.lastSpeechTime = currentTime;
    this.silenceStartTime = null;

    // Check if this is the start of speech
    if (!this.isSpeaking) {
      this.speechStartTime = currentTime;
      this.isSpeaking = true;
      this.callbacks.onSpeechStart();
      console.log('Speech started');
    }

    // Check for maximum speech duration
    const speechDuration = currentTime - this.speechStartTime;
    if (speechDuration > this.config.maxSpeechDuration) {
      console.log('Maximum speech duration reached, forcing speech end');
      this.handleSpeechEnd();
    }
  }

  /**
   * Handle silence detection
   * @param {number} currentTime - Current timestamp
   */
  handleSilenceDetected(currentTime) {
    if (this.isSpeaking) {
      // Start silence timer if not already started
      if (!this.silenceStartTime) {
        this.silenceStartTime = currentTime;
      }

      // Check if silence duration exceeds threshold
      const silenceDuration = currentTime - this.silenceStartTime;
      if (silenceDuration > this.config.speechTimeout) {
        // Check minimum speech duration before ending
        const speechDuration = this.silenceStartTime - this.speechStartTime;
        if (speechDuration >= this.config.minSpeechDuration) {
          this.handleSpeechEnd();
        } else {
          // Speech was too short, ignore it
          console.log('Speech too short, ignoring');
          this.isSpeaking = false;
          this.speechStartTime = null;
          this.silenceStartTime = null;
        }
      }
    }
  }

  /**
   * Handle end of speech
   */
  handleSpeechEnd() {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      const speechDuration = (this.silenceStartTime || Date.now()) - this.speechStartTime;
      
      console.log(`Speech ended, duration: ${speechDuration}ms`);
      this.callbacks.onSpeechEnd(speechDuration);
      
      // Reset timers
      this.speechStartTime = null;
      this.silenceStartTime = null;
    }
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('VAD configuration updated:', this.config);
  }

  /**
   * Get current state
   * @returns {Object} Current VAD state
   */
  getState() {
    return {
      isActive: this.isActive,
      isSpeaking: this.isSpeaking,
      speechDuration: this.isSpeaking && this.speechStartTime 
        ? Date.now() - this.speechStartTime 
        : 0,
      config: { ...this.config },
    };
  }

  /**
   * Check if browser supports required APIs
   * @returns {boolean} True if supported
   */
  static isSupported() {
    return !!(
      window.AudioContext || 
      window.webkitAudioContext ||
      window.MediaRecorder ||
      navigator.mediaDevices?.getUserMedia
    );
  }
}

/**
 * Factory function to create and initialize VAD instance
 * @param {MediaStream} stream - Audio stream
 * @param {Object} options - Configuration options
 * @returns {Promise<VoiceActivityDetection>} Initialized VAD instance
 */
export async function createVAD(stream, options = {}) {
  if (!VoiceActivityDetection.isSupported()) {
    throw new Error('Voice Activity Detection is not supported in this browser');
  }

  const vad = new VoiceActivityDetection(options);
  await vad.initialize(stream);
  return vad;
}

/**
 * Default configuration for different use cases
 */
export const VAD_PRESETS = {
  // Sensitive detection for quiet environments
  sensitive: {
    silenceThreshold: 20,
    speechTimeout: 1000,
    minSpeechDuration: 300,
  },
  
  // Normal detection for typical environments
  normal: {
    silenceThreshold: 30,
    speechTimeout: 1500,
    minSpeechDuration: 500,
  },
  
  // Less sensitive for noisy environments
  robust: {
    silenceThreshold: 45,
    speechTimeout: 2000,
    minSpeechDuration: 800,
  },
};

export default VoiceActivityDetection;