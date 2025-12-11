'use client';

import { memo } from 'react';

function AnimatedIcon({ isActive = false, size = 'w-28 h-28' }) {
  return (
    <div className={`flex items-center justify-center ${size} rounded-full border border-dashed border-gray-700 bg-gray-900/60`}>
      <div className={`flex space-x-1 ${isActive ? 'animate-pulse' : ''}`}>
        <span className="w-1.5 h-6 rounded-full bg-blue-400"></span>
        <span className="w-1.5 h-4 rounded-full bg-blue-500"></span>
        <span className="w-1.5 h-8 rounded-full bg-blue-400"></span>
        <span className="w-1.5 h-5 rounded-full bg-blue-500"></span>
        <span className="w-1.5 h-7 rounded-full bg-blue-400"></span>
      </div>
    </div>
  );
}

export default memo(AnimatedIcon);

