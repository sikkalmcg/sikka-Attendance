'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function SortHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  align = 'left',
  className = '',
}) {
  const isAscActive = currentField === field && currentDirection === 'asc';
  const isDescActive = currentField === field && currentDirection === 'desc';

  return (
    <th className={`py-3 px-4 select-none whitespace-nowrap ${className}`}>
      <div
        className={`flex items-center gap-1.5 ${
          align === 'right'
            ? 'justify-end'
            : align === 'center'
            ? 'justify-center'
            : 'justify-between'
        }`}
      >
        <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
          {label}
        </span>
        <div className="inline-flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSort(field, 'asc');
            }}
            title={`Sort ${label} Ascending`}
            aria-label={`Sort ${label} Ascending`}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              isAscActive
                ? 'bg-blue-100 text-blue-700 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSort(field, 'desc');
            }}
            title={`Sort ${label} Descending`}
            aria-label={`Sort ${label} Descending`}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              isDescActive
                ? 'bg-blue-100 text-blue-700 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </th>
  );
}
