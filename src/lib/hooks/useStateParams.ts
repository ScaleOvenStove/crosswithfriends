import {useEffect, useState} from 'react';
import {useNavigate, useLocation} from 'react-router';

function useStateParams<T>(
  initialState: T,
  paramsName: string,
  serialize: (state: T) => string,
  deserialize: (state: string) => T
): [T, (state: T) => void] {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);

  const existingValue = search.get(paramsName);
  const [state, setState] = useState<T>(existingValue ? deserialize(existingValue) : initialState);

  useEffect(() => {
    // Updates state when user navigates backwards or forwards in browser history
    if (existingValue && deserialize(existingValue) !== state) {
      setState(deserialize(existingValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingValue]);

  const onChange = (s: T) => {
    setState(s);
    // Read current URL directly — location from useLocation() may be stale
    // when multiple filters update in quick succession
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set(paramsName, serialize(s));
    navigate({pathname: window.location.pathname, search: searchParams.toString()}, {replace: true});
  };

  return [state, onChange];
}

export default useStateParams;
