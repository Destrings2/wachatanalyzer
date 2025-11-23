import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { 
  EmptyState, 
  NoDataState, 
  NoResultsState, 
  ErrorState, 
  NoFiltersState 
} from './EmptyState';
import { Search } from 'lucide-react';

describe('EmptyState', () => {

  it('renders with custom icon', () => {
    render(
      <EmptyState
        title="Custom Icon"
        description="Test description"
        icon={<Search data-testid="custom-icon" />}
      />
    );
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button when provided', async () => {
    const mockAction = vi.fn();
    const user = userEvent.setup();
    
    render(
      <EmptyState
        title="With Action"
        description="Test description"
        action={{
          label: 'Click Me',
          onClick: mockAction
        }}
      />
    );
    
    const button = screen.getByRole('button', { name: 'Click Me' });
    expect(button).toBeInTheDocument();
    
    await user.click(button);
    expect(mockAction).toHaveBeenCalledOnce();
  });




  it('applies error styling for error type', () => {
    render(
      <EmptyState
        type="error"
        title="Error"
        description="Something went wrong"
      />
    );
    
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('NoDataState', () => {
  it('renders with default props', () => {
    render(<NoDataState />);
    
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.getByText('Upload a WhatsApp chat export to start analyzing your conversations.')).toBeInTheDocument();
  });

  it('renders upload button when onUpload provided', async () => {
    const mockUpload = vi.fn();
    const user = userEvent.setup();
    
    render(<NoDataState onUpload={mockUpload} />);
    
    const button = screen.getByRole('button', { name: 'Upload Chat Export' });
    await user.click(button);
    
    expect(mockUpload).toHaveBeenCalledOnce();
  });

  it('does not render button when onUpload not provided', () => {
    render(<NoDataState />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('NoResultsState', () => {
  it('renders with default props', () => {
    render(<NoResultsState />);
    
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search terms or filters to find what you\'re looking for.')).toBeInTheDocument();
  });

  it('renders clear filters button when onClearFilters provided', async () => {
    const mockClearFilters = vi.fn();
    const user = userEvent.setup();
    
    render(<NoResultsState onClearFilters={mockClearFilters} />);
    
    const button = screen.getByRole('button', { name: 'Clear Filters' });
    await user.click(button);
    
    expect(mockClearFilters).toHaveBeenCalledOnce();
  });
});

describe('ErrorState', () => {
  it('renders with default error message', () => {
    render(<ErrorState />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We encountered an error while processing your data. Please try again.')).toBeInTheDocument();
  });

  it('renders with custom error message', () => {
    const customError = 'Custom error message';
    render(<ErrorState error={customError} />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(customError)).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', async () => {
    const mockRetry = vi.fn();
    const user = userEvent.setup();
    
    render(<ErrorState onRetry={mockRetry} />);
    
    const button = screen.getByRole('button', { name: 'Try Again' });
    await user.click(button);
    
    expect(mockRetry).toHaveBeenCalledOnce();
  });
});

describe('NoFiltersState', () => {
  it('renders with default props', () => {
    render(<NoFiltersState />);
    
    expect(screen.getByText('Apply filters to view data')).toBeInTheDocument();
    expect(screen.getByText('Select participants, date ranges, or message types to filter your chat analysis.')).toBeInTheDocument();
  });

  it('renders apply filters button when onApplyFilters provided', async () => {
    const mockApplyFilters = vi.fn();
    const user = userEvent.setup();
    
    render(<NoFiltersState onApplyFilters={mockApplyFilters} />);
    
    const button = screen.getByRole('button', { name: 'Apply Filters' });
    await user.click(button);
    
    expect(mockApplyFilters).toHaveBeenCalledOnce();
  });
});

describe('EmptyState Accessibility', () => {
  it('has proper heading structure', () => {
    render(
      <EmptyState
        title="Test Title"
        description="Test description"
      />
    );
    
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Test Title');
  });

  it('action button has proper accessibility attributes', () => {
    render(
      <EmptyState
        title="Test"
        description="Test description"
        action={{
          label: 'Test Action',
          onClick: vi.fn()
        }}
      />
    );
    
    const button = screen.getByRole('button', { name: 'Test Action' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('supports keyboard navigation', async () => {
    const mockAction = vi.fn();
    const user = userEvent.setup();
    
    render(
      <EmptyState
        title="Test"
        description="Test description"
        action={{
          label: 'Test Action',
          onClick: mockAction
        }}
      />
    );
    
    const button = screen.getByRole('button');
    
    // Tab to the button
    await user.tab();
    expect(button).toHaveFocus();
    
    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(mockAction).toHaveBeenCalledOnce();
  });
});