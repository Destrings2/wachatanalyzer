import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export const useD3 = (renderChartFn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void, dependencies: React.DependencyList) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current) {
      const svg = d3.select(ref.current);
      renderChartFn(svg);
    }
    return () => {
      if (ref.current) {
        d3.select(ref.current).selectAll('*').remove();
      }
    };
  }, dependencies);

  return ref;
};