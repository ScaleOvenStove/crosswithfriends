import './css/fileUploader.css';

import PUZtoIPUZ from '@crosswithfriends/shared/lib/converter/PUZtoIPUZ';
import fileTypeGuesser from '@crosswithfriends/shared/lib/fileTypeGuesser';
import {hasShape} from '@crosswithfriends/shared/lib/jsUtils';
import React, {useCallback, useRef, useEffect} from 'react';
import Dropzone from 'react-dropzone';
import {MdFileUpload} from 'react-icons/md';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const swal = withReactContent(Swal);

class UnknownFileTypeError extends Error {
  errorType: string;
  errorTitle: string;
  errorText: string;
  errorIcon: string;

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
  errorIcon: string;

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
  const validIpuz = useCallback((puzzle: any) => {
    // Validate ipuz format
    const shape = {
      version: '',
      kind: [],
      title: '',
      author: '',
      solution: [[]],
      puzzle: [[]],
      clues: {
        Across: [],
        Down: [],
      },
    };
    return hasShape(puzzle, shape);
  }, []);

  const convertPUZ = useCallback((buffer: ArrayBuffer) => {
    // Convert .puz directly to ipuz format
    return PUZtoIPUZ(buffer);
  }, []);

  const validateIPUZ = useCallback((readerResult: any) => {
    // For .ipuz files, just parse and validate - no conversion needed
    try {
      const ipuz = JSON.parse(new TextDecoder().decode(readerResult));
      return ipuz;
    } catch (_e) {
      throw new Error('Invalid JSON in .ipuz file');
    }
  }, []);

  const attemptPuzzleConversionRef = useRef<((readerResult: any, fileType: string) => any) | undefined>(
    undefined
  );

  const attemptPuzzleConversion = useCallback(
    (readerResult: any, fileType: string): any => {
      if (fileType === 'puz') {
        return convertPUZ(readerResult);
      } else if (fileType === 'ipuz') {
        return validateIPUZ(readerResult);
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
    [convertPUZ, validateIPUZ]
  );

  useEffect(() => {
    attemptPuzzleConversionRef.current = attemptPuzzleConversion;
  }, [attemptPuzzleConversion]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      const fileType = file.name.split('.').pop() || '';
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        try {
          const puzzle = attemptPuzzleConversion(reader.result, fileType);
          if (validIpuz(puzzle)) {
            success(puzzle);
          } else {
            fail();
          }
        } catch (e: unknown) {
          let defaultTitle = 'Something went wrong';
          let defaultText = 'An unknown error occurred';
          let defaultIcon: 'warning' | 'error' | 'info' | 'success' | 'question' = 'warning';

          if (e instanceof Error) {
            defaultText = `The error message was: ${e.message}`;
          }

          if (e && typeof e === 'object' && 'errorTitle' in e) {
            defaultTitle = String(e.errorTitle);
          }
          if (e && typeof e === 'object' && 'errorText' in e) {
            defaultText = String(e.errorText);
          }
          if (e && typeof e === 'object' && 'errorIcon' in e) {
            const icon = String(e.errorIcon);
            if (
              icon === 'warning' ||
              icon === 'error' ||
              icon === 'info' ||
              icon === 'success' ||
              icon === 'question'
            ) {
              defaultIcon = icon;
            }
          }

          swal.fire({
            title: defaultTitle,
            text: defaultText,
            icon: defaultIcon,
            confirmButtonText: 'OK',
          });
        }
        const firstFile = acceptedFiles[0];
        if (firstFile && 'preview' in firstFile && typeof firstFile.preview === 'string') {
          window.URL.revokeObjectURL(firstFile.preview);
        }
      });
      reader.readAsArrayBuffer(file);
    },
    [attemptPuzzleConversion, validIpuz, success, fail]
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
