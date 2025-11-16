declare module 'react-linkify' {
  import {ReactNode} from 'react';

  interface LinkifyProps {
    children?: ReactNode;
    componentDecorator?: (
      decoratedHref: string,
      decoratedText: string,
      key: number
    ) => ReactNode;
    hrefDecorator?: (href: string) => string;
    matchDecorator?: (text: string) => Array<{
      index: number;
      lastIndex: number;
      text: string;
    }>;
    textDecorator?: (text: string) => ReactNode;
    properties?: Record<string, unknown>;
  }

  const Linkify: React.FC<LinkifyProps>;
  export default Linkify;
}

