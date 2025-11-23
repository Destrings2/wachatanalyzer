import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FileUploader } from './FileUploader';
import { useChatStore } from '../../stores/chatStore';

// Mock the chat store
vi.mock('../../stores/chatStore');

const mockUseChatStore = vi.mocked(useChatStore);

describe('FileUploader', () => {
  const mockLoadChatFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockReturnValue({
      loadChatFile: mockLoadChatFile,
      isLoading: false,
      error: null,
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      progress: 0,
      clearData: vi.fn(),
    });
  });


  it('displays loading state correctly', () => {
    mockUseChatStore.mockReturnValue({
      loadChatFile: mockLoadChatFile,
      isLoading: true,
      error: null,
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      progress: 50,
      clearData: vi.fn(),
    });

    render(<FileUploader />);

    expect(screen.getByText('Processing your chat...')).toBeInTheDocument();
    // The container should have opacity-50 when loading
    const container = screen.getByText('Processing your chat...').closest('[class*="opacity-50"]');
    expect(container).toHaveClass('opacity-50');
  });

  it('displays error state correctly', () => {
    const errorMessage = 'Failed to parse chat file';
    mockUseChatStore.mockReturnValue({
      loadChatFile: mockLoadChatFile,
      isLoading: false,
      error: errorMessage,
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      progress: 0,
      clearData: vi.fn(),
    });

    render(<FileUploader />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('handles file selection via input', async () => {
    const user = userEvent.setup();
    render(<FileUploader />);

    const file = new File(['chat content'], 'chat.txt', { type: 'text/plain' });
    const input = screen.getByDisplayValue('');

    await user.upload(input, file);

    expect(mockLoadChatFile).toHaveBeenCalledWith(file);
  });

  it('handles file selection via drag and drop', async () => {
    render(<FileUploader />);

    const file = new File(['chat content'], 'chat.txt', { type: 'text/plain' });
    const dropZone = screen.getByText('Drop your chat export here').closest('[class*="border-dashed"]');

    expect(dropZone).toBeInTheDocument();

    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: { files: [file] }
    });

    // Check drag state (should be synchronous)
    expect(dropZone).toHaveClass('border-blue-500');

    // Simulate drop
    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] }
    });

    expect(mockLoadChatFile).toHaveBeenCalledWith(file);
  });

  it('only accepts .txt files', async () => {
    const user = userEvent.setup();
    render(<FileUploader />);

    const invalidFile = new File(['content'], 'file.pdf', { type: 'application/pdf' });
    const input = screen.getByDisplayValue('');

    await user.upload(input, invalidFile);

    expect(mockLoadChatFile).not.toHaveBeenCalled();
  });

  it('handles drag leave correctly', () => {
    render(<FileUploader />);

    const dropZone = screen.getByText('Drop your chat export here').closest('[class*="border-dashed"]');

    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: { files: [] }
    });

    // Check drag state (should be synchronous)
    expect(dropZone).toHaveClass('border-blue-500');

    // Simulate drag leave
    fireEvent.dragLeave(dropZone!);

    // Check drag state cleared (should be synchronous)
    expect(dropZone).not.toHaveClass('border-blue-500');
  });

  it('disables interaction when loading', () => {
    mockUseChatStore.mockReturnValue({
      loadChatFile: mockLoadChatFile,
      isLoading: true,
      error: null,
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      progress: 50,
      clearData: vi.fn(),
    });

    render(<FileUploader />);

    const input = screen.getByDisplayValue('');
    const dropZone = screen.getByText('Processing your chat...').closest('[class*="opacity-50"]');

    expect(input).toBeDisabled();
    expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');
  });



  it('handles multiple files in drop and selects .txt file', () => {
    render(<FileUploader />);

    const txtFile = new File(['chat content'], 'chat.txt', { type: 'text/plain' });
    const pdfFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
    const dropZone = screen.getByText('Drop your chat export here').closest('[class*="border-dashed"]');

    // Simulate drop with multiple files
    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [pdfFile, txtFile] }
    });

    expect(mockLoadChatFile).toHaveBeenCalledWith(txtFile);
  });
});
