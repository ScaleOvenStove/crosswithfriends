import './css/index.css';

import React, {useState, useCallback} from 'react';
import Swal from 'sweetalert2';
import actions from '../../actions';
import {createNewPuzzle} from '../../api/puzzle';

import FileUploader from './FileUploader';

interface UploadProps {
  v2?: boolean;
  fencing?: boolean;
  onCreate?: () => void;
}

const Upload: React.FC<UploadProps> = ({v2, fencing, onCreate}) => {
  const [puzzle, setPuzzle] = useState<any>(null);
  const [recentUnlistedPid, setRecentUnlistedPid] = useState<number | null>(null);
  const [publicCheckboxChecked, setPublicCheckboxChecked] = useState(false);

  const renderUploadSuccessModal = useCallback(() => {
    Swal.close();
    if (!recentUnlistedPid) {
      if (onCreate) {
        onCreate();
      }
      Swal.fire({
        title: 'Upload Success!',
        icon: 'success',
        text: 'You may now view your puzzle on the home page.',
      });
    } else {
      const url = `/beta/play/${recentUnlistedPid}${fencing ? '?fencing=1' : ''}`;
      Swal.fire({
        title: 'Upload Success!',
        icon: 'success',
        html: `
          <div class="swal-text swal-text--no-margin swal-text--text-align-center">
            <p style="margin-top: 10px; margin-bottom: 10px;">
              Successfully created an unlisted puzzle. You may now visit the link
              <a href="${url}" style="word-break: break-all;">${url}</a>
              to play the new puzzle.
            </p>
          </div>
        `,
      });
    }
  }, [recentUnlistedPid, fencing, onCreate]);

  const renderUploadFailModal = useCallback((err: any) => {
    Swal.close();
    Swal.fire({
      title: 'Upload Failed!',
      icon: 'error',
      html: `
        <div class="swal-text swal-text--no-margin swal-text--text-align-center">
          <div>Upload failed. Error message:</div>
          <i>${err?.message ? err.message : 'Unknown error'}</i>
        </div>
      `,
    });
  }, []);

  const create = useCallback(
    async (isPublicOverride?: boolean) => {
      const isPublic = isPublicOverride !== undefined ? isPublicOverride : publicCheckboxChecked;
      const puzzleData = {
        ...puzzle,
      };
      // Remove private field if it exists - isPublic is handled separately
      delete puzzleData.private;
      // Ensure version field exists (required by server validation)
      if (!puzzleData.version) {
        puzzleData.version = 'http://ipuz.org/v1';
      }
      // store in both firebase & pg
      actions.createPuzzle(puzzleData, (pid: number) => {
        setPuzzle(null);
        setRecentUnlistedPid(isPublic ? undefined : pid);

        createNewPuzzle(
          {
            puzzle: puzzleData,
            pid: pid?.toString(),
            isPublic,
          },
          pid?.toString(),
          {
            isPublic,
          }
        )
          .then(renderUploadSuccessModal)
          .catch(renderUploadFailModal);
      });
    },
    [puzzle, publicCheckboxChecked, renderUploadSuccessModal, renderUploadFailModal]
  );

  const handleUpload = useCallback(
    (uploadConfirmed: boolean, isPublicOverride?: boolean) => {
      if (uploadConfirmed) {
        // If override is provided, update state and use it
        if (isPublicOverride !== undefined) {
          setPublicCheckboxChecked(isPublicOverride);
          return create(isPublicOverride);
        }
        return create();
      }
      return null;
    },
    [create]
  );

  const renderSuccessModal = useCallback(
    (puzzleData: any) => {
      const puzzleTitle = puzzleData.title || puzzleData.info?.title || 'Untitled';
      const escapedTitle = puzzleTitle.replace(/"/g, '&quot;');
      Swal.fire({
        title: 'Confirm Upload',
        icon: 'info',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Upload',
        html: `
          <div class="swal-text swal-text--no-margin swal-text--text-align-center">
            <p>
              You are about to upload the puzzle &quot;${escapedTitle}&quot;. Continue?
            </p>
            <div id="unlistedRow">
              <label>
                <input type="checkbox" id="publicCheckbox" ${publicCheckboxChecked ? 'checked' : ''} /> Upload
                Publicly
              </label>
            </div>
          </div>
        `,
        didOpen: () => {
          // Attach event listener directly to the checkbox in SweetAlert2's DOM
          const checkbox = document.getElementById('publicCheckbox') as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = publicCheckboxChecked;
            checkbox.addEventListener('change', (e) => {
              const target = e.target as HTMLInputElement;
              setPublicCheckboxChecked(target.checked);
            });
          }
        },
      }).then((result) => {
        if (result.isConfirmed) {
          // Read checkbox state directly from DOM before calling handleUpload
          const checkbox = document.getElementById('publicCheckbox') as HTMLInputElement;
          const isPublic = checkbox ? checkbox.checked : publicCheckboxChecked;
          handleUpload(true, isPublic);
        }
      });
    },
    [handleUpload, publicCheckboxChecked]
  );

  const success = useCallback(
    (puzzleData: any) => {
      setPuzzle({...puzzleData});
      setRecentUnlistedPid(null);
      // Don't reset checkbox state here - let user's previous choice persist
      renderSuccessModal(puzzleData);
    },
    [renderSuccessModal]
  );

  const fail = useCallback(() => {
    Swal.fire({
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
