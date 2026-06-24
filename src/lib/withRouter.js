import {useParams, useLocation, useNavigate} from 'react-router';

export default function withRouter(Component) {
  function WrappedComponent(props) {
    const params = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <Component {...props} match={{params}} location={location} navigate={navigate} />;
  }
  WrappedComponent.displayName = `withRouter(${Component.displayName || Component.name})`;
  return WrappedComponent;
}
