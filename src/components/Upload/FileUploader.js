import './css/fileUploader.css';

import {useCallback} from 'react';
import {useDropzone} from 'react-dropzone';
import {MdFileUpload} from 'react-icons/md';
import {hasShape} from '../../lib/jsUtils';
import PUZtoJSON from '../../lib/converter/PUZtoJSON';
import iPUZtoJSON from '../../lib/converter/iPUZtoJSON';
import fileTypeGuesser from '../../lib/fileTypeGuesser';

class UnknownFileTypeError extends Error {
  constructor(fileType) {
    const title = `Unknown file type: .${fileType}`;
    super(title);
    this.errorType = 'UnknownFileTypeError';
    this.errorTitle = title;
    this.errorText = 'The uploaded file could not be recognized';
    this.errorIcon = 'warning';
  }
}

class UnsupportedFileTypeError extends Error {
  constructor(fileType) {
    const title = `Unsupported file type: .${fileType}`;
    super(title);
    this.errorType = 'UnsupportedFileTypeError';
    this.errorTitle = title;
    this.errorText = 'The uploaded file is not currently supported';
    this.errorIcon = 'warning';
  }
}

function validPuzzle(puzzle) {
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
}

function convertPUZ(buffer) {
  const raw = PUZtoJSON(buffer);

  const {grid: rawGrid, info, circles, shades, across, down, contest} = raw;

  const {title, author, description} = info;

  const grid = rawGrid.map((row) => row.map(({solution}) => (solution !== undefined ? solution : '.')));
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
    ...(contest ? {contest} : {}),
  };
  return result;
}

function convertIPUZ(readerResult) {
  const {grid, info, circles, shades, across, down, contest} = iPUZtoJSON(readerResult);

  const result = {
    grid,
    circles,
    shades,
    info,
    clues: {across, down},
    ...(contest ? {contest} : {}),
  };

  return result;
}

function attemptPuzzleConversion(readerResult, fileType) {
  if (fileType === 'puz') {
    return convertPUZ(readerResult);
  }
  if (fileType === 'ipuz') {
    return convertIPUZ(readerResult);
  }
  if (fileType === 'jpz') {
    throw new UnsupportedFileTypeError(fileType);
  } else {
    const guessedFileType = fileTypeGuesser(readerResult);
    if (!guessedFileType) {
      throw new UnknownFileTypeError(fileType);
    } else {
      return attemptPuzzleConversion(readerResult, guessedFileType);
    }
  }
}

export default function FileUploader({success, fail, onError, v2}) {
  const handleDrop = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      const fileType = file.name.split('.').pop();
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        try {
          const puzzle = attemptPuzzleConversion(reader.result, fileType);
          if (validPuzzle(puzzle)) {
            success(puzzle);
          } else {
            fail();
          }
        } catch (e) {
          const title = e?.errorTitle || 'Something went wrong';
          const text = e?.errorText || `The error message was: ${e.message}`;
          if (onError) {
            onError({title, text});
          }
        }
      });
      reader.readAsArrayBuffer(file);
    },
    [success, fail, onError]
  );

  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: handleDrop});

  /* eslint-disable react/jsx-props-no-spreading -- idiomatic react-dropzone v14 API */
  return (
    <div
      {...getRootProps({
        className: `file-uploader${isDragActive ? ' file-uploader--active' : ''}`,
      })}
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
}
