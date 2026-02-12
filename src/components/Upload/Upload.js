import './css/index.css';

import React, {Component} from 'react';
import swal from '@sweetalert/with-react';
import actions from '../../actions';
import FileUploader from './FileUploader';
import {createNewPuzzle} from '../../api/puzzle';
import AuthContext from '../../lib/AuthContext';

export default class Upload extends Component {
  static contextType = AuthContext;

  constructor() {
    super();
    this.state = {
      puzzle: null,
      recentUnlistedPid: null,
      publicCheckboxChecked: false,
    };
  }

  success = (puzzle) => {
    this.setState({
      puzzle: {...puzzle},
      recentUnlistedPid: null,
      publicCheckboxChecked: false,
    });
    this.renderSuccessModal(puzzle);
  };

  create = async () => {
    const isPublic = this.state.publicCheckboxChecked;
    const puzzle = {
      ...this.state.puzzle,
      private: !isPublic,
    };
    // store in both firebase & pg
    actions.createPuzzle(puzzle, (pid) => {
      this.setState({puzzle: null});
      this.setState({
        recentUnlistedPid: isPublic ? undefined : pid,
      });

      createNewPuzzle(puzzle, pid, {
        isPublic,
        accessToken: this.context?.accessToken,
      })
        .then(this.renderUploadSuccessModal)
        .catch(this.renderUploadFailModal);
    });
  };

  // eslint-disable-next-line class-methods-use-this
  fail = () => {
    swal({
      title: `Malformed .puz file`,
      text: `The uploaded .puz file is not a valid puzzle.`,
      icon: 'warning',
      buttons: 'OK',
      dangerMode: true,
    });
  };

  renderSuccessModal(puzzle) {
    const puzzleTitle = puzzle.info?.title || 'Untitled';
    swal({
      title: 'Confirm Upload',
      icon: 'info',
      buttons: [
        'Cancel',
        {
          text: 'Upload',
          closeModal: false,
        },
      ],
      content: (
        <div className="swal-text swal-text--no-margin swal-text--text-align-center">
          <p>
            You are about to upload the puzzle &quot;
            {puzzleTitle}
            &quot;. This will create a shareable game link, and anyone with the link will be able to solve it.
            Continue?
          </p>
          <div id="unlistedRow">
            <label>
              <input type="checkbox" onChange={this.handleChangePublicCheckbox} /> Also post this puzzle on
              the public site homepage
            </label>
          </div>
        </div>
      ),
    }).then(this.handleUpload);
  }

  handleUpload = (uploadConfirmed) => {
    if (uploadConfirmed) {
      return this.create();
    }
    return null;
  };

  renderUploadSuccessModal = (response) => {
    swal.close();
    if (response && response.duplicate) {
      const url = `/beta/play/${response.pid}${this.props.fencing ? '?fencing=1' : ''}`;
      swal({
        title: 'Puzzle Already Exists',
        icon: 'info',
        content: (
          <div className="swal-text swal-text--no-margin swal-text--text-align-center">
            <p style={{marginTop: 10, marginBottom: 10}}>
              This puzzle has already been uploaded. You can play it here:{' '}
              <a href={url} style={{wordBreak: 'break-all'}}>
                {url}
              </a>
            </p>
          </div>
        ),
      });
      return;
    }
    if (!this.state.recentUnlistedPid) {
      this.props.onCreate && this.props.onCreate();
      swal({
        title: 'Upload Success!',
        icon: 'success',
        text: 'You may now view your puzzle on the home page.',
      });
    } else {
      const url = `/beta/play/${this.state.recentUnlistedPid}${this.props.fencing ? '?fencing=1' : ''}`;
      swal({
        title: 'Upload Success!',
        icon: 'success',
        content: (
          <div className="swal-text swal-text--no-margin swal-text--text-align-center">
            <p style={{marginTop: 10, marginBottom: 10}}>
              Successfully created an unlisted puzzle. You may now visit the link{' '}
              <a href={url} style={{wordBreak: 'break-all'}}>
                {url}
              </a>{' '}
              to play the new puzzle.
            </p>
          </div>
        ),
      });
    }
  };

  // eslint-disable-next-line class-methods-use-this
  renderUploadFailModal = (err) => {
    swal.close();
    swal({
      title: 'Upload Failed!',
      icon: 'error',
      content: (
        <div className="swal-text swal-text--no-margin swal-text--text-align-center">
          <div>Upload failed. Error message:</div>
          <i>{err?.message ? err.message : 'Unknown error'}</i>
        </div>
      ),
    });
  };

  handleChangePublicCheckbox = (e) => {
    this.setState({
      publicCheckboxChecked: e.target.checked,
    });
  };

  render() {
    const {v2} = this.props;
    return (
      <div className="upload">
        <div className="upload--main">
          <div className="upload--main--upload">
            <FileUploader success={this.success} fail={this.fail} v2={v2} />
          </div>
        </div>
      </div>
    );
  }
}
