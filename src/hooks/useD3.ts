import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export const useD3 = (renderChartFn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => (() => void) | void, dependencies: React.DependencyList) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = ref.current;
    let cleanup: (() => void) | void;
    
    if (element) {
      try {
        const svg = d3.select(element);
        cleanup = renderChartFn(svg);
      } catch (error) {
        console.error('Error in D3 render function:', error);
      }
    }
    
    return () => {
      try {
        if (cleanup) {
          cleanup();
        }
      } catch (error) {
        console.error('Error in D3 cleanup function:', error);
      }
      if (element) {
        d3.select(element).selectAll('*').remove();
      }
    };
  }, [renderChartFn, ...dependencies]);

  return ref;
};