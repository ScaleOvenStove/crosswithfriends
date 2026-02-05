import React from 'react';

import useStateParams from '../lib/hooks/useStateParams';
import Welcome from './Welcome';

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
  Midi: boolean;
  Standard: boolean;
  Large: boolean;
}

interface TypeFilter {
  Standard: boolean;
  Cryptic: boolean;
}

interface DayOfWeekFilter {
  Mon: boolean;
  Tue: boolean;
  Wed: boolean;
  Thu: boolean;
  Fri: boolean;
  Sat: boolean;
  Sun: boolean;
  Unknown: boolean;
}

function makeStatusFilter(complete: boolean, inProgress: boolean, _new: boolean): StatusFilter {
  return {Complete: complete, 'In progress': inProgress, New: _new};
}

function makeSizeFilter(mini: boolean, midi: boolean, standard: boolean, large: boolean): SizeFilter {
  return {Mini: mini, Midi: midi, Standard: standard, Large: large};
}

function makeTypeFilter(standard: boolean, cryptic: boolean): TypeFilter {
  return {Standard: standard, Cryptic: cryptic};
}

function makeDayOfWeekFilter(
  mon: boolean,
  tue: boolean,
  wed: boolean,
  thu: boolean,
  fri: boolean,
  sat: boolean,
  sun: boolean,
  unknown: boolean
): DayOfWeekFilter {
  return {Mon: mon, Tue: tue, Wed: wed, Thu: thu, Fri: fri, Sat: sat, Sun: sun, Unknown: unknown};
}

const boolToStr = (s: boolean) => (s ? '1' : '0');
const strToBool = (s: string) => s === '1';

const WrappedWelcome = (props: UseFencing) => {
  // Status filter
  const [includeComplete, setIncludeComplete] = useStateParams(true, 'complete', boolToStr, strToBool);
  const [includeInProgress, setIncludeInProgress] = useStateParams(true, 'in_progress', boolToStr, strToBool);
  const [includeNew, setIncludeNew] = useStateParams(true, 'new', boolToStr, strToBool);

  // Size filter
  const [includeMini, setIncludeMini] = useStateParams(true, 'mini', boolToStr, strToBool);
  const [includeMidi, setIncludeMidi] = useStateParams(true, 'midi', boolToStr, strToBool);
  const [includeStandard, setIncludeStandard] = useStateParams(true, 'standard', boolToStr, strToBool);
  const [includeLarge, setIncludeLarge] = useStateParams(true, 'large', boolToStr, strToBool);

  // Type filter
  const [includeStandardType, setIncludeStandardType] = useStateParams(true, 'type_standard', boolToStr, strToBool);
  const [includeCryptic, setIncludeCryptic] = useStateParams(true, 'type_cryptic', boolToStr, strToBool);

  // Day of week filter
  const [includeMon, setIncludeMon] = useStateParams(true, 'day_mon', boolToStr, strToBool);
  const [includeTue, setIncludeTue] = useStateParams(true, 'day_tue', boolToStr, strToBool);
  const [includeWed, setIncludeWed] = useStateParams(true, 'day_wed', boolToStr, strToBool);
  const [includeThu, setIncludeThu] = useStateParams(true, 'day_thu', boolToStr, strToBool);
  const [includeFri, setIncludeFri] = useStateParams(true, 'day_fri', boolToStr, strToBool);
  const [includeSat, setIncludeSat] = useStateParams(true, 'day_sat', boolToStr, strToBool);
  const [includeSun, setIncludeSun] = useStateParams(true, 'day_sun', boolToStr, strToBool);
  const [includeUnknownDay, setIncludeUnknownDay] = useStateParams(true, 'day_unknown', boolToStr, strToBool);

  const [search, setSearch] = useStateParams(
    '',
    'search',
    (s) => s,
    (s) => s
  );

  function setStatusFilter(statusFilter: StatusFilter) {
    setIncludeComplete(statusFilter['Complete']);
    setIncludeInProgress(statusFilter['In progress']);
    setIncludeNew(statusFilter['New']);
  }

  function setSizeFilter(sizeFilter: SizeFilter) {
    setIncludeMini(sizeFilter['Mini']);
    setIncludeMidi(sizeFilter['Midi']);
    setIncludeStandard(sizeFilter['Standard']);
    setIncludeLarge(sizeFilter['Large']);
  }

  function setTypeFilter(typeFilter: TypeFilter) {
    setIncludeStandardType(typeFilter['Standard']);
    setIncludeCryptic(typeFilter['Cryptic']);
  }

  function setDayOfWeekFilter(dayFilter: DayOfWeekFilter) {
    setIncludeMon(dayFilter['Mon']);
    setIncludeTue(dayFilter['Tue']);
    setIncludeWed(dayFilter['Wed']);
    setIncludeThu(dayFilter['Thu']);
    setIncludeFri(dayFilter['Fri']);
    setIncludeSat(dayFilter['Sat']);
    setIncludeSun(dayFilter['Sun']);
    setIncludeUnknownDay(dayFilter['Unknown']);
  }

  const welcomeProps = {
    statusFilter: makeStatusFilter(includeComplete, includeInProgress, includeNew),
    setStatusFilter,
    sizeFilter: makeSizeFilter(includeMini, includeMidi, includeStandard, includeLarge),
    setSizeFilter,
    typeFilter: makeTypeFilter(includeStandardType, includeCryptic),
    setTypeFilter,
    dayOfWeekFilter: makeDayOfWeekFilter(
      includeMon, includeTue, includeWed, includeThu,
      includeFri, includeSat, includeSun, includeUnknownDay
    ),
    setDayOfWeekFilter,
    search,
    setSearch,
    fencing: props.fencing,
  };

  return <Welcome {...welcomeProps} />;
};

export default WrappedWelcome;
