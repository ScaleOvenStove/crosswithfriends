import './css/fileUploader.css';

import PUZtoIPUZ from '@crosswithfriends/shared/lib/converter/PUZtoIPUZ';
import fileTypeGuesser from '@crosswithfriends/shared/lib/fileTypeGuesser';
import {hasShape} from '@crosswithfriends/shared/lib/jsUtils';
import type {PuzzleJson} from '@crosswithfriends/shared/types';
import React, {useCallback, useRef, useEffect} from 'react';
import {MdFileUpload} from 'react-icons/md';
import Swal from 'sweetalert2';

import {useDropzone} from '../../utils/useDropzone';

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
  success: (puzzle: PuzzleJson) => void;
  fail: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({v2, success, fail: _fail}) => {
  const validIpuz = useCallback((puzzle: unknown): puzzle is PuzzleJson => {
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
    // Legacy converter - kept for backward compatibility
    return PUZtoIPUZ(buffer);
  }, []);

  const validateIPUZ = useCallback(
    async (readerResult: ArrayBuffer | string, _filename?: string): Promise<PuzzleJson> => {
      // Parse .ipuz files as JSON
      const text = typeof readerResult === 'string' ? readerResult : new TextDecoder().decode(readerResult);
      try {
        const puzzle = JSON.parse(text);
        if (!validIpuz(puzzle)) {
          throw new Error('Invalid iPUZ format');
        }
        return puzzle;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Invalid iPUZ format: ${error.message}`);
        }
        throw new Error('Invalid iPUZ format');
      }
    },
    [validIpuz]
  );

  const attemptPuzzleConversionRef = useRef<
    | ((
        readerResult: ArrayBuffer | string,
        fileType: string,
        filename?: string
      ) => Promise<PuzzleJson> | PuzzleJson)
    | undefined
  >(undefined);

  const attemptPuzzleConversion = useCallback(
    async (
      readerResult: ArrayBuffer | string | null,
      fileType: string,
      filename?: string
    ): Promise<PuzzleJson> => {
      if (!readerResult) {
        throw new Error('No file data provided');
      }

      if (fileType === 'puz') {
        // Legacy converter expects ArrayBuffer
        if (typeof readerResult === 'string') {
          throw new Error('PUZ files must be binary');
        }
        // Legacy converter returns ipuz format (PuzzleJson)
        return convertPUZ(readerResult) as PuzzleJson;
      } else if (fileType === 'ipuz') {
        return await validateIPUZ(readerResult, filename);
      } else if (fileType === 'jpz') {
        throw new UnsupportedFileTypeError(fileType);
      } else {
        // fileTypeGuesser expects ArrayBuffer
        if (typeof readerResult === 'string') {
          throw new UnknownFileTypeError(fileType);
        }
        const guessedFileType = fileTypeGuesser(readerResult);
        if (!guessedFileType) {
          throw new UnknownFileTypeError(fileType);
        } else {
          // Only support ipuz for auto-detected formats
          if (guessedFileType === 'ipuz') {
            return await validateIPUZ(readerResult, filename);
          }
          // For other types, try the conversion recursively
          const result = await attemptPuzzleConversionRef.current?.(readerResult, guessedFileType, filename);
          if (!result) {
            throw new Error('Failed to parse puzzle');
          }
          return result;
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
      reader.addEventListener('loadend', async () => {
        try {
          if (reader.result === null) {
            throw new Error('Failed to read file');
          }
          const puzzle = await attemptPuzzleConversion(reader.result, fileType, file.name);

          // Validate the parsed puzzle
          if (!validIpuz(puzzle)) {
            throw new Error('Parsed puzzle failed validation');
          }

          // Additional validation: ensure puzzle has required fields
          if (!puzzle.solution || puzzle.solution.length === 0) {
            throw new Error('Puzzle has no solution');
          }
          if (!puzzle.puzzle || puzzle.puzzle.length === 0) {
            throw new Error('Puzzle has no puzzle grid');
          }
          if (!puzzle.clues || (!puzzle.clues.Across?.length && !puzzle.clues.Down?.length)) {
            throw new Error('Puzzle has no clues');
          }

          success(puzzle);
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

          Swal.fire({
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
    [attemptPuzzleConversion, validIpuz, success]
  );

  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.puz', '.ipuz'],
    },
  });

  return (
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
  );
};

export default FileUploader;
