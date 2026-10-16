import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

describe('UI Component System', () => {
  describe('Badge', () => {
    it('renders SENT status with correct text', () => {
      render(<Badge status="SENT" />);
      expect(screen.getByText('SENT')).toBeInTheDocument();
    });

    it('renders SCHEDULED status', () => {
      render(<Badge status="SCHEDULED" />);
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });

    it('renders FAILED status', () => {
      render(<Badge status="FAILED" />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });

  describe('Button', () => {
    it('renders children and handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables button when isLoading is true', () => {
      render(<Button isLoading>Submitting</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Input', () => {
    it('renders label and error message', () => {
      render(
        <Input
          label="Test Label"
          placeholder="Enter text..."
          error="This field is required"
        />
      );
      expect(screen.getByText('Test Label')).toBeInTheDocument();
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('renders content when open and triggers onClose on escape', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Dialog Title">
          <div>Dialog Inner Content</div>
        </Modal>
      );
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog Inner Content')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('does not render content when closed', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Dialog Title">
          <div>Dialog Inner Content</div>
        </Modal>
      );
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
    });
  });

  describe('CSV Recipient Parsing Logic', () => {
    it('deduplicates emails and ignores invalid rows', () => {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const rawText = `
        alex@test.com
        bob@test.com
        alex@test.com
        invalid-email-address
        charlie@company.org, extra data
      `;

      const lines = rawText.split('\n');
      const validEmails: string[] = [];
      let duplicateCount = 0;
      let invalidCount = 0;
      const seen = new Set<string>();

      for (const line of lines) {
        const tokens = line.split(/[,\t;]/).map((t) => t.trim().toLowerCase());
        for (const token of tokens) {
          if (token && token.includes('@')) {
            if (!EMAIL_REGEX.test(token)) {
              invalidCount++;
            } else if (seen.has(token)) {
              duplicateCount++;
            } else {
              seen.add(token);
              validEmails.push(token);
            }
          }
        }
      }

      expect(validEmails).toEqual(['alex@test.com', 'bob@test.com', 'charlie@company.org']);
      expect(duplicateCount).toBe(1);
      expect(seen.size).toBe(3);
    });
  });
});
