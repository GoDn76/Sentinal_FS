import React from 'react';
import { ShieldCheck, HardDrive, Cpu, CloudUpload, Film } from 'lucide-react';

interface StepBarProps {
  currentStep: number;
  flow?: 'carving' | 'manual';
}

export const StepBar: React.FC<StepBarProps> = ({ currentStep, flow = 'carving' }) => {
  const steps = [
    { num: 1, label: 'Case Setup', icon: ShieldCheck },
    flow === 'carving'
      ? { num: 2, label: 'Select Storage', icon: HardDrive }
      : { num: 2, label: 'Select Files', icon: Film },
    flow === 'carving'
      ? { num: 3, label: 'Forensic Carving', icon: Cpu }
      : { num: 3, label: 'File Hashing', icon: Cpu },
    { num: 4, label: 'Preview & Upload', icon: CloudUpload },
  ];

  return (
    <div className="w-full bg-[#1a1d27] border-b border-[#2d3148] px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;

          return (
            <React.Fragment key={step.num}>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-sm flex items-center justify-center font-semibold text-xs transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#2d3148] text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-xs font-medium tracking-wide ${
                    isActive
                      ? 'text-blue-400 font-semibold'
                      : isDone
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-4 transition-colors ${
                    isDone ? 'bg-emerald-600' : 'bg-[#2d3148]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
