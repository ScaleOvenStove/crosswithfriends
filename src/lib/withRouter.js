import {useParams, useLocation} from 'react-router';

export default function withRouter(Component) {
  function WrappedComponent(props) {
    const params = useParams();
    const location = useLocation();
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <Component {...props} match={{params}} location={location} />;
  }
  WrappedComponent.displayName = `withRouter(${Component.displayName || Component.name})`;
  return WrappedComponent;
}
