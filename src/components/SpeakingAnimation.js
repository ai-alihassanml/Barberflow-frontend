'use client';

import { memo, useEffect, useState, useRef } from 'react';

/**
 * Animation types for different conversation states
 */
const ANIMATION_TYPES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

/**
 * Waveform animation component for speaking state
 */
function WaveformAnimation({ isActive, intensity = 50, bars = 5, className = '' }) {
  const [animationData, setAnimationData] = useState([]);
  const animationRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      // Initialize animation data
      const initialData = Array.from({ length: bars }, (_, i) => ({
        height: 8 + Math.random() * 20,
        delay: i * 0.1,
        speed: 0.8 + Math.random() * 0.4,
      }));
      setAnimationData(initialData);

      // Start animation loop
      const animate = () => {
        setAnimationData(prev => 
          prev.map(bar => ({
            ...bar,
            height: 8 + Math.random() * (intensity / 2),
          }))
        );
        animationRef.current = setTimeout(animate, 150);
      };

      animate();
    } else {
      // Stop animation and reset to idle state
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      setAnimationData(Array.from({ length: bars }, () => ({ height: 8, delay: 0, speed: 1 })));
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isActive, intensity, bars]);

  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {animationData.map((bar, index) => (
        <div
          key={index}
          className={`w-1.5 bg-blue-400 rounded-full transition-all duration-150 ${
            isActive ? 'animate-pulse' : ''
          }`}
          style={{
            height: `${bar.height}px`,
            animationDelay: `${bar.delay}s`,
            animationDuration: `${bar.speed}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pulsing circle animation for listening state
 */
function ListeningAnimation({ isActive, size = 'w-16 h-16', className = '' }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer pulsing ring */}
      <div
        className={`absolute rounded-full border-2 border-blue-400 ${size} ${
          isActive ? 'animate-ping' : 'opacity-30'
        }`}
        style={{ animationDuration: '2s' }}
      />
      
      {/* Middle ring */}
      <div
        className={`absolute rounded-full border border-blue-300 ${size} ${
          isActive ? 'animate-pulse' : 'opacity-20'
        }`}
        style={{ 
          animationDuration: '1.5s',
          transform: 'scale(0.8)',
        }}
      />
      
      {/* Inner microphone icon */}
      <div className={`relative z-10 ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
        <svg
          className="w-8 h-8"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Spinning animation for processing state
 */
function ProcessingAnimation({ isActive, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        {/* Spinning outer ring */}
        <div
          className={`w-16 h-16 border-4 border-gray-600 border-t-yellow-400 rounded-full ${
            isActive ? 'animate-spin' : ''
          }`}
        />
        
        {/* Inner processing icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Error animation for error state
 */
function ErrorAnimation({ isActive, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`relative ${isActive ? 'animate-bounce' : ''}`}>
        {/* Error background */}
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Main speaking animation component that switches between different states
 */
function SpeakingAnimation({
  type = ANIMATION_TYPES.IDLE,
  isActive = false,
  intensity = 50,
  size = 'w-28 h-28',
  className = '',
}) {
  const containerClasses = `flex items-center justify-center ${size} rounded-full border border-dashed border-gray-700 bg-gray-900/60 ${className}`;

  // Render appropriate animation based on type
  const renderAnimation = () => {
    switch (type) {
      case ANIMATION_TYPES.LISTENING:
        return (
          <ListeningAnimation
            isActive={isActive}
            size={size}
            className="w-full h-full"
          />
        );

      case ANIMATION_TYPES.PROCESSING:
        return (
          <ProcessingAnimation
            isActive={isActive}
            className="w-full h-full"
          />
        );

      case ANIMATION_TYPES.SPEAKING:
        return (
          <WaveformAnimation
            isActive={isActive}
            intensity={intensity}
            bars={5}
            className="w-full h-full"
          />
        );

      case ANIMATION_TYPES.ERROR:
        return (
          <ErrorAnimation
            isActive={isActive}
            className="w-full h-full"
          />
        );

      case ANIMATION_TYPES.IDLE:
      default:
        return (
          <div className="flex items-center justify-center w-full h-full">
            <svg
              className="w-12 h-12 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={containerClasses}>
      {renderAnimation()}
    </div>
  );
}

/**
 * Hook for managing speaking animation state
 */
export function useSpeakingAnimation(conversationState) {
  const [animationType, setAnimationType] = useState(ANIMATION_TYPES.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [intensity, setIntensity] = useState(50);

  useEffect(() => {
    switch (conversationState) {
      case 'listening':
        setAnimationType(ANIMATION_TYPES.LISTENING);
        setIsActive(true);
        break;
      
      case 'processing':
        setAnimationType(ANIMATION_TYPES.PROCESSING);
        setIsActive(true);
        break;
      
      case 'speaking':
        setAnimationType(ANIMATION_TYPES.SPEAKING);
        setIsActive(true);
        setIntensity(60 + Math.random() * 40); // Dynamic intensity
        break;
      
      case 'error':
        setAnimationType(ANIMATION_TYPES.ERROR);
        setIsActive(true);
        break;
      
      case 'idle':
      default:
        setAnimationType(ANIMATION_TYPES.IDLE);
        setIsActive(false);
        break;
    }
  }, [conversationState]);

  return {
    animationType,
    isActive,
    intensity,
    setIntensity,
  };
}

// Export animation types for external use
export { ANIMATION_TYPES };

export default memo(SpeakingAnimation);