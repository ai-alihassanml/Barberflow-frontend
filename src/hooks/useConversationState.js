import { useReducer, useCallback, useRef, useEffect } from 'react';

/**
 * Conversation states
 */
export const CONVERSATION_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  INTERRUPTED: 'interrupted',
  ERROR: 'error',
};

/**
 * Conversation modes
 */
export const CONVERSATION_MODES = {
  IDLE: 'idle',
  CONVERSATIONAL: 'conversational',
};

/**
 * Action types for conversation state reducer
 */
const ACTION_TYPES = {
  START_CONVERSATION: 'START_CONVERSATION',
  END_CONVERSATION: 'END_CONVERSATION',
  START_LISTENING: 'START_LISTENING',
  SPEECH_DETECTED: 'SPEECH_DETECTED',
  START_PROCESSING: 'START_PROCESSING',
  START_SPEAKING: 'START_SPEAKING',
  FINISH_SPEAKING: 'FINISH_SPEAKING',
  INTERRUPT_SPEAKING: 'INTERRUPT_SPEAKING',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  RESET_ERROR: 'RESET_ERROR',
  UPDATE_SESSION: 'UPDATE_SESSION',
};

/**
 * Initial conversation state
 */
const initialState = {
  mode: CONVERSATION_MODES.IDLE,
  currentState: CONVERSATION_STATES.IDLE,
  isActive: false,
  canInterrupt: false,
  sessionId: null,
  startTime: null,
  lastActivity: null,
  exchangeCount: 0,
  error: null,
  metadata: {},
};

/**
 * Conversation state reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
function conversationReducer(state, action) {
  const timestamp = Date.now();

  switch (action.type) {
    case ACTION_TYPES.START_CONVERSATION:
      return {
        ...state,
        mode: CONVERSATION_MODES.CONVERSATIONAL,
        currentState: CONVERSATION_STATES.LISTENING,
        isActive: true,
        sessionId: action.payload?.sessionId || `session_${timestamp}`,
        startTime: timestamp,
        lastActivity: timestamp,
        exchangeCount: 0,
        error: null,
        metadata: action.payload?.metadata || {},
      };

    case ACTION_TYPES.END_CONVERSATION:
      return {
        ...state,
        mode: CONVERSATION_MODES.IDLE,
        currentState: CONVERSATION_STATES.IDLE,
        isActive: false,
        canInterrupt: false,
        sessionId: null,
        startTime: null,
        lastActivity: timestamp,
        error: null,
      };

    case ACTION_TYPES.START_LISTENING:
      return {
        ...state,
        currentState: CONVERSATION_STATES.LISTENING,
        canInterrupt: false,
        lastActivity: timestamp,
        error: null,
      };

    case ACTION_TYPES.SPEECH_DETECTED:
      return {
        ...state,
        currentState: CONVERSATION_STATES.PROCESSING,
        lastActivity: timestamp,
      };

    case ACTION_TYPES.START_PROCESSING:
      return {
        ...state,
        currentState: CONVERSATION_STATES.PROCESSING,
        canInterrupt: false,
        lastActivity: timestamp,
      };

    case ACTION_TYPES.START_SPEAKING:
      return {
        ...state,
        currentState: CONVERSATION_STATES.SPEAKING,
        canInterrupt: true,
        lastActivity: timestamp,
        exchangeCount: state.exchangeCount + 1,
      };

    case ACTION_TYPES.FINISH_SPEAKING:
      return {
        ...state,
        currentState: state.mode === CONVERSATION_MODES.CONVERSATIONAL 
          ? CONVERSATION_STATES.LISTENING 
          : CONVERSATION_STATES.IDLE,
        canInterrupt: false,
        lastActivity: timestamp,
      };

    case ACTION_TYPES.INTERRUPT_SPEAKING:
      return {
        ...state,
        currentState: CONVERSATION_STATES.INTERRUPTED,
        canInterrupt: false,
        lastActivity: timestamp,
      };

    case ACTION_TYPES.ERROR_OCCURRED:
      return {
        ...state,
        currentState: CONVERSATION_STATES.ERROR,
        canInterrupt: false,
        error: action.payload?.error || 'Unknown error occurred',
        lastActivity: timestamp,
      };

    case ACTION_TYPES.RESET_ERROR:
      return {
        ...state,
        currentState: state.mode === CONVERSATION_MODES.CONVERSATIONAL 
          ? CONVERSATION_STATES.LISTENING 
          : CONVERSATION_STATES.IDLE,
        error: null,
        lastActivity: timestamp,
      };

    case ACTION_TYPES.UPDATE_SESSION:
      return {
        ...state,
        metadata: { ...state.metadata, ...action.payload?.metadata },
        lastActivity: timestamp,
      };

    default:
      console.warn('Unknown conversation action type:', action.type);
      return state;
  }
}

/**
 * Custom hook for managing conversation state
 * @param {Object} options - Configuration options
 * @returns {Object} Conversation state and control functions
 */
