import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { MainLayout } from '../src/layouts/MainLayout';
vi.mock('../src/services/native', () => ({ isNativeApp: () => true }));
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false }) }));
vi.mock('../src/contexts/ToastContext', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('../src/components/MobileOnboarding', () => ({ MobileOnboarding: () => <p>Sign in to continue</p> }));
vi.mock('../src/components/AuthModal', () => ({ AuthModal: () => null }));
afterEach(cleanup);
test('a template query cannot bypass the native account gate', () => {
  render(<MemoryRouter initialEntries={['/feed?template=monthly-sales']}><MainLayout><p>Private app content</p></MainLayout></MemoryRouter>);
  expect(screen.getByText('Sign in to continue')).toBeTruthy();
  expect(screen.queryByText('Private app content')).toBeNull();
});
