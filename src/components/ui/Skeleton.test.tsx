import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton, MessageSkeleton, ChartSkeleton, DashboardSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders as different HTML elements', () => {
    const { container: divContainer } = render(<Skeleton as="div" />);
    const { container: spanContainer } = render(<Skeleton as="span" />);
    
    const divElement = divContainer.firstChild as HTMLElement;
    const spanElement = spanContainer.firstChild as HTMLElement;
    expect(divElement?.tagName).toBe('DIV');
    expect(spanElement?.tagName).toBe('SPAN');
  });
});

describe('MessageSkeleton', () => {
  it('renders multiple skeleton elements for message structure', () => {
    const { container } = render(<MessageSkeleton />);
    
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(1);
  });
});

describe('ChartSkeleton', () => {
  it('renders multiple skeleton elements for chart structure', () => {
    const { container } = render(<ChartSkeleton />);
    
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(1);
  });
});

describe('DashboardSkeleton', () => {
  it('renders complex skeleton structure for dashboard layout', () => {
    const { container } = render(<DashboardSkeleton />);
    
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});

describe('Skeleton Accessibility', () => {
  it('has proper aria attributes for loading state', () => {
    const { container } = render(<Skeleton />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveAttribute('role', 'status');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading...');
  });
});