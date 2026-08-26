import { useState } from 'react';
import type { OhmsLawIssueCode, SeriesParallelIssueCode, ExperimentUsability } from '../../../engines/physics/experiments/types';

interface ValidationPanelProps {
  issues: (OhmsLawIssueCode | SeriesParallelIssueCode)[];
  usability: ExperimentUsability;
}

function getIssueKey(issue: string) {
  return `issue:${issue}`;
}

function ValidationPanelContent({ issues, usability }: ValidationPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activeIssues = issues.filter(i => !dismissed.has(getIssueKey(i)));

  const handleDismiss = (key: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  return (
    <div className="w-full bg-[#20201f] border border-[#424845] rounded-lg p-3 shadow-2xl flex flex-col gap-3 text-xs max-h-[300px] overflow-y-auto">
      <div>
        <h3 className="font-label-caps text-[10px] text-[#c2c8c4] mb-2 font-semibold tracking-wider">EXPERIMENT STATUS</h3>
        <div className={`px-3 py-1.5 rounded inline-block font-bold
          ${usability === 'usable' ? 'bg-green-500/20 text-green-400' : 
            usability === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' : 
            'bg-red-500/20 text-red-400'}`}
        >
          {usability.toUpperCase()}
        </div>
      </div>

      {activeIssues.length > 0 && (
        <div>
          <h4 className="font-label-caps text-[10px] text-[#8da399] mb-1 font-semibold">EXPERIMENT ISSUES</h4>
          <ul className="flex flex-col gap-1">
            {activeIssues.map((issue) => {
              const key = getIssueKey(issue);
              const isWarning = issue === 'EXTRANEOUS_COMPONENTS';
              const stylingClass = isWarning 
                ? "text-amber-400 bg-amber-500/10" 
                : "text-red-400 bg-red-500/10";

              return (
                <li key={key} className={`${stylingClass} px-2 py-1 rounded flex justify-between items-start gap-2`}>
                  <span className="min-w-0 flex-1 break-words">• {issue.replace(/_/g, ' ')}</span>
                  <button onClick={() => handleDismiss(key)} className="opacity-50 hover:opacity-100 shrink-0">×</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeIssues.length === 0 && (
        <div className="text-[#8da399] italic font-data-mono text-[10px]">No issues detected.</div>
      )}
    </div>
  );
}

export function ValidationPanel(props: ValidationPanelProps) {
  return <ValidationPanelContent key={props.issues.join('|')} {...props} />;
}
