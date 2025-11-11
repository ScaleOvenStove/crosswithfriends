import React from 'react';

import useStateParams from '@crosswithfriends/shared/lib/hooks/useStateParams';
import Welcome from './Welcome';
import ErrorBoundary from '../components/common/ErrorBoundary';

interface UseFencing {
  fencing: boolean;
}

interface StatusFilter {
  Complete: boolean;
  'In progress': boolean;
  New: boolean;
}

interface SizeFilter {
  Mini: boolean;
  Standard: boolean;
}

function makeStatusFilter(complete: boolean, inProgress: boolean, _new: boolean): StatusFilter {
  return {Complete: complete, 'In progress': inProgress, New: _new};
}

function makeSizeFilter(mini: boolean, standard: boolean): SizeFilter {
  return {Mini: mini, Standard: standard};
}

const WrappedWelcome = (props: UseFencing) => {
  const [includeComplete, setIncludeComplete] = useStateParams(
    true,
    'complete',
    (s: boolean) => (s ? '1' : '0'),
    (s: string) => s === '1'
  );

  const [includeInProgress, setIncludeInProgress] = useStateParams(
    true,
    'in_progress',
    (s: boolean) => (s ? '1' : '0'),
    (s: string) => s === '1'
  );

  const [includeNew, setIncludeNew] = useStateParams(
    true,
    'new',
    (s: boolean) => (s ? '1' : '0'),
    (s: string) => s === '1'
  );

  const [includeMini, setIncludeMini] = useStateParams(
    true,
    'mini',
    (s: boolean) => (s ? '1' : '0'),
    (s: string) => s === '1'
  );

  const [includeStandard, setIncludeStandard] = useStateParams(
    true,
    'standard',
    (s: boolean) => (s ? '1' : '0'),
    (s: string) => s === '1'
  );

  const [search, setSearch] = useStateParams(
    '',
    'search',
    (s: string) => s,
    (s: string) => s
  );

  function setStatusFilter(statusFilter: StatusFilter) {
    setIncludeComplete(statusFilter['Complete']);
    setIncludeInProgress(statusFilter['In progress']);
    setIncludeNew(statusFilter['New']);
  }

  function setSizeFilter(sizeFilter: SizeFilter) {
    setIncludeMini(sizeFilter['Mini']);
    setIncludeStandard(sizeFilter['Standard']);
  }

  const welcomeProps = {
    statusFilter: makeStatusFilter(includeComplete, includeInProgress, includeNew),
    setStatusFilter,
    sizeFilter: makeSizeFilter(includeMini, includeStandard),
    setSizeFilter,
    search,
    setSearch,
    fencing: props.fencing,
  };

  return (
    <ErrorBoundary>
      <Welcome {...welcomeProps} />
    </ErrorBoundary>
  );
};

export default WrappedWelcome;
