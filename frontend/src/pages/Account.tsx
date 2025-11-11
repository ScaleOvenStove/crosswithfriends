import './css/account.css';

import React, {useState} from 'react';
import Nav from '../components/common/Nav';

function AccountHistory() {
  return <div className="account-history">Account History</div>;
}

interface Panel {
  name: string;
  component: () => JSX.Element;
}

const Account: React.FC = () => {
  const [panel, setPanel] = useState<string | null>(null);

  const panels: Record<string, Panel> = {
    history: {
      name: 'History',
      component: AccountHistory,
    },
  };

  const selectPanel = (panelKey: string): void => {
    setPanel(panelKey);
  };

  const renderSidebar = (): JSX.Element => {
    return (
      <div className="account--sidebar">
        {' '}
        {Object.keys(panels).map((panelKey) => {
          const selected = panelKey === panel;
          const {name} = panels[panelKey];
          return (
            <div
              key={panelKey}
              className={`account--sidebar--entry ${selected ? ' selected' : ''}`}
              onClick={() => selectPanel(panelKey)}
            >
              {name}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPanel = (): JSX.Element | undefined => {
    if (panel) {
      const {component} = panels[panel];
      if (component) return component();
    }
    return undefined;
  };

  return (
    <div className="account">
      <Nav />
      <div className="account--title">Your Account</div>
      <div className="account--main">
        <div className="account--left">{renderSidebar()}</div>
        <div className="account--right">{renderPanel()}</div>
      </div>
    </div>
  );
};

export default Account;
