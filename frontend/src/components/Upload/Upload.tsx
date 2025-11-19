import './css/index.css';

import React, {useState, useCallback} from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);
import actions from '../../actions';
import {createNewPuzzle} from '../../api/puzzle';

import FileUploader from './FileUploader';

interface UploadProps {
  v2?: boolean;
  fencing?: boolean;
  onCreate?: () => void;
}

const Upload: React.FC<UploadProps> = ({v2, fencing, onCreate}) => {
  const [, setPublicCheckboxChecked] = useState(false);

  const renderUploadSuccessModal = useCallback(
    (pid: number | null, isPublic: boolean) => {
      Swal.close();
      if (isPublic || !pid) {
        if (onCreate) {
          onCreate();
        }
        swal.fire({
          title: 'Upload Success!',
          icon: 'success',
          text: 'You may now view your puzzle on the home page.',
        });
      } else {
        const url = `/beta/play/${pid}${fencing ? '?fencing=1' : ''}`;
        swal.fire({
          title: 'Upload Success!',
          icon: 'success',
          html: (
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
    },
    [fencing, onCreate]
  );

  const renderUploadFailModal = useCallback((err: any) => {
    Swal.close();
    swal.fire({
      title: 'Upload Failed!',
      icon: 'error',
      html: (
        <div className="swal-text swal-text--no-margin swal-text--text-align-center">
          <div>Upload failed. Error message:</div>
          <i>{err?.message ? err.message : 'Unknown error'}</i>
        </div>
      ),
    });
  }, []);

  const create = useCallback(
    async (puzzleDataArg: any, isPublicArg: boolean) => {
      const puzzleData = {
        ...puzzleDataArg,
        private: !isPublicArg,
      };
      // store in both firebase & pg
      actions.createPuzzle(puzzleData, (pid: number) => {
        createNewPuzzle(puzzleData, String(pid), {
          isPublic: isPublicArg,
        })
          .then(() => renderUploadSuccessModal(pid, isPublicArg))
          .catch(renderUploadFailModal);
      });
    },
    [renderUploadSuccessModal, renderUploadFailModal]
  );

  const handleUpload = useCallback(
    (uploadConfirmed: boolean, puzzleData: any, isPublic: boolean) => {
      if (uploadConfirmed) {
        return create(puzzleData, isPublic);
      }
      return null;
    },
    [create]
  );

  const renderSuccessModal = useCallback(
    (puzzleData: any) => {
      const puzzleTitle = puzzleData.info?.title || 'Untitled';
      swal
        .fire({
          title: 'Confirm Upload',
          icon: 'info',
          showCancelButton: true,
          cancelButtonText: 'Cancel',
          confirmButtonText: 'Upload',
          html: (
            <div className="swal-text swal-text--no-margin swal-text--text-align-center">
              <p>
                You are about to upload the puzzle &quot;
                {puzzleTitle}
                &quot;. Continue?
              </p>
              <label>
                <input type="checkbox" id="public-checkbox" /> Upload Publicly
              </label>
            </div>
          ),
          preConfirm: () => {
            const checkbox = Swal.getPopup()?.querySelector('#public-checkbox') as HTMLInputElement;
            return {isPublic: checkbox?.checked || false};
          },
        })
        .then((result) => {
          if (result.isConfirmed) {
            const isPublic = result.value?.isPublic || false;
            setPublicCheckboxChecked(isPublic);
            handleUpload(true, puzzleData, isPublic);
          }
        });
    },
    [handleUpload]
  );

  const success = useCallback(
    (puzzleData: any) => {
      setPublicCheckboxChecked(false);
      renderSuccessModal(puzzleData);
    },
    [renderSuccessModal]
  );

  const fail = useCallback(() => {
    swal.fire({
      title: `Malformed .puz file`,
      text: `The uploaded .puz file is not a valid puzzle.`,
      icon: 'warning',
      confirmButtonText: 'OK',
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
