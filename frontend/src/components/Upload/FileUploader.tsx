import './css/fileUploader.css';

import iPUZtoJSON from '@crosswithfriends/shared/lib/converter/iPUZtoJSON';
import PUZtoJSON from '@crosswithfriends/shared/lib/converter/PUZtoJSON';
import fileTypeGuesser from '@crosswithfriends/shared/lib/fileTypeGuesser';
import {hasShape} from '@crosswithfriends/shared/lib/jsUtils';
import React, {useCallback, useRef, useEffect} from 'react';
import Dropzone from 'react-dropzone';
import {MdFileUpload} from 'react-icons/md';
import Swal, {type SweetAlertIcon} from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);

class UnknownFileTypeError extends Error {
  errorType: string;
  errorTitle: string;
  errorText: string;
  errorIcon: any;

  constructor(fileType: string) {
    const title = `Unknown file type: .${fileType}`;
    super(title);
    this.errorType = 'UnknownFileTypeError';
    this.errorTitle = title;
    this.errorText = 'The uploaded file could not be recognized';
    this.errorIcon = 'warning';
  }
}

class UnsupportedFileTypeError extends Error {
  errorType: string;
  errorTitle: string;
  errorText: string;
  errorIcon: any;

  constructor(fileType: string) {
    const title = `Unsupported file type: .${fileType}`;
    super(title);
    this.errorType = 'UnsupportedFileTypeError';
    this.errorTitle = title;
    this.errorText = 'The uploaded file is not currently supported';
    this.errorIcon = 'warning';
  }
}

interface FileUploaderProps {
  v2?: boolean;
  success: (puzzle: any) => void;
  fail: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({v2, success, fail}) => {
  const validPuzzle = useCallback((puzzle: any) => {
    const shape = {
      info: {
        title: '',
        type: '',
        author: '',
      },
      grid: [['']],
      // circles: {} is optional
      clues: {
        across: {},
        down: {},
      },
    };
    return hasShape(puzzle, shape);
  }, []);

  const convertPUZ = useCallback((buffer: ArrayBuffer) => {
    const raw = PUZtoJSON(buffer);

    const {grid: rawGrid, info, circles, shades, across, down} = raw;

    const {title, author, description} = info;

    const grid = rawGrid.map((row: {solution?: string}[]) => row.map(({solution}) => solution || '.'));
    const type = grid.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';

    const result = {
      grid,
      circles,
      shades,
      info: {
        type,
        title,
        author,
        description,
      },
      clues: {across, down},
    };
    return result;
  }, []);

  const convertIPUZ = useCallback((readerResult: any) => {
    const {grid, info, circles, shades, across, down} = iPUZtoJSON(readerResult);

    const result = {
      grid,
      circles,
      shades,
      info,
      clues: {across, down},
    };

    return result;
  }, []);

  const attemptPuzzleConversionRef = useRef<((readerResult: any, fileType: string) => any) | null>(null);

  const attemptPuzzleConversion = useCallback(
    (readerResult: any, fileType: string): any => {
      if (fileType === 'puz') {
        return convertPUZ(readerResult);
      } else if (fileType === 'ipuz') {
        return convertIPUZ(readerResult);
      } else if (fileType === 'jpz') {
        throw new UnsupportedFileTypeError(fileType);
      } else {
        const guessedFileType = fileTypeGuesser(readerResult);
        if (!guessedFileType) {
          throw new UnknownFileTypeError(fileType);
        } else {
          return attemptPuzzleConversionRef.current?.(readerResult, guessedFileType);
        }
      }
    },
    [convertPUZ, convertIPUZ, fileTypeGuesser]
  );

  useEffect(() => {
    attemptPuzzleConversionRef.current = attemptPuzzleConversion;
  }, [attemptPuzzleConversion]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const fileType = file.name.split('.').pop() || '';
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        try {
          const puzzle = attemptPuzzleConversion(reader.result, fileType);
          if (validPuzzle(puzzle)) {
            success(puzzle);
          } else {
            fail();
          }
        } catch (e: any) {
          let defaultTitle = 'Something went wrong';
          let defaultText = `The error message was: ${e.message}`;
          let defaultIcon: SweetAlertIcon = 'warning';

          if (e?.errorTitle) defaultTitle = e.errorTitle;
          if (e?.errorText) defaultText = e.errorText;
          if (e?.errorIcon) defaultIcon = e.errorIcon;

          swal.fire({
            title: defaultTitle,
            text: defaultText,
            icon: defaultIcon,
            confirmButtonText: 'OK',
          });
        }
        if ((file as any).preview) {
          window.URL.revokeObjectURL((file as any).preview);
        }
      });
      reader.readAsArrayBuffer(file);
    },
    [attemptPuzzleConversion, validPuzzle, success, fail]
  );

  return (
    <Dropzone onDrop={onDrop}>
      {({getRootProps, getInputProps, isDragActive}) => (
        <div
          {...getRootProps()}
          className="file-uploader"
          style={{
            ...(isDragActive && {
              outline: '3px solid var(--main-blue)',
              outlineOffset: '-10px',
            }),
          }}
        >
          <input {...getInputProps()} />
          <div className={`file-uploader--wrapper ${v2 ? 'v2' : ''}`}>
            <div className="file-uploader--box">
              <MdFileUpload className="file-uploader--box--icon" />
              Import .puz or .ipuz file
            </div>
          </div>
        </div>
      )}
    </Dropzone>
  );
};

export default FileUploader;
