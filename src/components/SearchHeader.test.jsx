import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SearchHeader from './SearchHeader.jsx';

const SearchHeaderHarness = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <button type="button">页面其他区域</button>
    </>
  );
};

describe('SearchHeader', () => {
  it('expands from the search icon and collapses when an empty search loses outside focus', () => {
    render(<SearchHeaderHarness />);

    const expandButton = screen.getByRole('button', { name: '展开搜索' });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandButton);
    expect(screen.getByRole('button', { name: '聚焦搜索' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(screen.getByPlaceholderText('搜索音乐、专辑...'), {
      target: { value: 'test' }
    });
    expect(screen.getByRole('button', { name: '清除搜索内容' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除搜索内容' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: '页面其他区域' }));

    expect(screen.getByRole('button', { name: '展开搜索' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders header actions beside the search control', () => {
    render(
      <SearchHeader
        searchQuery=""
        setSearchQuery={() => undefined}
        actions={<button type="button">查看公告</button>}
      />
    );

    expect(screen.getByRole('button', { name: '查看公告' })).toBeInTheDocument();
  });
});
