import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { I18nProvider } from '../i18n';
import { buildTheme } from '../theme';
import { Blog } from './Static';

const renderBlog = () => {
  localStorage.setItem('lang', JSON.stringify('en'));
  return render(
    <ThemeProvider theme={buildTheme('light')}>
      <I18nProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Blog />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>,
  );
};

describe('Blog', () => {
  it('글 목록을 보여준다', () => {
    renderBlog();
    expect(screen.getByText('What is the Kimchi Premium?')).toBeInTheDocument();
    expect(screen.getByText('Comparing gold and bitcoin on one chart')).toBeInTheDocument();
  });

  it('카테고리를 고르면 해당 글만 남는다', () => {
    renderBlog();
    fireEvent.click(screen.getByRole('button', { name: 'Commodity' }));
    expect(screen.getByText('Comparing gold and bitcoin on one chart')).toBeInTheDocument();
    expect(screen.queryByText('What is the Kimchi Premium?')).not.toBeInTheDocument();
  });

  it('검색어와 맞는 글만 남는다', () => {
    renderBlog();
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'dollar' } });
    expect(screen.getByText('Why traders watch the US Dollar Index')).toBeInTheDocument();
    expect(screen.queryByText('Reading Open Interest alongside price')).not.toBeInTheDocument();
  });
});
