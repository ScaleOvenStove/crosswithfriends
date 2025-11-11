import {useEffect, useState} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';

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
    const currentValue = new URLSearchParams(location.search).get(paramsName);
    if (currentValue) {
      const deserialized = deserialize(currentValue);
      setState((prevState) => {
        if (deserialized !== prevState) {
          return deserialized;
        }
        return prevState;
      });
    }
  }, [location.search, paramsName, deserialize]);

  const onChange = (s: T) => {
    setState(s);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set(paramsName, serialize(s));
    const pathname = location.pathname;
    navigate({pathname, search: searchParams.toString()});
  };

  return [state, onChange];
}

export default useStateParams;
