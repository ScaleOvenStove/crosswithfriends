import {SiKofi, SiBuymeacoffee} from 'react-icons/si';
import {FaHeart} from 'react-icons/fa';
import './css/supportOptions.css';

export function SupportHeartIcon() {
  return (
    <span className="support-options--heart">
      <FaHeart />
    </span>
  );
}

export default function SupportOptions({showIntro = true}) {
  return (
    <div className="support-options">
      {showIntro && (
        <p className="support-options--intro">
          Cross with Friends is a free, open-source labor of love. If you&apos;d like to chip in toward
          hosting costs, either option below goes to the same place.
        </p>
      )}
      <a
        className="support-options--button support-options--button-kofi"
        href="https://ko-fi.com/crosswithfriends"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="support-options--icon">
          <SiKofi />
        </span>
        <span className="support-options--label-primary">Ko-fi</span>
      </a>
      <a
        className="support-options--button support-options--button-bmc"
        href="https://buymeacoffee.com/crosswithfriends"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="support-options--icon">
          <SiBuymeacoffee />
        </span>
        <span className="support-options--label-primary">Buy Me a Coffee</span>
      </a>
    </div>
  );
}
