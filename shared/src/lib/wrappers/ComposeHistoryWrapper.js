import {reduce} from '../reducers/compose.js';
import HistoryWrapper from './HistoryWrapper.js';

export default class CompositionHistoryWrapper extends HistoryWrapper {
  get reduce() {
    return reduce;
  }
}
