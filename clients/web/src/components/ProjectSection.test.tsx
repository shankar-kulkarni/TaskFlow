import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectSection } from './ProjectSection';

describe('ProjectSection', () => {
  it('renders project list and allows create', async () => {
    render(<ProjectSection />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
  });

  it('shows help popover on hover', async () => {
    render(<ProjectSection />);
    const helpBtn = screen.getByLabelText(/help/i);
    fireEvent.mouseEnter(helpBtn);
    expect(await screen.findByText(/Projects Section Help/i)).toBeInTheDocument();
  });

  // Add more tests for edit, delete, bulk actions, export/import, etc.
});
