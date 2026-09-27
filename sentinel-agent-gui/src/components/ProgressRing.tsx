import React from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  statusText?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 180,
  strokeWidth = 12,
  statusText = 'Scanning Evidence...',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#2d3148"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold font-mono text-white tracking-tight">
            {Math.round(percentage)}%
          </span>
          <span className="text-[10px] uppercase font-semibold text-blue-400 tracking-wider mt-1">
            Progress
          </span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-300 animate-pulse text-center">
        {statusText}
      </p>
    </div>
  );
};
