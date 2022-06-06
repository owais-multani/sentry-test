import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';

import BaseSearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {normalizeDateTimeParams} from '../organizations/pageFilters/parse';
import SearchDropdown from '../smartSearchBar/searchDropdown';
import {ItemType, SearchGroup} from '../smartSearchBar/types';

type SearchBarProps = {
  location: Location;
  organization: Organization;
  projectIds?: number[] | Readonly<number[]>;
};

function SearchBar(props: SearchBarProps) {
  const {organization, projectIds, location} = props;
  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const api = useApi();

  const handleSearch = debounce(
    async query => {
      if (query.length < 3) {
        setSearchResults([]);
        return;
      }

      const projectIdStrings = (projectIds as Readonly<number>[])?.map(String);
      const endpointParams = normalizeDateTimeParams(location.query);

      try {
        setLoading(true);
        const conditions = new MutableSearch('');
        conditions.addFilterValues('transaction', [`*${query}*`], false);
        conditions.addFilterValues('event.type', ['transaction']);
        const [results] = await doDiscoverQuery<{
          data: Array<{project_id: string; transaction: string}>;
        }>(api, `/organizations/${organization.slug}/events/`, {
          field: ['transaction', 'project', 'project_id', 'count()'],
          project: projectIdStrings,
          sort: '-transaction',
          query: conditions.formatString(),
          statsPeriod: endpointParams.statsPeriod,
        });

        const parsedResults = results.data.reduce(
          (searchGroup: SearchGroup, item) => {
            searchGroup.children.push({
              value: `${item.transaction}:${item.project_id}`,
              title: item.transaction,
              type: ItemType.DEFAULT,
              desc: '',
            });
            return searchGroup;
          },
          {title: '', children: [], icon: null, type: ItemType.DEFAULT}
        );

        setSearchResults([parsedResults]);
      } catch (_) {
        throw new Error('Unable to fetch event field values');
      } finally {
        setLoading(false);
      }
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  const navigateToTransactionSummary = (name: string) => {
    const lastIndex = name.lastIndexOf(':');

    const transactionName = name.slice(0, lastIndex);

    const projectId = name.slice(lastIndex + 1);

    const next = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: String(transactionName),
      projectID: projectId,
      query: {},
    });
    browserHistory.push(next);
  };

  return (
    <Container>
      <BaseSearchBar placeholder={t('Search Transactions')} onChange={handleSearch} />
      <SearchDropdown
        css={{display: searchResults[0]?.children.length ? 'block' : 'none'}}
        loading={loading}
        items={searchResults}
        onClick={navigateToTransactionSummary}
      />
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
`;

export default SearchBar;
