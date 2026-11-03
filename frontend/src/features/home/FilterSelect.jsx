import { ChevronDown } from 'lucide-react';

const FilterSelect = ({ label, value, options, open, onToggle, onChange }) => {
  const current = options.find((item) => item.value === value);

  return (
    <div className={`ps-field ps-filter-field${open ? ' is-open' : ''}`}>
      <span>{label}</span>
      <div className="ps-filter-control">
        <button
          type="button"
          className={`ps-filter-value${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={onToggle}
        >
          <span>{current?.label || 'Cualquiera'}</span>
          <ChevronDown size={14} />
        </button>
        <div
          className={`ps-popover ps-filter-menu${open ? ' is-open' : ''}`}
          role="listbox"
          aria-label={label}
          aria-hidden={!open}
          inert={!open}
        >
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === value}
              tabIndex={open ? 0 : -1}
              className={`ps-menu-item${item.value === value ? ' is-active' : ''}`}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterSelect;
