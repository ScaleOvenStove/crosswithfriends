import './css/index.css';

import React, {useState, useCallback} from 'react';
import swal from '@sweetalert/with-react';
import actions from '../../actions';
import FileUploader from './FileUploader';
import {createNewPuzzle} from '../../api/puzzle';

interface UploadProps {
  v2?: boolean;
  fencing?: boolean;
  onCreate?: () => void;
}

const Upload: React.FC<UploadProps> = ({v2, fencing, onCreate}) => {
  const [puzzle, setPuzzle] = useState<any>(null);
  const [recentUnlistedPid, setRecentUnlistedPid] = useState<number | null>(null);
  const [publicCheckboxChecked, setPublicCheckboxChecked] = useState(false);

  const handleChangePublicCheckbox = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPublicCheckboxChecked(e.target.checked);
  }, []);

  const renderUploadSuccessModal = useCallback(() => {
    swal.close();
    if (!recentUnlistedPid) {
      if (onCreate) {
        onCreate();
      }
      swal({
        title: 'Upload Success!',
        icon: 'success',
        text: 'You may now view your puzzle on the home page.',
      });
    } else {
      const url = `/beta/play/${recentUnlistedPid}${fencing ? '?fencing=1' : ''}`;
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
  }, [recentUnlistedPid, fencing, onCreate]);

  const renderUploadFailModal = useCallback((err: any) => {
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
  }, []);

  const create = useCallback(async () => {
    const isPublic = publicCheckboxChecked;
    const puzzleData = {
      ...puzzle,
      private: !isPublic,
    };
    // store in both firebase & pg
    actions.createPuzzle(puzzleData, (pid: number) => {
      setPuzzle(null);
      setRecentUnlistedPid(isPublic ? undefined : pid);

      createNewPuzzle(puzzleData, pid, {
        isPublic,
      })
        .then(renderUploadSuccessModal)
        .catch(renderUploadFailModal);
    });
  }, [puzzle, publicCheckboxChecked, renderUploadSuccessModal, renderUploadFailModal]);

  const handleUpload = useCallback(
    (uploadConfirmed: boolean) => {
      if (uploadConfirmed) {
        return create();
      }
      return null;
    },
    [create]
  );

  const renderSuccessModal = useCallback(
    (puzzleData: any) => {
      const puzzleTitle = puzzleData.info?.title || 'Untitled';
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
              &quot;. Continue?
            </p>
            <div id="unlistedRow">
              <label>
                <input type="checkbox" onChange={handleChangePublicCheckbox} /> Upload Publicly
              </label>
            </div>
          </div>
        ),
      }).then(handleUpload);
    },
    [handleChangePublicCheckbox, handleUpload]
  );

  const success = useCallback(
    (puzzleData: any) => {
      setPuzzle({...puzzleData});
      setRecentUnlistedPid(null);
      setPublicCheckboxChecked(false);
      renderSuccessModal(puzzleData);
    },
    [renderSuccessModal]
  );

  const fail = useCallback(() => {
    swal({
      title: `Malformed .puz file`,
      text: `The uploaded .puz file is not a valid puzzle.`,
      icon: 'warning',
      buttons: 'OK',
      dangerMode: true,
    });
  }, []);

  return (
    <div className="upload">
      <div className="upload--main">
        <div className="upload--main--upload">
          <FileUploader success={success} fail={fail} v2={v2} />
        </div>
      </div>
    </div>
  );
};

export default Upload;
