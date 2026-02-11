import {Helmet} from 'react-helmet';
import _ from 'lodash';
import React, {Component} from 'react';
import Flex from 'react-flexview';
import redirect from '../lib/redirect';
import actions from '../actions';

import Nav from '../components/common/Nav';
import {getUser, CompositionModel} from '../store';

export default class Compose extends Component {
  constructor() {
    super();
    this.state = {
      compositions: {},
      limit: 20,
    };
    this.puzzle = null;
  }

  componentDidMount() {
    this.initializeUser();
  }

  handleAuth = () => {
    this.user.listCompositions().then((compositions) => {
      this.setState({compositions});
    });
  };

  handleIncrementLimit = (amount) => {
    this.setState(({limit}) => ({limit: limit + amount}));
  };

  handleAddTen = () => {
    this.handleIncrementLimit(10);
  };

  handleAddFifty = () => {
    this.handleIncrementLimit(50);
  };

  static handleCreateClick(e) {
    e.preventDefault();
    actions.getNextCid((cid) => {
      const composition = new CompositionModel(`/composition/${cid}`);
      composition.initialize().then(() => {
        redirect(`/composition/${cid}`);
      });
    });
  }

  initializeUser() {
    this.user = getUser();
    this.user.onAuth(this.handleAuth);
    this.handleAuth();
  }

  static linkToComposition(cid, {title, author}) {
    return (
      <span>
        <a href={`/composition/${cid}/`}>{cid}</a>: {title} by {author}
      </span>
    );
  }

  render() {
    const {limit, compositions} = this.state;
    return (
      <Flex column className="compositions">
        <Nav />
        <Helmet>
          <title>Cross with Friends: Compose</title>
        </Helmet>
        <Flex shrink={0} hAlignContent="center">
          Limit: {limit}
          &nbsp;
          <button onClick={this.handleAddTen}>+</button>
          &nbsp;
          <button onClick={this.handleAddFifty}>++</button>
        </Flex>
        <Flex
          column
          style={{
            paddingLeft: 30,
            paddingTop: 20,
            paddingBottom: 20,
          }}
        >
          <h3>Compositions</h3>
          <Flex column>
            {_.keys(compositions).length === 0 && 'Nothing found'}
            {_.keys(compositions).map((cid) => (
              <div key={cid}>{Compose.linkToComposition(cid, compositions[cid])}</div>
            ))}
          </Flex>
          <br />
          <div>
            <button onClick={Compose.handleCreateClick}>New</button>
          </div>
        </Flex>
      </Flex>
    );
  }
}
