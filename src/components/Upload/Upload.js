import './css/index.css';

import React, {Component} from 'react';
import actions from '../../actions';
import FileUploader from './FileUploader';
import UploadModal from './UploadModal';
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
      modal: null, // null | {type: 'confirm'|'success'|'duplicate'|'fail'|'malformed'|'error', ...}
      uploading: false,
    };
  }

  closeModal = () => {
    this.setState({modal: null, uploading: false});
  };

  success = (puzzle) => {
    this.setState({
      puzzle: {...puzzle},
      recentUnlistedPid: null,
      publicCheckboxChecked: false,
      modal: {type: 'confirm', puzzleTitle: puzzle.info?.title || 'Untitled'},
    });
  };

  create = async () => {
    this.setState({uploading: true});
    const isPublic = this.state.publicCheckboxChecked;
    const puzzle = {
      ...this.state.puzzle,
      private: !isPublic,
    };
    // store in both firebase & pg
    actions.createPuzzle(puzzle, (pid) => {
      this.setState({puzzle: null, recentUnlistedPid: isPublic ? undefined : pid});

      createNewPuzzle(puzzle, pid, {
        isPublic,
        accessToken: this.context?.accessToken,
      })
        .then((response) => this.handleUploadSuccess(response, isPublic))
        .catch(this.handleUploadFail);
    });
  };

  fail = () => {
    this.setState({modal: {type: 'malformed'}});
  };

  handleFileError = ({title, text}) => {
    this.setState({modal: {type: 'error', title, text}});
  };

  handleUploadSuccess = (response, isPublic) => {
    if (response && response.duplicate) {
      const url = `/beta/play/${response.pid}${this.props.fencing ? '?fencing=1' : ''}`;
      this.setState({modal: {type: 'duplicate', url}, uploading: false});
      return;
    }
    if (isPublic) {
      this.props.onCreate && this.props.onCreate();
      this.setState({
        modal: {type: 'success', message: 'You may now view your puzzle on the home page.'},
        uploading: false,
      });
    } else {
      const url = `/beta/play/${this.state.recentUnlistedPid}${this.props.fencing ? '?fencing=1' : ''}`;
      this.setState({modal: {type: 'success', url}, uploading: false});
    }
  };

  handleUploadFail = (err) => {
    this.setState({
      modal: {type: 'fail', error: err?.message || 'Unknown error'},
      uploading: false,
    });
  };

  handleChangePublicCheckbox = (e) => {
    this.setState({publicCheckboxChecked: e.target.checked});
  };

  renderModal() {
    const {modal, uploading} = this.state;
    if (!modal) return null;

    switch (modal.type) {
      case 'confirm':
        return (
          <UploadModal
            open
            title="Confirm Upload"
            icon="info"
            onConfirm={this.create}
            onCancel={this.closeModal}
            confirmText="Upload"
            cancelText="Cancel"
            loading={uploading}
          >
            <p>
              You are about to upload the puzzle &quot;{modal.puzzleTitle}&quot;. This will create a shareable
              game link, and anyone with the link will be able to solve it. Continue?
            </p>
            <div className="upload-modal--checkbox-row">
              <label>
                <input type="checkbox" onChange={this.handleChangePublicCheckbox} /> Also post this puzzle on
                the public site homepage
              </label>
            </div>
          </UploadModal>
        );

      case 'success':
        return (
          <UploadModal
            open
            title="Upload Success!"
            icon="success"
            onConfirm={this.closeModal}
            confirmText="OK"
          >
            {modal.url ? (
              <p>
                Successfully created an unlisted puzzle. You may now visit the link{' '}
                <a href={modal.url} style={{wordBreak: 'break-all'}}>
                  {modal.url}
                </a>{' '}
                to play the new puzzle.
              </p>
            ) : (
              <p>{modal.message}</p>
            )}
          </UploadModal>
        );

      case 'duplicate':
        return (
          <UploadModal
            open
            title="Puzzle Already Exists"
            icon="info"
            onConfirm={this.closeModal}
            confirmText="OK"
          >
            <p>
              This puzzle has already been uploaded. You can play it here:{' '}
              <a href={modal.url} style={{wordBreak: 'break-all'}}>
                {modal.url}
              </a>
            </p>
          </UploadModal>
        );

      case 'fail':
        return (
          <UploadModal open title="Upload Failed!" icon="error" onConfirm={this.closeModal} confirmText="OK">
            <div>Upload failed. Error message:</div>
            <i>{modal.error}</i>
          </UploadModal>
        );

      case 'malformed':
        return (
          <UploadModal
            open
            title="Malformed .puz file"
            icon="warning"
            onConfirm={this.closeModal}
            confirmText="OK"
          >
            <p>The uploaded .puz file is not a valid puzzle.</p>
          </UploadModal>
        );

      case 'error':
        return (
          <UploadModal
            open
            title={modal.title || 'Something went wrong'}
            icon="warning"
            onConfirm={this.closeModal}
            confirmText="OK"
          >
            <p>{modal.text}</p>
          </UploadModal>
        );

      default:
        return null;
    }
  }

  render() {
    const {v2} = this.props;
    return (
      <div className="upload">
        <div className="upload--main">
          <div className="upload--main--upload">
            <FileUploader success={this.success} fail={this.fail} onError={this.handleFileError} v2={v2} />
          </div>
        </div>
        {this.renderModal()}
      </div>
    );
  }
}
