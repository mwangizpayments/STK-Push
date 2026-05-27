import * as React from 'react';
import {
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import { cn } from '@/lib/utils';

const ChartContext = React.createContext(null);

export function ChartContainer({ children, className, config = {} }) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          'flex aspect-video justify-center text-xs text-muted-foreground [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-grid_line]:stroke-border [&_.recharts-tooltip-cursor]:fill-muted [&_.recharts-tooltip-cursor]:opacity-50',
          className
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsTooltip;
export const ChartLegend = RechartsLegend;

export function ChartTooltipContent({ active, className, formatter, label, labelFormatter, payload }) {
  const { config } = React.useContext(ChartContext) || { config: {} };

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'min-w-36 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md',
        className
      )}
    >
      {label ? (
        <div className="mb-2 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((item) => {
          const itemConfig = config[item.dataKey] || config[item.name] || {};
          const name = itemConfig.label || item.name || item.dataKey;
          const value = formatter ? formatter(item.value, item.name, item) : item.value;

          return (
            <div className="flex items-center justify-between gap-4" key={`${item.dataKey}-${item.name}`}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color || item.payload?.fill || itemConfig.color }}
                />
                <span className="text-muted-foreground">{name}</span>
              </div>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent({ payload }) {
  const { config } = React.useContext(ChartContext) || { config: {} };

  if (!payload?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
      {payload.map((item) => {
        const itemConfig = config[item.dataKey] || config[item.value] || {};

        return (
          <div className="flex items-center gap-2" key={item.value}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{itemConfig.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
