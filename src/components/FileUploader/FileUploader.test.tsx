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

    expect(screen.getByText('Analyzing your chat...')).toBeInTheDocument();
    // Check for loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
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
    // Find the drop zone by looking for the main container with drag handlers
    const dropZone = document.querySelector('[class*="rounded-3xl"]');

    expect(dropZone).toBeInTheDocument();

    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: { files: [file] }
    });

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

    const dropZone = document.querySelector('[class*="rounded-3xl"]');

    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: { files: [] }
    });

    // Simulate drag leave
    fireEvent.dragLeave(dropZone!);

    // Drag state should be cleared
    expect(dropZone).toBeInTheDocument();
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

    expect(input).toBeDisabled();
  });



  it('handles multiple files in drop and selects .txt file', () => {
    render(<FileUploader />);

    const txtFile = new File(['chat content'], 'chat.txt', { type: 'text/plain' });
    const pdfFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
    const dropZone = document.querySelector('[class*="rounded-3xl"]');

    // Simulate drop with multiple files
    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [pdfFile, txtFile] }
    });

    expect(mockLoadChatFile).toHaveBeenCalledWith(txtFile);
  });
});
