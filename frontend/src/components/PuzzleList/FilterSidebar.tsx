/**
 * Filter Sidebar Component
 * Provides comprehensive filtering for puzzle list
 */

import { useState } from 'react';
import {
  ExpandMore as ChevronDownIcon,
  ExpandLess as ChevronUpIcon,
  FilterList as FunnelIcon,
  Close as XMarkIcon,
} from '@mui/icons-material';

export interface FilterState {
  size: { Mini: boolean; Standard: boolean };
  status: { New: boolean; InProgress: boolean; Complete: boolean };
  difficulty: { Easy: boolean; Medium: boolean; Hard: boolean };
  author: string;
  dateFrom: string;
  dateTo: string;
}

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const FilterSection = ({ title, children, defaultExpanded = true }: FilterSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left font-semibold text-gray-800 hover:text-primary transition-colors"
      >
        <span>{title}</span>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4" />
        ) : (
          <ChevronDownIcon className="w-4 h-4" />
        )}
      </button>
      {isExpanded && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
};

interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const CheckboxFilter = ({ label, checked, onChange }: CheckboxFilterProps) => {
  return (
    <label className="flex items-center space-x-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
      />
      <span className="text-sm text-gray-700 group-hover:text-primary transition-colors select-none">
        {label}
      </span>
    </label>
  );
};

const FilterSidebar = ({ filters, onFilterChange, isOpen, onToggle }: FilterSidebarProps) => {
  const handleSizeChange = (size: 'Mini' | 'Standard', checked: boolean) => {
    onFilterChange({
      ...filters,
      size: { ...filters.size, [size]: checked },
    });
  };

  const handleStatusChange = (status: 'New' | 'InProgress' | 'Complete', checked: boolean) => {
    onFilterChange({
      ...filters,
      status: { ...filters.status, [status]: checked },
    });
  };

  const handleDifficultyChange = (difficulty: 'Easy' | 'Medium' | 'Hard', checked: boolean) => {
    onFilterChange({
      ...filters,
      difficulty: { ...filters.difficulty, [difficulty]: checked },
    });
  };

  const handleAuthorChange = (author: string) => {
    onFilterChange({ ...filters, author });
  };

  const handleDateFromChange = (date: string) => {
    onFilterChange({ ...filters, dateFrom: date });
  };

  const handleDateToChange = (date: string) => {
    onFilterChange({ ...filters, dateTo: date });
  };

  const handleClearFilters = () => {
    onFilterChange({
      size: { Mini: true, Standard: true },
      status: { New: true, InProgress: true, Complete: true },
      difficulty: { Easy: true, Medium: true, Hard: true },
      author: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters =
    !filters.size.Mini ||
    !filters.size.Standard ||
    !filters.status.New ||
    !filters.status.InProgress ||
    !filters.status.Complete ||
    !filters.difficulty.Easy ||
    !filters.difficulty.Medium ||
    !filters.difficulty.Hard ||
    filters.author.trim() !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  return (
    <>
      {/* Mobile Filter Toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-primary text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Toggle filters"
      >
        <FunnelIcon className="w-6 h-6" />
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Filter Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen lg:h-auto
          w-80 bg-gray-50 border-r border-gray-200 shadow-lg lg:shadow-none
          overflow-y-auto z-50 lg:z-0
          transform transition-transform duration-300 ease-in-out
          rounded-r-lg lg:rounded-lg
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-gray-800">Filters</h2>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="lg:hidden text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close filters"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full mb-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-all duration-200"
            >
              Clear All Filters
            </button>
          )}

          {/* Size Filter */}
          <FilterSection title="Puzzle Size">
            <CheckboxFilter
              label="Mini"
              checked={filters.size.Mini}
              onChange={(checked) => handleSizeChange('Mini', checked)}
            />
            <CheckboxFilter
              label="Standard"
              checked={filters.size.Standard}
              onChange={(checked) => handleSizeChange('Standard', checked)}
            />
          </FilterSection>

          {/* Status Filter */}
          <FilterSection title="Completion Status">
            <CheckboxFilter
              label="New (Not Started)"
              checked={filters.status.New}
              onChange={(checked) => handleStatusChange('New', checked)}
            />
            <CheckboxFilter
              label="In Progress"
              checked={filters.status.InProgress}
              onChange={(checked) => handleStatusChange('InProgress', checked)}
            />
            <CheckboxFilter
              label="Complete"
              checked={filters.status.Complete}
              onChange={(checked) => handleStatusChange('Complete', checked)}
            />
          </FilterSection>

          {/* Difficulty Filter */}
          <FilterSection title="Difficulty Level">
            <CheckboxFilter
              label="Easy"
              checked={filters.difficulty.Easy}
              onChange={(checked) => handleDifficultyChange('Easy', checked)}
            />
            <CheckboxFilter
              label="Medium"
              checked={filters.difficulty.Medium}
              onChange={(checked) => handleDifficultyChange('Medium', checked)}
            />
            <CheckboxFilter
              label="Hard"
              checked={filters.difficulty.Hard}
              onChange={(checked) => handleDifficultyChange('Hard', checked)}
            />
          </FilterSection>

          {/* Author Filter */}
          <FilterSection title="Author">
            <input
              type="text"
              placeholder="Filter by author..."
              value={filters.author}
              onChange={(e) => handleAuthorChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 focus:bg-white transition-all"
            />
          </FilterSection>

          {/* Date Range Filter */}
          <FilterSection title="Date Added" defaultExpanded={false}>
            <div className="space-y-2">
              <div>
                <label htmlFor="filter-date-from" className="block text-xs text-gray-600 mb-1">
                  From
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label htmlFor="filter-date-to" className="block text-xs text-gray-600 mb-1">
                  To
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 focus:bg-white transition-all"
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </aside>
    </>
  );
};

export default FilterSidebar;
