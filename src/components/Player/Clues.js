import './css/clues.css';
import React, {Component} from 'react';
import ClueText from './ClueText';

export default class Clues extends Component {
  constructor() {
    super();
    this.state = {
      showClueLengths: false,
    };
    this._toggleShowClueLengths = this.toggleShowClueLengths.bind(this);
    this._handleSecretKeyDown = this.handleSecretKeyDown.bind(this);
    this._handleClueClick = this.handleClueClick.bind(this);
    this._handleClueKeyDown = this.handleClueKeyDown.bind(this);
  }

  toggleShowClueLengths() {
    const {showClueLengths} = this.state;
    this.setState({showClueLengths: !showClueLengths});
  }

  handleSecretKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') this._toggleShowClueLengths();
  }

  handleClueClick(e) {
    const {dir, clueIndex} = e.currentTarget.dataset;
    this.props.selectClue(dir, Number(clueIndex));
  }

  handleClueKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      const {dir, clueIndex} = e.currentTarget.dataset;
      this.props.selectClue(dir, Number(clueIndex));
    }
  }

  render() {
    const {clues, clueLengths, isClueSelected, isClueHalfSelected, isClueFilled, scrollToClue} = this.props;
    const {showClueLengths} = this.state;

    return (
      <div className="clues">
        <div
          className="clues--secret"
          role="button"
          tabIndex={0}
          onClick={this._toggleShowClueLengths}
          onKeyDown={this._handleSecretKeyDown}
          title={showClueLengths ? '' : 'Show lengths'}
        />
        {
          // Clues component
          ['across', 'down'].map((dir) => (
            <div key={dir} className="clues--list">
              <div className="clues--list--title">{dir.toUpperCase()}</div>

              <div className={`clues--list--scroll ${dir}`} ref={`clues--list--${dir}`}>
                {clues[dir].map(
                  (clue, clueIndex) =>
                    clue && (
                      <div
                        key={clueIndex} // eslint-disable-line react/no-array-index-key
                        role="button"
                        tabIndex={0}
                        className={`${
                          (isClueSelected(dir, clueIndex) ? 'selected ' : ' ') +
                          (isClueHalfSelected(dir, clueIndex) ? 'half-selected ' : ' ') +
                          (isClueFilled(dir, clueIndex) ? 'complete ' : ' ')
                        }clues--list--scroll--clue`}
                        // eslint-disable-next-line react/jsx-no-bind
                        ref={
                          isClueSelected(dir, clueIndex) || isClueHalfSelected(dir, clueIndex)
                            ? (node) => scrollToClue(dir, clueIndex, node)
                            : null
                        }
                        data-dir={dir}
                        data-clue-index={clueIndex}
                        onClick={this._handleClueClick}
                        onKeyDown={this._handleClueKeyDown}
                      >
                        <div className="clues--list--scroll--clue--number">{clueIndex}</div>
                        <div className="clues--list--scroll--clue--text">
                          <ClueText text={clue} />
                          {showClueLengths ? (
                            <span className="clues--list--scroll--clue--hint">
                              {'  '}({clueLengths[dir][clueIndex]})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          ))
        }
      </div>
    );
  }
}