export function useConversationState(options = {}) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  
  // Configuration
  const config = {
    autoReturnToListening: options.autoReturnToListening !== false,
    errorTimeout: options.errorTimeout || 5000,
    sessionTimeout: options.sessionTimeout || 300000, // 5 minutes
    maxExchanges: options.maxExchanges || 50,
    ...options,
  };

  // Refs for cleanup and timers
  const errorTimeoutRef = useRef(null);
  const sessionTimeoutRef = useRef(null);

  /**
   * Start a new conversation session
   */
  const startConversation = useCallback((metadata = {}) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    dispatch({
      type: ACTION_TYPES.START_CONVERSATION,
      payload: { sessionId, metadata },
    });

    // Set session timeout
    if (config.sessionTimeout > 0) {
      sessionTimeoutRef.current = setTimeout(() => {
        console.log('Conversation session timed out');
        endConversation();
      }, config.sessionTimeout);
    }

    console.log('Conversation started:', sessionId);
  }, [config.sessionTimeout]);

  /**
   * End the current conversation session
   */
  const endConversation = useCallback(() => {
    dispatch({ type: ACTION_TYPES.END_CONVERSATION });

    // Clear timers
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }

    console.log('Conversation ended');
  }, []);

  /**
   * Transition to listening state
   */
  const startListening = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_LISTENING });
  }, []);

  /**
   * Handle speech detection
   */
  const onSpeechDetected = useCallback(() => {
    if (state.currentState === CONVERSATION_STATES.LISTENING) {
      dispatch({ type: ACTION_TYPES.SPEECH_DETECTED });
    }
  }, [state.currentState]);

  /**
   * Transition to processing state
   */
  const startProcessing = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_PROCESSING });
  }, []);

  /**
   * Transition to speaking state
   */
  const startSpeaking = useCallback(() => {
    // Check max exchanges limit
    if (config.maxExchanges > 0 && state.exchangeCount >= config.maxExchanges) {
      console.log('Maximum exchanges reached, ending conversation');
      endConversation();
      return;
    }

    dispatch({ type: ACTION_TYPES.START_SPEAKING });
  }, [state.exchangeCount, config.maxExchanges, endConversation]);

  /**
   * Handle speaking completion
   */
  const finishSpeaking = useCallback(() => {
    dispatch({ type: ACTION_TYPES.FINISH_SPEAKING });
  }, []);

  /**
   * Handle speaking interruption
   */
  const interruptSpeaking = useCallback(() => {
    if (state.canInterrupt) {
      dispatch({ type: ACTION_TYPES.INTERRUPT_SPEAKING });
      
      // Auto return to listening after interruption
      if (config.autoReturnToListening) {
        setTimeout(() => {
          startListening();
        }, 100);
      }
    }
  }, [state.canInterrupt, config.autoReturnToListening, startListening]);

  /**
   * Handle error occurrence
   */
  const setError = useCallback((error) => {
    dispatch({ 
      type: ACTION_TYPES.ERROR_OCCURRED, 
      payload: { error: error?.message || error || 'Unknown error' }
    });

    // Auto-clear error after timeout
    if (config.errorTimeout > 0) {
      errorTimeoutRef.current = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.RESET_ERROR });
      }, config.errorTimeout);
    }

    console.error('Conversation error:', error);
  }, [config.errorTimeout]);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    dispatch({ type: ACTION_TYPES.RESET_ERROR });
  }, []);

  /**
   * Update session metadata
   */
  const updateSession = useCallback((metadata) => {
    dispatch({
      type: ACTION_TYPES.UPDATE_SESSION,
      payload: { metadata },
    });
  }, []);

  /**
   * Get conversation statistics
   */
  const getStats = useCallback(() => {
    const now = Date.now();
    const duration = state.startTime ? now - state.startTime : 0;
    const timeSinceLastActivity = state.lastActivity ? now - state.lastActivity : 0;

    return {
      sessionId: state.sessionId,
      duration,
      exchangeCount: state.exchangeCount,
      timeSinceLastActivity,
      isActive: state.isActive,
      currentState: state.currentState,
      mode: state.mode,
    };
  }, [state]);

  /**
   * Check if conversation is in a specific state
   */
  const isInState = useCallback((targetState) => {
    return state.currentState === targetState;
  }, [state.currentState]);

  /**
   * Check if conversation can be interrupted
   */
  const canInterrupt = useCallback(() => {
    return state.canInterrupt && state.currentState === CONVERSATION_STATES.SPEAKING;
  }, [state.canInterrupt, state.currentState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  // Return state and control functions
  return {
    // State
    ...state,
    
    // Control functions
    startConversation,
    endConversation,
    startListening,
    onSpeechDetected,
    startProcessing,
    startSpeaking,
    finishSpeaking,
    interruptSpeaking,
    setError,
    clearError,
    updateSession,
    
    // Utility functions
    getStats,
    isInState,
    canInterrupt,
    
    // State constants for convenience
    states: CONVERSATION_STATES,
    modes: CONVERSATION_MODES,
  };
}

export default useConversationState;