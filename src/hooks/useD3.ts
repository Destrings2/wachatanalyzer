import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export const useD3 = (renderChartFn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void, dependencies: React.DependencyList) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) {
      const svg = d3.select(element);
      renderChartFn(svg);
    }
    return () => {
      if (element) {
        d3.select(element).selectAll('*').remove();
      }
    };
  }, [renderChartFn, ...dependencies]);

  return ref;
};