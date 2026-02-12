import './css/footer.css';

import React from 'react';
import {Link} from 'react-router-dom';

export default function Footer() {
  return (
    <div className="footer">
      <div className="footer--links">
        <Link to="/help">Help &amp; FAQ</Link>
        <span className="footer--separator">|</span>
        <Link to="/privacy">Privacy Policy</Link>
        <span className="footer--separator">|</span>
        <Link to="/terms">Terms of Service</Link>
      </div>
      <div>&copy; 2026 Cross with Friends</div>
    </div>
  );
}
