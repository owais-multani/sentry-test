import styled from '@emotion/styled';

import DropdownButtonV2 from 'sentry/components/dropdownButtonV2';
import CompactSelect from 'sentry/components/forms/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';

type FilterOption = React.ComponentProps<typeof CompactSelect>['options'][0];

type Props = {
  onChange: (value: string) => void;
  placeholder: string;
  query: string;
  className?: string;
  filterOptions?: FilterOption[];
  onFilterChange?: (options: FilterOption[]) => void;
  selectedFilters?: FilterOption[];
};

function SearchBarAction({
  onChange,
  query,
  placeholder,
  filterOptions,
  selectedFilters,
  onFilterChange,
  className,
}: Props) {
  function trigger({props, ref}) {
    return (
      <StyledTrigger
        size="small"
        priority={selectedFilters && selectedFilters.length > 0 ? 'primary' : 'default'}
        ref={ref}
        {...props}
      >
        {selectedFilters?.length
          ? tn('%s Active Filter', '%s Active Filters', selectedFilters.length)
          : t('Filter By')}
      </StyledTrigger>
    );
  }

  return (
    <Wrapper className={className}>
      {filterOptions && (
        <CompactSelect
          multiple
          maxMenuHeight={400}
          options={filterOptions}
          value={selectedFilters?.map(f => f.value)}
          onChange={onFilterChange}
          trigger={trigger}
        />
      )}
      <StyledSearchBar
        onChange={onChange}
        query={query}
        placeholder={placeholder}
        blendWithFilter={!!filterOptions}
      />
    </Wrapper>
  );
}

export default SearchBarAction;

const Wrapper = styled('div')`
  display: flex;
  width: 100%;
  justify-content: flex-end;

  @media (max-width: ${props => props.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;
  position: relative;

  .search-input {
    height: 34px;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    ${p =>
      p.blendWithFilter &&
      `
        .search-input,
        .search-input:focus {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `}
  }
`;

const StyledTrigger = styled(DropdownButtonV2)`
  display: inline-block;
  border-radius: ${p => p.theme.borderRadiusLeft};
  transform: translateX(2px);
  z-index: 0;
`;
